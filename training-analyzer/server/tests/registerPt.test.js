// Test F4 (CRM PT): registrazione self-serve del Personal Trainer via flag
// asTrainer (pagina /register-pt) + rate limit sugli inviti.

require('./setup');

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../src/app');
const { sequelize } = require('../src/models');

test.before(async () => {
  await sequelize.sync({ force: true });
});

test.after(async () => {
  await sequelize.close();
});

test('register con asTrainer:true → trainerProfile attivo (source self_serve)', async () => {
  const res = await request(app).post('/api/auth/register').send({
    email: 'pt-f4@daemon.fit', password: 'Trainer123', firstName: 'Pia', lastName: 'Trainer',
    asTrainer: true,
  });
  assert.equal(res.status, 201);

  const profile = await request(app)
    .get('/api/users/me/profile')
    .set('Authorization', `Bearer ${res.body.accessToken}`);
  assert.equal(profile.body.trainerProfile.status, 'active');
  assert.equal(profile.body.trainerProfile.source, 'self_serve');

  // e l'area coach è subito accessibile
  const coach = await request(app)
    .get('/api/coach/clients')
    .set('Authorization', `Bearer ${res.body.accessToken}`);
  assert.equal(coach.status, 200);
});

test('register senza flag → nessun trainerProfile', async () => {
  const res = await request(app).post('/api/auth/register').send({
    email: 'user-f4@daemon.fit', password: 'Utente1234', firstName: 'Ugo', lastName: 'Utente',
  });
  assert.equal(res.status, 201);

  const profile = await request(app)
    .get('/api/users/me/profile')
    .set('Authorization', `Bearer ${res.body.accessToken}`);
  assert.equal(profile.body.trainerProfile, null);
});

test('register con asTrainer non booleano → 400', async () => {
  const res = await request(app).post('/api/auth/register').send({
    email: 'bad-f4@daemon.fit', password: 'Utente1234', firstName: 'Bo', lastName: 'Gus',
    asTrainer: 'sì',
  });
  assert.equal(res.status, 400);
});

test('asTrainer truthy-ma-non-true (es. stringa "true") non crea il profilo da solo', async () => {
  // express-validator accetta "true" come boolean string: il controller però
  // crea il profilo SOLO su `=== true`... "true" stringa passa la validazione
  // ma non il check strict → niente profilo. Comportamento intenzionale.
  const res = await request(app).post('/api/auth/register').send({
    email: 'stringtrue-f4@daemon.fit', password: 'Utente1234', firstName: 'St', lastName: 'Ring',
    asTrainer: 'true',
  });
  assert.equal(res.status, 201);
  const profile = await request(app)
    .get('/api/users/me/profile')
    .set('Authorization', `Bearer ${res.body.accessToken}`);
  assert.equal(profile.body.trainerProfile, null);
});
