const crypto = require('crypto');
const { CoachClientProfile, ClientPackage, CoachClient } = require('../models');

// CRM del coach sul cliente: anagrafica+note (coach_client_profiles, 1:1 con la
// relazione) e pacchetti (client_packages). Tutte le route stanno sotto
// /api/coach/* con loadCoachClient (tranne i pacchetti per id, con ownership
// verificata via relazione). NIENTE di tutto questo è mai client-facing.

const MAX_NOTES = 200;

const CONTACT_KEYS = ['phone', 'emergencyName', 'emergencyPhone'];

function pickProfileFields(body) {
  const out = {};
  for (const k of ['goals', 'anamnesis']) {
    if (body[k] === null || body[k] === '') out[k] = null;
    else if (typeof body[k] === 'string') out[k] = body[k].slice(0, 2000);
  }
  if (body.contacts && typeof body.contacts === 'object' && !Array.isArray(body.contacts)) {
    const contacts = {};
    for (const k of CONTACT_KEYS) {
      if (typeof body.contacts[k] === 'string' && body.contacts[k].trim()) contacts[k] = body.contacts[k].slice(0, 80);
    }
    out.contacts = contacts;
  }
  if (Array.isArray(body.tags)) {
    out.tags = body.tags.filter((t) => typeof t === 'string' && t.trim()).slice(0, 20).map((t) => t.slice(0, 30));
  }
  // notes mai dal body: solo via addNote/deleteNote (timeline append-only)
  return out;
}

async function findOrCreateProfile(relationshipId) {
  const [profile] = await CoachClientProfile.findOrCreate({
    where: { relationshipId },
    defaults: { relationshipId },
  });
  return profile;
}

// GET /api/coach/clients/:clientId/profile
async function getProfile(req, res, next) {
  try {
    const profile = await CoachClientProfile.findOne({ where: { relationshipId: req.coachClient.id } });
    res.json(profile || { relationshipId: req.coachClient.id, goals: null, anamnesis: null, contacts: {}, tags: [], notes: [] });
  } catch (err) { next(err); }
}

// PUT /api/coach/clients/:clientId/profile — upsert
async function updateProfile(req, res, next) {
  try {
    const profile = await findOrCreateProfile(req.coachClient.id);
    await profile.update(pickProfileFields(req.body));
    res.json(profile);
  } catch (err) { next(err); }
}

// POST /api/coach/clients/:clientId/notes { text }
async function addNote(req, res, next) {
  try {
    const text = typeof req.body.text === 'string' ? req.body.text.trim().slice(0, 2000) : '';
    if (!text) return res.status(400).json({ error: { message: 'text is required' } });

    const profile = await findOrCreateProfile(req.coachClient.id);
    const notes = Array.isArray(profile.notes) ? profile.notes : [];
    if (notes.length >= MAX_NOTES) {
      return res.status(400).json({ error: { message: `Massimo ${MAX_NOTES} note per cliente`, code: 'notes_full' } });
    }
    const note = { id: crypto.randomUUID(), date: new Date().toISOString(), text };
    await profile.update({ notes: [note, ...notes] });
    res.status(201).json(note);
  } catch (err) { next(err); }
}

// DELETE /api/coach/clients/:clientId/notes/:noteId
async function deleteNote(req, res, next) {
  try {
    const profile = await CoachClientProfile.findOne({ where: { relationshipId: req.coachClient.id } });
    if (!profile) return res.status(404).json({ error: { message: 'Nota non trovata' } });
    const notes = (Array.isArray(profile.notes) ? profile.notes : []).filter((n) => n.id !== req.params.noteId);
    if (notes.length === (profile.notes || []).length) {
      return res.status(404).json({ error: { message: 'Nota non trovata' } });
    }
    await profile.update({ notes });
    res.status(204).end();
  } catch (err) { next(err); }
}

// ---- pacchetti ----

function pickPackageFields(body, { partial = false } = {}) {
  const out = {};
  if (typeof body.title === 'string' && body.title.trim()) out.title = body.title.trim().slice(0, 80);
  if (!partial && typeof body.type === 'string' && ['package', 'subscription'].includes(body.type)) out.type = body.type;
  if (body.totalSessions === null) out.totalSessions = null;
  else if (body.totalSessions !== undefined) {
    const n = Number(body.totalSessions);
    if (Number.isFinite(n)) out.totalSessions = Math.max(1, Math.min(1000, Math.round(n)));
  }
  for (const k of ['startDate', 'expiryDate']) {
    if (body[k] === null) out[k] = null;
    else if (typeof body[k] === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body[k])) out[k] = body[k];
  }
  if (body.price === null || body.price === '') out.price = null;
  else if (body.price !== undefined) {
    const p = Number(body.price);
    if (Number.isFinite(p) && p >= 0) out.price = Math.round(p * 100) / 100;
  }
  if (partial && typeof body.status === 'string' && ['active', 'completed', 'expired', 'cancelled'].includes(body.status)) {
    out.status = body.status;
  }
  if (body.notes === null || body.notes === '') out.notes = null;
  else if (typeof body.notes === 'string') out.notes = body.notes.slice(0, 1000);
  return out;
}

// GET /api/coach/clients/:clientId/packages
async function listPackages(req, res, next) {
  try {
    const rows = await ClientPackage.findAll({
      where: { relationshipId: req.coachClient.id },
      order: [['createdAt', 'DESC']],
    });
    res.json(rows);
  } catch (err) { next(err); }
}

// POST /api/coach/clients/:clientId/packages
async function createPackage(req, res, next) {
  try {
    const data = pickPackageFields(req.body);
    if (!data.title || !data.type || !data.startDate) {
      return res.status(400).json({ error: { message: 'title, type e startDate sono obbligatori' } });
    }
    const row = await ClientPackage.create({ ...data, relationshipId: req.coachClient.id });
    res.status(201).json(row);
  } catch (err) { next(err); }
}

// Ownership dei pacchetti per id: la relazione deve appartenere al coach.
async function findOwnedPackage(packageId, coachId) {
  return ClientPackage.findOne({
    where: { id: packageId },
    include: [{ model: CoachClient, as: 'relationship', where: { coachId }, attributes: ['id', 'coachId'] }],
  });
}

// PUT /api/coach/packages/:id
async function updatePackage(req, res, next) {
  try {
    const row = await findOwnedPackage(req.params.id, req.user.uid);
    if (!row) return res.status(404).json({ error: { message: 'Pacchetto non trovato' } });
    await row.update(pickPackageFields(req.body, { partial: true }));
    res.json(row);
  } catch (err) { next(err); }
}

// POST /api/coach/packages/:id/use — +1 seduta, auto-completed quando pieno
async function usePackage(req, res, next) {
  try {
    const row = await findOwnedPackage(req.params.id, req.user.uid);
    if (!row) return res.status(404).json({ error: { message: 'Pacchetto non trovato' } });
    if (row.status !== 'active') {
      return res.status(400).json({ error: { message: 'Pacchetto non attivo', code: 'not_active' } });
    }
    if (row.totalSessions != null && row.usedSessions >= row.totalSessions) {
      return res.status(400).json({ error: { message: 'Sedute esaurite', code: 'sessions_exhausted' } });
    }
    const usedSessions = row.usedSessions + 1;
    const status = row.totalSessions != null && usedSessions >= row.totalSessions ? 'completed' : row.status;
    await row.update({ usedSessions, status });
    res.json(row);
  } catch (err) { next(err); }
}

module.exports = { getProfile, updateProfile, addNote, deleteNote, listPackages, createPackage, updatePackage, usePackage };
