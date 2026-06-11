const { Op } = require('sequelize');
const { Program, ProgramAssignment, CoachClient } = require('../models');
const { clientAdherence } = require('../services/adherenceService');
const { weekOf } = require('../services/assignmentMath');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// weekdayMap valido: { dayKey: 1..7 } con chiavi esistenti tra i giorni della scheda.
function pickWeekdayMap(raw, program) {
  if (raw === null) return null;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const validKeys = new Set((program.days || []).map((d) => d.key));
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    const day = Number(v);
    if (validKeys.has(k) && Number.isInteger(day) && day >= 1 && day <= 7) out[k] = day;
  }
  return Object.keys(out).length ? out : null;
}

// POST /api/coach/clients/:clientId/assignments — dopo loadCoachClient.
// Un solo assignment active per coppia coach+cliente (409).
async function create(req, res, next) {
  try {
    const { programId, startDate, note } = req.body;
    if (!programId || !DATE_RE.test(String(startDate || ''))) {
      return res.status(400).json({ error: { message: 'programId e startDate (YYYY-MM-DD) sono obbligatori' } });
    }

    const program = await Program.findOne({ where: { id: programId, coachId: req.user.uid } });
    if (!program) return res.status(404).json({ error: { message: 'Scheda non trovata' } });
    if (program.status === 'archived') {
      return res.status(409).json({ error: { message: 'Scheda archiviata: non assegnabile', code: 'program_archived' } });
    }

    const existing = await ProgramAssignment.findOne({
      where: { coachId: req.user.uid, clientId: req.clientId, status: 'active' },
    });
    if (existing) {
      return res.status(409).json({
        error: { message: 'Il cliente ha già una scheda attiva: completala o annullala prima', code: 'already_assigned' },
      });
    }

    const assignment = await ProgramAssignment.create({
      programId: program.id,
      coachId: req.user.uid,
      clientId: req.clientId,
      startDate,
      weekdayMap: pickWeekdayMap(req.body.weekdayMap, program) ?? null,
      note: typeof note === 'string' ? note.slice(0, 1000) : null,
    });
    res.status(201).json(assignment);
  } catch (err) { next(err); }
}

// GET /api/coach/clients/:clientId/assignments — storico (tutti gli stati).
async function listForClient(req, res, next) {
  try {
    const rows = await ProgramAssignment.findAll({
      where: { coachId: req.user.uid, clientId: req.clientId },
      include: [{ model: Program, as: 'program', attributes: ['id', 'title', 'weeks', 'status'] }],
      order: [['createdAt', 'DESC']],
    });
    res.json(rows);
  } catch (err) { next(err); }
}

// PUT /api/coach/assignments/:id — solo transizioni di stato in avanti
// (active → completed|cancelled) + weekdayMap/note. Ownership su coachId.
async function update(req, res, next) {
  try {
    const row = await ProgramAssignment.findOne({
      where: { id: req.params.id, coachId: req.user.uid },
      include: [{ model: Program, as: 'program', attributes: ['days'] }],
    });
    if (!row) return res.status(404).json({ error: { message: 'Assegnazione non trovata' } });

    const updates = {};
    if (typeof req.body.status === 'string' && ['completed', 'cancelled'].includes(req.body.status)) {
      if (row.status !== 'active') {
        return res.status(409).json({ error: { message: 'Assegnazione già chiusa', code: 'not_active' } });
      }
      updates.status = req.body.status;
    }
    if (req.body.weekdayMap !== undefined) {
      const map = pickWeekdayMap(req.body.weekdayMap, row.program || { days: [] });
      if (map !== undefined) updates.weekdayMap = map;
    }
    if (req.body.note === null || req.body.note === '') updates.note = null;
    else if (typeof req.body.note === 'string') updates.note = req.body.note.slice(0, 1000);

    await row.update(updates);
    res.json(row);
  } catch (err) { next(err); }
}

// GET /api/coach/clients/:clientId/adherence — dopo loadCoachClient.
async function adherence(req, res, next) {
  try {
    res.json(await clientAdherence(req.user.uid, req.clientId));
  } catch (err) { next(err); }
}

// GET /api/me/program — lato CLIENTE: le schede attive assegnate a me dai coach
// con relazione ancora attiva (se il rapporto è finito, la scheda sparisce).
async function myPrograms(req, res, next) {
  try {
    const assignments = await ProgramAssignment.findAll({
      where: { clientId: req.user.uid, status: 'active' },
      include: [{ model: Program, as: 'program', attributes: ['id', 'title', 'goal', 'weeks', 'days', 'progressions'] }],
      order: [['createdAt', 'DESC']],
    });
    if (!assignments.length) return res.json([]);

    const activeRels = await CoachClient.findAll({
      where: {
        clientId: req.user.uid,
        coachId: { [Op.in]: assignments.map((a) => a.coachId) },
        status: 'active',
      },
      attributes: ['coachId'],
      raw: true,
    });
    const activeCoaches = new Set(activeRels.map((r) => r.coachId));
    const today = new Date().toISOString().slice(0, 10);

    res.json(
      assignments
        .filter((a) => activeCoaches.has(a.coachId))
        .map((a) => ({
          assignment: {
            id: a.id,
            startDate: a.startDate,
            weekdayMap: a.weekdayMap,
            note: a.note,
            coachId: a.coachId,
          },
          program: a.program,
          currentWeek: weekOf(a.startDate, today, a.program.weeks),
        }))
    );
  } catch (err) { next(err); }
}

module.exports = { create, listForClient, update, adherence, myPrograms };
