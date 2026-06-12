// Integration tests per l'area coach (F1 CRM PT): ruolo trainer, inviti,
// consenso del cliente, letture cross-user gated, pianificazione sul calendario
// del cliente. Stessa strategia di smoke.test.js: SQLite in-memory + supertest.

require('./setup');

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../src/app');
const { sequelize, TrainerProfile, CoachClient } = require('../src/models');
const { promoteTrainersFromEnv } = require('../src/utils/bootstrapTrainers');

function isoDate(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

// 4 utenti: coach (trainer via env-bootstrap), client, bystander (non trainer),
// otherCoach (secondo trainer, per i 403 cross-coach).
const users = {
  coach: { email: 'coach@daemon.fit', password: 'Coach12345', firstName: 'Carla', lastName: 'Coach' },
  client: { email: 'client@daemon.fit', password: 'Client12345', firstName: 'Cleo', lastName: 'Cliente' },
  bystander: { email: 'bystander@daemon.fit', password: 'Bystander1', firstName: 'Bice', lastName: 'Bystander' },
  otherCoach: { email: 'other@daemon.fit', password: 'Other12345', firstName: 'Otto', lastName: 'Altro' },
};
const tokens = {};
const uids = {};
let relationshipId = null;

const auth = (who) => ({ Authorization: `Bearer ${tokens[who]}` });

test.before(async () => {
  await sequelize.sync({ force: true });
  for (const [who, creds] of Object.entries(users)) {
    const res = await request(app).post('/api/auth/register').send(creds);
    assert.equal(res.status, 201, `register ${who}`);
    tokens[who] = res.body.accessToken;
    uids[who] = res.body.user.uid;
  }
});

test.after(async () => {
  await sequelize.close();
});

// ---------- Bootstrap trainer da env ----------

test('promoteTrainersFromEnv crea il TrainerProfile ed è idempotente', async () => {
  process.env.TRAINER_EMAILS = ` ${users.coach.email.toUpperCase()} , nonexiste@daemon.fit `;
  await promoteTrainersFromEnv();
  await promoteTrainersFromEnv(); // secondo giro: nessun errore, nessun duplicato

  const profiles = await TrainerProfile.findAll({ where: { uid: uids.coach } });
  assert.equal(profiles.length, 1);
  assert.equal(profiles[0].status, 'active');
  assert.equal(profiles[0].source, 'seed');

  // il secondo trainer serve più avanti: creato direttamente
  await TrainerProfile.create({ uid: uids.otherCoach, status: 'active', source: 'admin' });
});

test('GET /api/users/me/profile espone trainerProfile solo ai trainer', async () => {
  const coachRes = await request(app).get('/api/users/me/profile').set(auth('coach'));
  assert.equal(coachRes.status, 200);
  assert.equal(coachRes.body.trainerProfile.status, 'active');

  const clientRes = await request(app).get('/api/users/me/profile').set(auth('client'));
  assert.equal(clientRes.status, 200);
  assert.equal(clientRes.body.trainerProfile, null);
});

// ---------- Gate requireTrainer ----------

test('GET /api/coach/clients da non-trainer → 403 not_trainer', async () => {
  const res = await request(app).get('/api/coach/clients').set(auth('bystander'));
  assert.equal(res.status, 403);
  assert.equal(res.body.error.code, 'not_trainer');
});

// ---------- Inviti ----------

test('POST invite: email inesistente → 404, self → 400, ok → 201 pending', async () => {
  const r404 = await request(app).post('/api/coach/clients/invites')
    .set(auth('coach')).send({ email: 'ghost@daemon.fit' });
  assert.equal(r404.status, 404);

  const r400 = await request(app).post('/api/coach/clients/invites')
    .set(auth('coach')).send({ email: users.coach.email });
  assert.equal(r400.status, 400);

  const ok = await request(app).post('/api/coach/clients/invites')
    .set(auth('coach')).send({ email: users.client.email });
  assert.equal(ok.status, 201);
  assert.equal(ok.body.relationship.status, 'pending');
  assert.equal(ok.body.user.uid, uids.client);
  relationshipId = ok.body.relationship.id;
});

test('POST invite duplicato (pending) → 409', async () => {
  const res = await request(app).post('/api/coach/clients/invites')
    .set(auth('coach')).send({ email: users.client.email });
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'already_pending');
});

