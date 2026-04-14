require('dotenv').config();

const app = require('./app');
const { connectDB, sequelize } = require('./config/database');

const PORT = process.env.PORT || 3000;

async function start() {
  await connectDB();

  // Auto-create tables if they don't exist (safe — doesn't drop existing data)
  await sequelize.sync({ alter: false });
  console.log('Database tables synced');

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Startup failed:', err);
  process.exit(1);
});
