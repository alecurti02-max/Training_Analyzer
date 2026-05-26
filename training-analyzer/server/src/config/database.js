const { Sequelize } = require('sequelize');

const databaseUrl =
  process.env.DATABASE_URL ||
  'postgres://ta_user:ta_pass@localhost:5432/training_analyzer';

const isProduction = process.env.NODE_ENV === 'production';
// SQLite is used in-process for the smoke test suite (server/tests/), so we
// detect the dialect from the URL rather than hardcoding postgres.
const isSqlite = databaseUrl.startsWith('sqlite:');
const dialect = isSqlite ? 'sqlite' : 'postgres';

// Neon-tuned settings for production:
// - ssl required (Neon enforces sslmode=require)
// - connectionTimeoutMillis 10s to absorb Neon compute cold starts (~300-500ms + network)
// - keepAlive to keep sockets healthy through Neon's proxy layer
// - statement_timeout aborts a single runaway query after 30s instead of
//   pinning the connection until TCP gives up (pool max=5, easy DoS otherwise)
// - idle_in_transaction_session_timeout guards against leaked transactions
const productionDialectOptions = {
  ssl: { require: true, rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
  keepAlive: true,
  statement_timeout: 30000,
  idle_in_transaction_session_timeout: 60000,
};

// Pool tuned for Neon: Neon kills idle connections after ~5 min, so we release
// them from the pool well before that (5s) and check for evictions every 5s.
// acquire=30000 gives enough headroom for a cold-start + handshake.
const productionPool = {
  max: 5,
  min: 0,
  idle: 5000,
  acquire: 30000,
  evict: 5000,
};

const sequelize = new Sequelize(databaseUrl, {
  dialect,
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  pool: isProduction ? productionPool : { max: 5, min: 0, idle: 10000 },
  dialectOptions: isProduction ? productionDialectOptions : {},
});

async function connectDB() {
  await sequelize.authenticate();
  console.log('PostgreSQL connected');
}

// sequelize-cli config export — production uses the same Neon-tuned options
// so migrations run with matching SSL/timeout behavior.
const cliConfig = {
  development: {
    use_env_variable: 'DATABASE_URL',
    dialect: 'postgres',
  },
  production: {
    use_env_variable: 'DATABASE_URL',
    dialect: 'postgres',
    dialectOptions: productionDialectOptions,
    pool: productionPool,
  },
  test: {
    use_env_variable: 'DATABASE_URL',
    dialect: 'postgres',
  },
};

// sequelize-cli expects module.exports to be the config object when used as config file
// But we also need to export sequelize instance for the app
if (require.main === module || process.argv[1]?.includes('sequelize')) {
  module.exports = cliConfig;
} else {
  module.exports = { sequelize, connectDB, Sequelize };
}
