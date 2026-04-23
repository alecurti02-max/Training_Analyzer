require('dotenv').config();

const app = require('./app');
const { connectDB, sequelize } = require('./config/database');
const { User } = require('./models');

const PORT = process.env.PORT || 3000;

async function promoteAdminFromEnv() {
  const email = process.env.ADMIN_EMAIL;
  if (!email) return;
  const user = await User.findOne({ where: { email } });
  if (!user) {
    console.warn(`[admin-bootstrap] ADMIN_EMAIL=${email} non trovato — skip`);
    return;
  }
  if (user.role === 'admin') return;
  await user.update({ role: 'admin' });
  console.log(`[admin-bootstrap] Utente ${email} promosso ad admin`);
}

async function start() {
  await connectDB();

  // Auto-create tables if they don't exist (safe — doesn't drop existing data)
  await sequelize.sync({ alter: false });
  console.log('Database tables synced');

  await promoteAdminFromEnv();

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Startup failed:', err);
  process.exit(1);
});
