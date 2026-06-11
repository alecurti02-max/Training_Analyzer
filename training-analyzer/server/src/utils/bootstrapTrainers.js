const { User, TrainerProfile } = require('../models');

// Bootstrap trainer da env, stesso pattern di promoteAdminFromEnv (index.js):
// TRAINER_EMAILS è una lista comma-separated; per ogni email esistente fa
// upsert di un TrainerProfile attivo (source 'seed'). Idempotente: riavvii
// successivi non cambiano nulla. Letta a runtime (non da config/env.js) così
// i test possono variarla per-case.
async function promoteTrainersFromEnv() {
  const raw = process.env.TRAINER_EMAILS;
  if (!raw) return;
  const emails = raw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  for (const email of emails) {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      console.warn(`[trainer-bootstrap] TRAINER_EMAILS: ${email} non trovato — skip`);
      continue;
    }
    const [profile, created] = await TrainerProfile.findOrCreate({
      where: { uid: user.uid },
      defaults: { uid: user.uid, status: 'active', source: 'seed' },
    });
    if (!created && profile.status !== 'active') {
      await profile.update({ status: 'active' });
      console.log(`[trainer-bootstrap] ${email} riattivato come trainer`);
    } else if (created) {
      console.log(`[trainer-bootstrap] ${email} promosso a trainer`);
    }
  }
}

module.exports = { promoteTrainersFromEnv };
