// Integration tests F3 (CRM PT): anagrafica+note private, pacchetti, sharing
// opt-in. Include l'assert di PRIVACY: i dati CRM del coach non compaiono MAI
// nelle risposte client-facing.

require('./setup');

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../src/app');
const { sequelize, TrainerProfile } = require('../src/models');

function isoDate(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

const users = {
  coach: { email: 'coach-f3@daemon.fit', password: 'Coach12345', firstName: 'Carla', lastName: 'Coach' },
  client: { email: 'client-f3@daemon.fit', password: 'Client12345', firstName: 'Cleo', lastName: 'Cliente' },
  otherCoach: { email: 'other-f3@daemon.fit', password: 'Other12345', firstName: 'Otto', lastName: 'Altro' },
};
const tokens = {};
const uids = {};
let relationshipId = null;
let packageId = null;

const auth = (who) => ({ Authorization: `Bearer ${tokens[who]}` });

test.before(async () => {
  await sequelize.sync({ force: true });
  for (const [who, creds] of Object.entries(users)) {
    const res = await request(app).post('/api/auth/register').send(creds);
    tokens[who] = res.body.accessToken;
    uids[who] = res.body.user.uid;
  }
  await TrainerProfile.create({ uid: uids.coach, status: 'active', source: 'admin' });
  await TrainerProfile.create({ uid: uids.otherCoach, status: 'active', source: 'admin' });
  const inv = await request(app).post('/api/coach/clients/invites')
    .set(auth('coach')).send({ email: users.client.email });
  relationshipId = inv.body.relationship.id;
  await request(app).post(`/api/me/coach/${relationshipId}/accept`).set(auth('client'));
});

test.after(async () => {
  await sequelize.close();
});

// ---------- anagrafica + note ----------

test('profilo CRM: GET vuoto, PUT upsert bounded, contacts whitelisted', async () => {
  const empty = await request(app)
    .get(`/api/coach/clients/${uids.client}/profile`).set(auth('coach'));
  assert.equal(empty.status, 200);
  assert.equal(empty.body.goals, null);

  const upd = await request(app)
    .put(`/api/coach/clients/${uids.client}/profile`)
    .set(auth('coach'))
    .send({
      goals: 'Ricomposizione corporea',
      anamnesis: 'Pregressa lombalgia, evitare stacchi pesanti',
      contacts: { phone: '333 1234567', emergencyName: 'Mario', hacker: 'iniettato' },
      tags: ['principiante', 'mattina'],
      notes: [{ id: 'x', text: 'iniettata dal body' }], // deve essere ignorato
    });
  assert.equal(upd.status, 200);
  assert.equal(upd.body.goals, 'Ricomposizione corporea');
  assert.equal(upd.body.contacts.phone, '333 1234567');
  assert.equal(upd.body.contacts.hacker, undefined, 'chiavi contacts non whitelisted scartate');
  assert.deepEqual(upd.body.tags, ['principiante', 'mattina']);
  assert.deepEqual(upd.body.notes, [], 'notes non scrivibili via PUT');
});

test('note: append, cap testo, delete; altro coach non vede nulla', async () => {
  const n1 = await request(app)
    .post(`/api/coach/clients/${uids.client}/notes`)
    .set(auth('coach')).send({ text: 'Prima seduta: buona mobilità' });
  assert.equal(n1.status, 201);
  assert.ok(n1.body.id);

  const empty = await request(app)
    .post(`/api/coach/clients/${uids.client}/notes`)
    .set(auth('coach')).send({ text: '   ' });
  assert.equal(empty.status, 400);

  const prof = await request(app)
    .get(`/api/coach/clients/${uids.client}/profile`).set(auth('coach'));
  assert.equal(prof.body.notes.length, 1);

  // l'ALTRO coach non ha relazione attiva → 403 su tutto il CRM
  const other = await request(app)
    .get(`/api/coach/clients/${uids.client}/profile`).set(auth('otherCoach'));
  assert.equal(other.status, 403);

  const del = await request(app)
    .delete(`/api/coach/clients/${uids.client}/notes/${n1.body.id}`).set(auth('coach'));
  assert.equal(del.status, 204);

  const delAgain = await request(app)
    .delete(`/api/coach/clients/${uids.client}/notes/${n1.body.id}`).set(auth('coach'));
  assert.equal(delAgain.status, 404);
});

// ---------- PRIVACY HARD RULE ----------

test('PRIVACY: goals/anamnesis/notes mai nelle risposte client-facing', async () => {
  await request(app)
    .post(`/api/coach/clients/${uids.client}/notes`)
    .set(auth('coach')).send({ text: 'NOTA-SEGRETA-DEL-COACH' });

  const responses = await Promise.all([
    request(app).get('/api/me/coach').set(auth('client')),
    request(app).get('/api/me/program').set(auth('client')),
    request(app).get('/api/users/me/profile').set(auth('client')),
  ]);
  for (const res of responses) {
    const raw = JSON.stringify(res.body);
    assert.ok(!raw.includes('NOTA-SEGRETA-DEL-COACH'), 'le note del coach non devono raggiungere il cliente');
    assert.ok(!raw.includes('anamnesis'), 'anamnesis non deve raggiungere il cliente');
    assert.ok(!raw.includes('lombalgia'), 'il contenuto dell\'anamnesi non deve raggiungere il cliente');
  }
});

// ---------- sharing opt-in ----------

test('sharing default OFF → 403 su weights/misure/nutrition/sleep', async () => {
  for (const path of ['weights', 'body-measurements', 'nutrition', 'sleep']) {
    const res = await request(app)
      .get(`/api/coach/clients/${uids.client}/${path}`).set(auth('coach'));
    assert.equal(res.status, 403, `${path} default off`);
    assert.equal(res.body.error.code, 'sharing_disabled');
  }
});

test('il cliente attiva body → weights 200; nutrition resta 403; off → di nuovo 403', async () => {
  // dato reale da leggere
  await request(app).post('/api/weights').set(auth('client')).send({ date: isoDate(0), value: 70.5 });

  const upd = await request(app)
    .put(`/api/me/coach/${relationshipId}/sharing`).set(auth('client')).send({ body: true });
  assert.equal(upd.status, 200);
  assert.equal(upd.body.relationship.sharing.body, true);

  const weights = await request(app)
    .get(`/api/coach/clients/${uids.client}/weights`).set(auth('coach'));
  assert.equal(weights.status, 200);
  assert.equal(weights.body.length, 1);
  assert.equal(Number(weights.body[0].value), 70.5);

  const nutrition = await request(app)
    .get(`/api/coach/clients/${uids.client}/nutrition`).set(auth('coach'));
  assert.equal(nutrition.status, 403, 'nutrition resta off');

  await request(app)
    .put(`/api/me/coach/${relationshipId}/sharing`).set(auth('client')).send({ body: false });
  const after = await request(app)
    .get(`/api/coach/clients/${uids.client}/weights`).set(auth('coach'));
  assert.equal(after.status, 403, 'revoca immediata');
});

test('il coach NON può toccare lo sharing (route solo lato cliente)', async () => {
  const res = await request(app)
    .put(`/api/me/coach/${relationshipId}/sharing`).set(auth('coach')).send({ body: true });
  assert.equal(res.status, 404, 'il coach non è il clientId della relazione');
});

// ---------- pacchetti ----------

test('pacchetti: create bounded, use con guard e auto-completed', async () => {
  const bad = await request(app)
    .post(`/api/coach/clients/${uids.client}/packages`)
    .set(auth('coach')).send({ title: '10 lezioni' });
  assert.equal(bad.status, 400, 'type e startDate obbligatori');

  const created = await request(app)
    .post(`/api/coach/clients/${uids.client}/packages`)
    .set(auth('coach'))
    .send({ type: 'package', title: '2 lezioni di prova', totalSessions: 2, startDate: isoDate(0), expiryDate: isoDate(10), price: 90 });
  assert.equal(created.status, 201);
  assert.equal(created.body.usedSessions, 0);
  packageId = created.body.id;

  const u1 = await request(app).post(`/api/coach/packages/${packageId}/use`).set(auth('coach'));
  assert.equal(u1.body.usedSessions, 1);
  assert.equal(u1.body.status, 'active');

  const u2 = await request(app).post(`/api/coach/packages/${packageId}/use`).set(auth('coach'));
  assert.equal(u2.body.usedSessions, 2);
  assert.equal(u2.body.status, 'completed', 'auto-completed quando pieno');

  const u3 = await request(app).post(`/api/coach/packages/${packageId}/use`).set(auth('coach'));
  assert.equal(u3.status, 400);
});

test('ownership pacchetti: altro coach → 404 su update/use', async () => {
  const upd = await request(app)
    .put(`/api/coach/packages/${packageId}`).set(auth('otherCoach')).send({ title: 'hijack' });
  assert.equal(upd.status, 404);
  const use = await request(app)
    .post(`/api/coach/packages/${packageId}/use`).set(auth('otherCoach'));
  assert.equal(use.status, 404);
});

test('roster: packageAlerts su scadenza ravvicinata o sedute residue ≤2', async () => {
  // pacchetto attivo in scadenza tra 5 giorni
  await request(app)
    .post(`/api/coach/clients/${uids.client}/packages`)
    .set(auth('coach'))
    .send({ type: 'subscription', title: 'Mensile', startDate: isoDate(-25), expiryDate: isoDate(5) });

  const res = await request(app).get('/api/coach/clients?includeStats=1').set(auth('coach'));
  const row = res.body.find((r) => r.user.uid === uids.client);
  assert.ok(Array.isArray(row.packageAlerts), 'alert presenti');
  const alert = row.packageAlerts.find((a) => a.title === 'Mensile');
  assert.ok(alert, 'il mensile in scadenza è segnalato');
  assert.equal(alert.expiryDate, isoDate(5));
});

test('fine relazione → CRM e dati condivisi chiusi (403)', async () => {
  await request(app)
    .put(`/api/me/coach/${relationshipId}/sharing`).set(auth('client')).send({ body: true });
  await request(app).post(`/api/me/coach/${relationshipId}/end`).set(auth('client'));

  for (const path of ['profile', 'packages', 'weights']) {
    const res = await request(app)
      .get(`/api/coach/clients/${uids.client}/${path}`).set(auth('coach'));
    assert.equal(res.status, 403, `${path} chiuso dopo end`);
  }
});