test('letture cliente PRIMA dell\'accettazione → 403', async () => {
  const res = await request(app)
    .get(`/api/coach/clients/${uids.client}/workouts`).set(auth('coach'));
  assert.equal(res.status, 403);
  assert.equal(res.body.error.code, 'not_coach_of_client');
});

// ---------- Consenso lato cliente ----------

test('accept da un utente che NON è il destinatario → 404', async () => {
  const res = await request(app)
    .post(`/api/me/coach/${relationshipId}/accept`).set(auth('bystander'));
  assert.equal(res.status, 404);
});

test('il cliente vede l\'invito pending e lo accetta', async () => {
  const list = await request(app).get('/api/me/coach').set(auth('client'));
  assert.equal(list.status, 200);
  assert.equal(list.body.length, 1);
  assert.equal(list.body[0].relationship.status, 'pending');
  assert.equal(list.body[0].coach.uid, uids.coach);
  // la vista cliente non espone dati privati del coach
  assert.equal(list.body[0].coach.email, undefined);

  const acc = await request(app)
    .post(`/api/me/coach/${relationshipId}/accept`).set(auth('client'));
  assert.equal(acc.status, 200);
  assert.equal(acc.body.relationship.status, 'active');
});

// ---------- Letture coach dopo il consenso ----------

test('il coach legge workouts/stats del cliente (senza aiAnalysis)', async () => {
  const created = await request(app).post('/api/workouts').set(auth('client')).send({
    type: 'gym',
    date: isoDate(0),
    data: {
      exercises: [{ name: 'Panca Piana', muscle: 'Petto', sets: [{ reps: 8, weight: 60 }] }],
      scores: { overall: 7 },
    },
  });
  assert.equal(created.status, 201);

  const listRes = await request(app)
    .get(`/api/coach/clients/${uids.client}/workouts`).set(auth('coach'));
  assert.equal(listRes.status, 200);
  assert.equal(listRes.body.total, 1);
  assert.equal(listRes.body.workouts[0].type, 'gym');
  assert.ok(!('aiAnalysis' in listRes.body.workouts[0]), 'aiAnalysis non deve essere esposta al coach');

  const detail = await request(app)
    .get(`/api/coach/clients/${uids.client}/workouts/${created.body.id}`).set(auth('coach'));
  assert.equal(detail.status, 200);
  assert.ok(!('aiAnalysis' in detail.body));

  const stats = await request(app)
    .get(`/api/coach/clients/${uids.client}/stats`).set(auth('coach'));
  assert.equal(stats.status, 200);
  assert.equal(stats.body.totalWorkouts, 1);
});

test('roster con includeStats=1 aggrega i contatori', async () => {
  const res = await request(app).get('/api/coach/clients?includeStats=1').set(auth('coach'));
  assert.equal(res.status, 200);
  assert.equal(res.body.length, 1);
  const row = res.body[0];
  assert.equal(row.relationship.status, 'active');
  assert.equal(row.user.uid, uids.client);
  assert.equal(row.workouts7d, 1);
  assert.equal(row.workouts30d, 1);
  assert.equal(row.lastWorkoutDate, isoDate(0));
});

test('un ALTRO trainer non accede ai dati del cliente → 403', async () => {
  const res = await request(app)
    .get(`/api/coach/clients/${uids.client}/workouts`).set(auth('otherCoach'));
  assert.equal(res.status, 403);
});

// ---------- Pianificazione coach sul calendario del cliente ----------

let coachPlanId = null;

test('il coach pianifica una sessione per il cliente (firma createdByCoachId)', async () => {
  const res = await request(app)
    .post(`/api/coach/clients/${uids.client}/planned-workouts`)
    .set(auth('coach'))
    .send({
      date: isoDate(1),
      type: 'gym',
      muscleGroups: ['Petto'],
      exercises: [{ name: 'Panca Piana', muscle: 'Petto', sets: [{ reps: 8, weight: 60 }] }],
      note: 'Push day',
    });
  assert.equal(res.status, 201);
  assert.equal(res.body.createdByCoachId, uids.coach);
  assert.equal(res.body.userId, uids.client);
  coachPlanId = res.body.id;
});

test('il cliente vede il planned del coach nel proprio calendario', async () => {
  const res = await request(app).get('/api/planned-workouts').set(auth('client'));
  assert.equal(res.status, 200);
  const plan = res.body.find((p) => p.id === coachPlanId);
  assert.ok(plan, 'il planned del coach è nella lista del cliente');
  assert.equal(plan.createdByCoachId, uids.coach);
});

