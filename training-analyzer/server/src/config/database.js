const { Sequelize } = require('sequelize');

const databaseUrl =
  process.env.DATABASE_URL ||
  'postgres://ta_user:ta_pass@localhost:5432/training_analyzer';

const sequelize = new Sequelize(databaseUrl, {
  dialect: 'postgres',
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  pool: { max: 5, min: 0, idle: 10000 },
  dialectOptions:
    process.env.NODE_ENV === 'production'
      ? { ssl: { require: true, rejectUnauthorized: false } }
      : {},
});

async function connectDB() {
  await sequelize.authenticate();
  console.log('PostgreSQL connected');
}

// sequelize-cli config export
const cliConfig = {
  development: {
    use_env_variable: 'DATABASE_URL',
    dialect: 'postgres',
  },
  production: {
    use_env_variable: 'DATABASE_URL',
    dialect: 'postgres',
    dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
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
