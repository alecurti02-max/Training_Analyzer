// Integration tests F2 (CRM PT): programs CRUD, assegnazioni, lift _assignment
// nel salvataggio workout, aderenza. SQLite in-memory + supertest.

require('./setup');

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../src/app');
const { sequelize, TrainerProfile, Workout } = require('../src/models');
const { weekOf, expectedPerWeek, progressionFor } = require('../src/services/assignmentMath');

function isoDate(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

const users = {
  coach: { email: 'coach-f2@daemon.fit', password: 'Coach12345', firstName: 'Carla', lastName: 'Coach' },
  client: { email: 'client-f2@daemon.fit', password: 'Client12345', firstName: 'Cleo', lastName: 'Cliente' },
  other: { email: 'other-f2@daemon.fit', password: 'Other12345', firstName: 'Otto', lastName: 'Altro' },
};
const tokens = {};
const uids = {};
let relationshipId = null;
let programId = null;
let assignmentId = null;

const auth = (who) => ({ Authorization: `Bearer ${tokens[who]}` });

const PROGRAM_BODY = {
  title: 'Ipertrofia 4 settimane',
  goal: 'Massa',
  weeks: 4,
  days: [
    {
      key: 'A', label: 'Push', type: 'gym', muscleGroups: ['Petto'],
      exercises: [{ name: 'Panca Piana', muscle: 'Petto', sets: [{ reps: 8, weight: 60 }] }],
    },
    {
      key: 'B', label: 'Pull', type: 'gym', muscleGroups: ['Schiena'],
      exercises: [{ name: 'Trazioni', muscle: 'Schiena', sets: [{ reps: 6, weight: 0 }] }],
    },
  ],
  progressions: [
    { week: 2, loadPct: 105 },
    { week: 4, loadPct: 60, deload: true },
  ],
};

test.before(async () => {
  await sequelize.sync({ force: true });
  for (const [who, creds] of Object.entries(users)) {
    const res = await request(app).post('/api/auth/register').send(creds);
    assert.equal(res.status, 201, `register ${who}`);
    tokens[who] = res.body.accessToken;
    uids[who] = res.body.user.uid;
  }
  await TrainerProfile.create({ uid: uids.coach, status: 'active', source: 'admin' });
  await TrainerProfile.create({ uid: uids.other, status: 'active', source: 'admin' });

  // relazione attiva coach↔client
  const inv = await request(app).post('/api/coach/clients/invites')
    .set(auth('coach')).send({ email: users.client.email });
  relationshipId = inv.body.relationship.id;
  await request(app).post(`/api/me/coach/${relationshipId}/accept`).set(auth('client'));
});

test.after(async () => {
  await sequelize.close();
});

// ---------- unit: assignmentMath ----------

test('weekOf clampa ai bordi e avanza di 7 in 7 giorni', () => {
  assert.equal(weekOf('2026-06-01', '2026-05-20', 4), 1, 'prima dello start → 1');
  assert.equal(weekOf('2026-06-01', '2026-06-01', 4), 1);
  assert.equal(weekOf('2026-06-01', '2026-06-07', 4), 1);
  assert.equal(weekOf('2026-06-01', '2026-06-08', 4), 2);
  assert.equal(weekOf('2026-06-01', '2026-06-22', 4), 4);
  assert.equal(weekOf('2026-06-01', '2026-12-01', 4), 4, 'oltre la durata → clamp a weeks');
});

test('expectedPerWeek: weekdayMap se presente, altrimenti numero di giornate', () => {
  const program = { days: [{ key: 'A' }, { key: 'B' }, { key: 'C' }] };
  assert.equal(expectedPerWeek(program, { weekdayMap: null }), 3);
  assert.equal(expectedPerWeek(program, { weekdayMap: { A: 1, B: 4 } }), 2);
});

test('progressionFor: default 100 e flag deload', () => {
  const prog = PROGRAM_BODY.progressions;
  assert.deepEqual(progressionFor(prog, 1), { loadPct: 100, deload: false, note: null });
  assert.equal(progressionFor(prog, 2).loadPct, 105);
  assert.equal(progressionFor(prog, 4).deload, true);
});

// ---------- programs CRUD ----------

test('CRUD programs: create bounded, lista solo proprie, update, duplicate', async () => {
  const created = await request(app).post('/api/coach/programs')
    .set(auth('coach')).send({ ...PROGRAM_BODY, weeks: 99, status: 'active' });
  assert.equal(created.status, 201);
  assert.equal(created.body.weeks, 52, 'weeks clampate a 52');
  assert.equal(created.body.days.length, 2);
  programId = created.body.id;

  const upd = await request(app).put(`/api/coach/programs/${programId}`)
    .set(auth('coach')).send({ weeks: 4 });
  assert.equal(upd.status, 200);
  assert.equal(upd.body.weeks, 4);
  assert.equal(upd.body.title, PROGRAM_BODY.title, 'update parziale non tocca il titolo');

  const otherList = await request(app).get('/api/coach/programs').set(auth('other'));
  assert.equal(otherList.body.length, 0, 'altro coach non vede le schede');

  const otherGet = await request(app).get(`/api/coach/programs/${programId}`).set(auth('other'));
  assert.equal(otherGet.status, 404);

  const dup = await request(app).post(`/api/coach/programs/${programId}/duplicate`).set(auth('coach'));
  assert.equal(dup.status, 201);
  assert.equal(dup.body.status, 'draft');
  assert.ok(dup.body.title.includes('(copia)'));
  await request(app).delete(`/api/coach/programs/${dup.body.id}`).set(auth('coach')).expect(204);
});

test('create senza titolo → 400; non-trainer → 403', async () => {
  const r400 = await request(app).post('/api/coach/programs').set(auth('coach')).send({ weeks: 4 });
  assert.equal(r400.status, 400);
  const r403 = await request(app).get('/api/coach/programs').set(auth('client'));
  assert.equal(r403.status, 403);
});

// ---------- assignment ----------

test('assegnazione: ok, 409 duplicata, weekdayMap filtrata sui dayKey validi', async () => {
  const res = await request(app)
    .post(`/api/coach/clients/${uids.client}/assignments`)
    .set(auth('coach'))
    .send({ programId, startDate: isoDate(-8), weekdayMap: { A: 1, B: 4, Z: 6, X: 99 } });
  assert.equal(res.status, 201);
  assert.deepEqual(res.body.weekdayMap, { A: 1, B: 4 }, 'chiavi non esistenti/valori invalidi scartati');
  assignmentId = res.body.id;

  const dup = await request(app)
    .post(`/api/coach/clients/${uids.client}/assignments`)
    .set(auth('coach')).send({ programId, startDate: isoDate(0) });
  assert.equal(dup.status, 409);
});

test('scheda archiviata non assegnabile; delete con assignment attivo → 409', async () => {
  const arch = await request(app).post('/api/coach/programs')
    .set(auth('coach')).send({ title: 'Vecchia', status: 'archived', days: [] });
  const res = await request(app)
    .post(`/api/coach/clients/${uids.client}/assignments`)
    .set(auth('coach')).send({ programId: arch.body.id, startDate: isoDate(0) });
  assert.equal(res.status, 409);

  const del = await request(app).delete(`/api/coach/programs/${programId}`).set(auth('coach'));
  assert.equal(del.status, 409);
  assert.equal(del.body.error.code, 'has_active_assignments');
});

test('GET /api/me/program: il cliente vede la scheda con currentWeek calcolata', async () => {
  const res = await request(app).get('/api/me/program').set(auth('client'));
  assert.equal(res.status, 200);
  assert.equal(res.body.length, 1);
  const row = res.body[0];
  assert.equal(row.program.title, PROGRAM_BODY.title);
  assert.equal(row.currentWeek, 2, 'start 8 giorni fa → settimana 2');
  assert.equal(row.assignment.id, assignmentId);

  const other = await request(app).get('/api/me/program').set(auth('other'));
  assert.deepEqual(other.body, []);
});

// ---------- lift _assignment nel salvataggio workout ----------

test('workout con _assignment valido → colonne popolate, week calcolata server-side', async () => {
  const res = await request(app).post('/api/workouts').set(auth('client')).send({
    type: 'gym',
    date: isoDate(0),
    data: {
      exercises: [{ name: 'Panca Piana', muscle: 'Petto', sets: [{ reps: 8, weight: 63 }] }],
      scores: { overall: 7.5 },
      _assignment: { assignmentId, dayKey: 'A', week: 99 }, // week forgiata: ignorata
    },
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.assignmentId, assignmentId);
  assert.equal(res.body.assignmentDayKey, 'A');
  assert.equal(res.body.assignmentWeek, 2, 'settimana dal server, non dal client');
});

test('workout con assignmentId di un ALTRO utente → meta scartata, workout salvato', async () => {
  const res = await request(app).post('/api/workouts').set(auth('other')).send({
    type: 'gym',
    date: isoDate(0),
    data: { exercises: [], _assignment: { assignmentId, dayKey: 'A' } },
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.assignmentId ?? null, null);
  assert.equal(res.body.assignmentWeek ?? null, null);
});

// ---------- pin giorno-scheda su planned workout ----------

test('pin coach con assignmentId proprio → salvato; forgiato → ripulito', async () => {
  const ok = await request(app)
    .post(`/api/coach/clients/${uids.client}/planned-workouts`)
    .set(auth('coach'))
    .send({ date: isoDate(2), type: 'gym', assignmentId, dayKey: 'B' });
  assert.equal(ok.status, 201);
  assert.equal(ok.body.assignmentId, assignmentId);
  assert.equal(ok.body.dayKey, 'B');

  // l'ALTRO coach non ha relazione col cliente → niente route; il forging si
  // testa col coach giusto ma assignmentId inesistente
  const forged = await request(app)
    .post(`/api/coach/clients/${uids.client}/planned-workouts`)
    .set(auth('coach'))
    .send({ date: isoDate(3), type: 'gym', assignmentId: '00000000-0000-4000-8000-000000000000', dayKey: 'A' });
  assert.equal(forged.status, 201);
  assert.equal(forged.body.assignmentId ?? null, null, 'riferimento non valido rimosso');
});

// ---------- adherence ----------

test('adherence: perWeek/totali corretti e lastWorkoutDate', async () => {
  // un secondo workout agganciato, settimana 1 (data = startDate)
  await request(app).post('/api/workouts').set(auth('client')).send({
    type: 'gym',
    date: isoDate(-8),
    data: { exercises: [], _assignment: { assignmentId, dayKey: 'B' } },
  });

  const res = await request(app)
    .get(`/api/coach/clients/${uids.client}/adherence`).set(auth('coach'));
  assert.equal(res.status, 200);
  assert.equal(res.body.assignment.id, assignmentId);
  assert.equal(res.body.assignment.currentWeek, 2);
  // weekdayMap {A,B} → expected 2 a settimana; done: w1=1, w2=1
  assert.deepEqual(res.body.perWeek, [
    { week: 1, expected: 2, done: 1 },
    { week: 2, expected: 2, done: 1 },
  ]);
  assert.equal(res.body.totals.pct, 50);
  assert.equal(res.body.lastWorkoutDate, isoDate(0));
  assert.equal(res.body.daysInactive, 0);
});

test('roster includeStats espone activeAssignment con adherencePct', async () => {
  const res = await request(app).get('/api/coach/clients?includeStats=1').set(auth('coach'));
  assert.equal(res.status, 200);
  const row = res.body.find((r) => r.user.uid === uids.client);
  assert.ok(row.activeAssignment);
  assert.equal(row.activeAssignment.title, PROGRAM_BODY.title);
  assert.equal(row.activeAssignment.currentWeek, 2);
  assert.equal(row.activeAssignment.adherencePct, 50);
});

// ---------- chiusure ----------

test('PUT assignment: completed; secondo update → 409; me/program vuoto', async () => {
  const res = await request(app).put(`/api/coach/assignments/${assignmentId}`)
    .set(auth('coach')).send({ status: 'completed' });
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'completed');

  const again = await request(app).put(`/api/coach/assignments/${assignmentId}`)
    .set(auth('coach')).send({ status: 'cancelled' });
  assert.equal(again.status, 409);

  const my = await request(app).get('/api/me/program').set(auth('client'));
  assert.deepEqual(my.body, []);

  const otherPut = await request(app).put(`/api/coach/assignments/${assignmentId}`)
    .set(auth('other')).send({ status: 'completed' });
  assert.equal(otherPut.status, 404, 'ownership su coachId');
});

test('relazione terminata → la scheda sparisce da /api/me/program', async () => {
  // nuova assegnazione attiva, poi il cliente chiude il rapporto
  const re = await request(app)
    .post(`/api/coach/clients/${uids.client}/assignments`)
    .set(auth('coach')).send({ programId, startDate: isoDate(0) });
  assert.equal(re.status, 201);

  await request(app).post(`/api/me/coach/${relationshipId}/end`).set(auth('client'));
  const my = await request(app).get('/api/me/program').set(auth('client'));
  assert.deepEqual(my.body, [], 'rapporto chiuso → niente scheda');
});

// NB: l'ON DELETE SET NULL su workouts.assignmentId è definito nella migration
// (PG); i test girano su SQLite via sync() che non replica la clausola, quindi
// la verifica del SET NULL avviene sull'e2e Postgres locale, non qui.
test('lo storico workout resta leggibile con riferimento scheda', async () => {
  const w = await Workout.findOne({ where: { userId: uids.client, assignmentId } });
  assert.ok(w, 'workout agganciato presente');
  assert.equal(w.assignmentDayKey, 'A');
});