test('il coach aggiorna ed elimina SOLO i planned firmati da lui', async () => {
  // planned creato dal cliente in autonomia
  const own = await request(app).post('/api/planned-workouts')
    .set(auth('client')).send({ date: isoDate(3), type: 'running' });
  assert.equal(own.status, 201);

  const updOwn = await request(app)
    .put(`/api/coach/clients/${uids.client}/planned-workouts/${own.body.id}`)
    .set(auth('coach')).send({ note: 'hijack' });
  assert.equal(updOwn.status, 404, 'planned del cliente non modificabile dal coach');

  const delOwn = await request(app)
    .delete(`/api/coach/clients/${uids.client}/planned-workouts/${own.body.id}`)
    .set(auth('coach'));
  assert.equal(delOwn.status, 404, 'planned del cliente non eliminabile dal coach');

  const updCoach = await request(app)
    .put(`/api/coach/clients/${uids.client}/planned-workouts/${coachPlanId}`)
    .set(auth('coach')).send({ note: 'Push day · 5×5' });
  assert.equal(updCoach.status, 200);

  const delCoach = await request(app)
    .delete(`/api/coach/clients/${uids.client}/planned-workouts/${coachPlanId}`)
    .set(auth('coach'));
  assert.equal(delCoach.status, 204);
});

test('upsert coach su una data già pianificata dal cliente → 200, aggiorna ma NON prende la firma', async () => {
  const date = isoDate(5);
  const own = await request(app).post('/api/planned-workouts')
    .set(auth('client')).send({ date, type: 'gym', note: 'mia' });
  assert.equal(own.status, 201);

  const res = await request(app)
    .post(`/api/coach/clients/${uids.client}/planned-workouts`)
    .set(auth('coach')).send({ date, type: 'gym', note: 'del coach' });
  assert.equal(res.status, 200, 'upsert su riga esistente risponde 200 (non 201)');
  assert.equal(res.body.note, 'del coach');
  // La proprietà non viene riassegnata dall'upsert: la riga resta del cliente,
  // quindi il coach non può poi cancellarla via DELETE /:id (mutationWhere).
  assert.equal(res.body.createdByCoachId, null);
  const delRes = await request(app)
    .delete(`/api/coach/clients/${uids.client}/planned-workouts/${own.body.id}`)
    .set(auth('coach'));
  assert.equal(delRes.status, 404);
});

// ---------- Fine rapporto e re-invito ----------

test('il cliente termina il rapporto → letture coach chiuse', async () => {
  const res = await request(app)
    .post(`/api/me/coach/${relationshipId}/end`).set(auth('client'));
  assert.equal(res.status, 200);
  assert.equal(res.body.relationship.status, 'ended');

  const read = await request(app)
    .get(`/api/coach/clients/${uids.client}/workouts`).set(auth('coach'));
  assert.equal(read.status, 403);
});

test('re-invito dopo ended riusa la riga e torna pending', async () => {
  const res = await request(app).post('/api/coach/clients/invites')
    .set(auth('coach')).send({ email: users.client.email });
  assert.equal(res.status, 201);
  assert.equal(res.body.relationship.id, relationshipId, 'stessa riga riusata');
  assert.equal(res.body.relationship.status, 'pending');

  const rel = await CoachClient.findByPk(relationshipId);
  assert.equal(rel.acceptedAt, null);
  assert.equal(rel.endedAt, null);
});

test('il coach revoca un invito pending → 204, sparisce dal lato cliente', async () => {
  const res = await request(app)
    .delete(`/api/coach/clients/${relationshipId}`).set(auth('coach'));
  assert.equal(res.status, 204);

  const list = await request(app).get('/api/me/coach').set(auth('client'));
  assert.equal(list.body.length, 0);
});

test('decline: il cliente rifiuta un invito e il coach può re-invitare', async () => {
  const inv = await request(app).post('/api/coach/clients/invites')
    .set(auth('otherCoach')).send({ email: users.client.email });
  assert.equal(inv.status, 201);

  const dec = await request(app)
    .post(`/api/me/coach/${inv.body.relationship.id}/decline`).set(auth('client'));
  assert.equal(dec.status, 200);
  assert.equal(dec.body.relationship.status, 'declined');

  const again = await request(app).post('/api/coach/clients/invites')
    .set(auth('otherCoach')).send({ email: users.client.email });
  assert.equal(again.status, 201);
  assert.equal(again.body.relationship.status, 'pending');
});
