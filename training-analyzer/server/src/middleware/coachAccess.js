const { CoachClient } = require('../models');

// Accesso del coach ai dati di un cliente. Usa dopo authenticate + requireTrainer
// sulle route /api/coach/clients/:clientId/*: carica la relazione ATTIVA tra il
// trainer autenticato e :clientId; 403 se assente (mai 404: non rivela se
// l'utente esiste). Setta req.coachClient e req.clientId per i controller.
async function loadCoachClient(req, res, next) {
  try {
    const rel = await CoachClient.findOne({
      where: { coachId: req.user.uid, clientId: req.params.clientId, status: 'active' },
    });
    if (!rel) {
      return res.status(403).json({ error: { message: 'Forbidden', code: 'not_coach_of_client' } });
    }
    req.coachClient = rel;
    req.clientId = rel.clientId;
    next();
  } catch (err) {
    next(err);
  }
}

// Gate sull'opt-in del cliente (CoachClient.sharing, controllato SOLO dal
// cliente). Usa dopo loadCoachClient. Chiavi: 'body' | 'nutrition' | 'sleep'.
function requireSharing(key) {
  return (req, res, next) => {
    if (req.coachClient?.sharing?.[key] !== true) {
      return res.status(403).json({ error: { message: 'Forbidden', code: 'sharing_disabled' } });
    }
    next();
  };
}

module.exports = { loadCoachClient, requireSharing };
