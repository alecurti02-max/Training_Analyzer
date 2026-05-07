// Carica subito il .env dalla root del progetto (override per evitare collisioni con
// var d'ambiente shell, es. ANTHROPIC_API_KEY iniettata dall'IDE).
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env'), override: true });
require('dotenv').config();

const path = require('path');
const { execFileSync } = require('child_process');
const app = require('./app');
const { connectDB, sequelize } = require('./config/database');
const { User } = require('./models');

const PORT = process.env.PORT || 3000;

// Apply pending Sequelize migrations on every boot.
// Idempotent: already-applied migrations are skipped via SequelizeMeta.
// Lives here (not just in npm start / Dockerfile CMD) so it works regardless
// of how the host platform launches the process.
function runMigrations() {
  const cliBin = path.resolve(__dirname, '..', 'node_modules', '.bin', 'sequelize-cli');
  console.log('[migrations] running pending migrations...');
  execFileSync(cliBin, ['db:migrate'], { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
  console.log('[migrations] done');
}

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

  // Apply pending column migrations (sync({alter:false}) below only creates
  // missing tables, it doesn't add columns to existing ones).
  runMigrations();

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
