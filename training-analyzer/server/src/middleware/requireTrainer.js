const { TrainerProfile } = require('../models');

// Gate trainer: richiede un TrainerProfile con status='active' (vedi modello —
// il ruolo trainer è una tabella 1:1, non un valore di User.role). Usa dopo
// authenticate. Setta req.trainer per i controller a valle.
async function requireTrainer(req, res, next) {
  try {
    const profile = await TrainerProfile.findByPk(req.user.uid);
    if (!profile || profile.status !== 'active') {
      return res.status(403).json({ error: { message: 'Forbidden', code: 'not_trainer' } });
    }
    req.trainer = profile;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = requireTrainer;
