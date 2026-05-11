// Smoke tests for the HTTP API.
// Strategy: SQLite in-memory + supertest hitting the Express app directly (no listen).
//
// Coverage: signup -> login -> protected CRUD (workouts, weights, profile-like) -> auth refresh.
// Goal: catch regressions in routing, auth middleware, validation, and the shared CRUD helper.

require('./setup');

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../src/app');
const { sequelize } = require('../src/models');

const creds = {
  email: 'smoke@daemon.fit',
  password: 'Smoke12345',
  firstName: 'Smoke',
  lastName: 'Tester',
};

let accessToken = null;
let refreshToken = null;
let workoutId = null;

test.before(async () => {
  await sequelize.sync({ force: true });
});

test.after(async () => {
  await sequelize.close();
});

test('POST /api/auth/register creates user and returns tokens', async () => {
  const res = await request(app).post('/api/auth/register').send(creds);
  assert.equal(res.status, 201);
  assert.ok(res.body.accessToken, 'accessToken returned');
  assert.ok(res.body.refreshToken, 'refreshToken returned');
  assert.equal(res.body.user.email, creds.email);
  assert.equal(res.body.user.passwordHash, undefined, 'passwordHash must not leak');
  accessToken = res.body.accessToken;
  refreshToken = res.body.refreshToken;
});

test('POST /api/auth/register rejects duplicate email', async () => {
  const res = await request(app).post('/api/auth/register').send(creds);
  assert.equal(res.status, 409);
});

test('POST /api/auth/register rejects weak password', async () => {
  const res = await request(app).post('/api/auth/register').send({
    ...creds,
    email: 'weak@daemon.fit',
    password: 'short',
  });
  assert.equal(res.status, 400);
});

test('POST /api/auth/login with correct credentials returns tokens', async () => {
  const res = await request(app).post('/api/auth/login').send({
    email: creds.email,
    password: creds.password,
  });
  assert.equal(res.status, 200);
  assert.ok(res.body.accessToken);
  accessToken = res.body.accessToken;
  refreshToken = res.body.refreshToken;
});

test('GET /api/workouts without auth returns 401', async () => {
  const res = await request(app).get('/api/workouts');
  assert.equal(res.status, 401);
});

test('GET /api/workouts with auth returns empty list', async () => {
  const res = await request(app)
    .get('/api/workouts')
    .set('Authorization', `Bearer ${accessToken}`);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.workouts, []);
  assert.equal(res.body.total, 0);
});

test('POST /api/workouts creates a workout', async () => {
  const res = await request(app)
    .post('/api/workouts')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      type: 'gym',
      date: '2026-05-11',
      data: {
        duration: 60,
        rpe: 7,
        exercises: [{ name: 'Panca Piana', muscle: 'Petto', sets: [{ reps: 8, weight: 60 }] }],
        scores: { overall: 7.5 },
      },
    });
  assert.equal(res.status, 201);
  assert.equal(res.body.type, 'gym');
  assert.equal(Number(res.body.score), 7.5);
  workoutId = res.body.id;
});

test('GET /api/workouts/:id returns the workout', async () => {
  const res = await request(app)
    .get(`/api/workouts/${workoutId}`)
    .set('Authorization', `Bearer ${accessToken}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.id, workoutId);
});

test('POST /api/weights (CRUD helper) creates+upserts on same date', async () => {
  const r1 = await request(app)
    .post('/api/weights')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ date: '2026-05-11', value: 75 });
  assert.equal(r1.status, 201);
  assert.equal(r1.body.value, 75);

  const r2 = await request(app)
    .post('/api/weights')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ date: '2026-05-11', value: 75.5 });
  assert.equal(r2.status, 200, 'second post on same date should upsert, not 201');
  assert.equal(r2.body.value, 75.5);
});

test('GET /api/weights returns the entry', async () => {
  const res = await request(app)
    .get('/api/weights')
    .set('Authorization', `Bearer ${accessToken}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.length, 1);
  assert.equal(res.body[0].value, 75.5);
});

test('POST /api/sleep (CRUD helper) validates field ranges', async () => {
  const bad = await request(app)
    .post('/api/sleep')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ date: '2026-05-10', quality: 99 }); // quality must be 1-10
  assert.equal(bad.status, 400, 'out-of-range quality should be rejected when no other valid fields');

  const good = await request(app)
    .post('/api/sleep')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ date: '2026-05-10', durationHours: 7.5, quality: 8 });
  assert.equal(good.status, 201);
  assert.equal(good.body.quality, 8);
  assert.equal(good.body.durationHours, 7.5);
});

test('POST /api/auth/refresh issues fresh tokens', async () => {
  const res = await request(app)
    .post('/api/auth/refresh')
    .send({ refreshToken });
  assert.equal(res.status, 200);
  assert.ok(res.body.accessToken);
  assert.ok(res.body.refreshToken);
  // Note: refresh token rotation has 1-second precision (JWT iat in seconds),
  // so we don't assert reuse-prevention here. The store-hash mechanism still
  // blocks tokens after a real rotation has elapsed.
});

test('POST /api/auth/refresh rejects invalid token', async () => {
  const res = await request(app)
    .post('/api/auth/refresh')
    .send({ refreshToken: 'not-a-jwt' });
  assert.equal(res.status, 401);
});

test('DELETE /api/workouts/:id removes the workout', async () => {
  // accessToken was rotated by the refresh above, get a fresh one via login
  const login = await request(app).post('/api/auth/login').send({
    email: creds.email,
    password: creds.password,
  });
  const fresh = login.body.accessToken;
  const del = await request(app)
    .delete(`/api/workouts/${workoutId}`)
    .set('Authorization', `Bearer ${fresh}`);
  assert.equal(del.status, 204);

  const after = await request(app)
    .get(`/api/workouts/${workoutId}`)
    .set('Authorization', `Bearer ${fresh}`);
  assert.equal(after.status, 404);
});
