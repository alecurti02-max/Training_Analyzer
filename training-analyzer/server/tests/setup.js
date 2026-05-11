// Setup env vars BEFORE any src/* require() so config/env.js sees them.
// SQLite in-memory keeps tests hermetic and fast.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'sqlite::memory:';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-do-not-use-in-prod';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-do-not-use-in-prod';
process.env.PORT = '0'; // ephemeral, supertest uses .listen() handle
