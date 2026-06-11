const { Op, fn, col } = require('sequelize');
const { Workout, Program, ProgramAssignment } = require('../models');
const { weekOf, expectedPerWeek } = require('./assignmentMath');

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// Aderenza del cliente alla scheda attiva del coach: settimane trascorse vs
// workout agganciati (assignmentWeek). lastWorkoutDate/daysInactive sono su
// TUTTI i workout del cliente (un cliente che si allena fuori scheda non è
// "inattivo"). Una sola query aggregata per i conteggi (GROUP BY, SQLite-safe).
async function clientAdherence(coachId, clientId) {
  const today = todayStr();

  const [assignment, lastRow] = await Promise.all([
    ProgramAssignment.findOne({
      where: { coachId, clientId, status: 'active' },
      include: [{ model: Program, as: 'program', attributes: ['id', 'title', 'weeks', 'days', 'progressions'] }],
      order: [['createdAt', 'DESC']],
    }),
    Workout.findOne({
      where: { userId: clientId },
      attributes: [[fn('MAX', col('date')), 'last']],
      raw: true,
    }),
  ]);

  const lastWorkoutDate = lastRow?.last || null;
  const daysInactive = lastWorkoutDate
    ? Math.floor((Date.parse(today) - Date.parse(lastWorkoutDate)) / 86400000)
    : null;

  if (!assignment || !assignment.program) {
    return { assignment: null, perWeek: [], totals: { expected: 0, done: 0, pct: null }, lastWorkoutDate, daysInactive };
  }

  const program = assignment.program;
  const currentWeek = weekOf(assignment.startDate, today, program.weeks);
  const perWeekExpected = expectedPerWeek(program, assignment);

  const doneRows = await Workout.findAll({
    where: { assignmentId: assignment.id, assignmentWeek: { [Op.ne]: null } },
    attributes: ['assignmentWeek', [fn('COUNT', col('id')), 'done']],
    group: ['assignmentWeek'],
    raw: true,
  });
  const doneByWeek = {};
  doneRows.forEach((r) => { doneByWeek[r.assignmentWeek] = Number(r.done); });

  const perWeek = [];
  for (let w = 1; w <= currentWeek; w += 1) {
    perWeek.push({ week: w, expected: perWeekExpected, done: doneByWeek[w] || 0 });
  }
  const totals = perWeek.reduce(
    (acc, r) => ({ expected: acc.expected + r.expected, done: acc.done + r.done, pct: null }),
    { expected: 0, done: 0, pct: null }
  );
  totals.pct = totals.expected > 0 ? Math.min(100, Math.round((totals.done / totals.expected) * 100)) : null;

  return {
    assignment: {
      id: assignment.id,
      programId: program.id,
      programTitle: program.title,
      weeks: program.weeks,
      currentWeek,
      startDate: assignment.startDate,
      weekdayMap: assignment.weekdayMap,
      status: assignment.status,
    },
    perWeek,
    totals,
    lastWorkoutDate,
    daysInactive,
  };
}

// Estensione del roster (coachClientsController): assignment attivi + aderenza
// percentuale per una lista di clientIds, in 2 query raggruppate (no N+1).
async function rosterAssignments(coachId, clientIds) {
  if (!clientIds.length) return {};
  const today = todayStr();

  const assignments = await ProgramAssignment.findAll({
    where: { coachId, clientId: { [Op.in]: clientIds }, status: 'active' },
    include: [{ model: Program, as: 'program', attributes: ['title', 'weeks', 'days'] }],
  });
  if (!assignments.length) return {};

  const counts = await Workout.findAll({
    // stesso filtro di clientAdherence: contano solo i workout con settimana
    // valorizzata (coerenza tra roster e dettaglio)
    where: { assignmentId: { [Op.in]: assignments.map((a) => a.id) }, assignmentWeek: { [Op.ne]: null } },
    attributes: ['assignmentId', [fn('COUNT', col('id')), 'done']],
    group: ['assignmentId'],
    raw: true,
  });
  const doneById = {};
  counts.forEach((r) => { doneById[r.assignmentId] = Number(r.done); });

  const out = {};
  for (const a of assignments) {
    const currentWeek = weekOf(a.startDate, today, a.program.weeks);
    const expected = currentWeek * expectedPerWeek(a.program, a);
    const done = doneById[a.id] || 0;
    out[a.clientId] = {
      activeAssignment: {
        id: a.id,
        title: a.program.title,
        currentWeek,
        weeks: a.program.weeks,
        adherencePct: expected > 0 ? Math.min(100, Math.round((done / expected) * 100)) : null,
      },
    };
  }
  return out;
}

module.exports = { clientAdherence, rosterAssignments };
