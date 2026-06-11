const { Op } = require('sequelize');
const { CoachClient, User } = require('../models');

// Lato CLIENTE della relazione coach↔cliente (route /api/me/coach): vede gli
// inviti pending e i coach attivi, accetta/rifiuta/termina. Ogni mutazione
// verifica clientId = utente autenticato (mai fidarsi del solo relationshipId).

const COACH_ATTRS = ['uid', 'displayName', 'photoURL'];

function pickRel(rel) {
  return {
    id: rel.id,
    status: rel.status,
    invitedAt: rel.invitedAt,
    acceptedAt: rel.acceptedAt,
    sharing: rel.sharing,
  };
}

// GET /api/me/coach
async function myCoaches(req, res, next) {
  try {
    const rels = await CoachClient.findAll({
      where: { clientId: req.user.uid, status: { [Op.in]: ['pending', 'active'] } },
      include: [{ model: User, as: 'coach', attributes: COACH_ATTRS }],
      order: [['createdAt', 'DESC']],
    });
    res.json(rels.map((r) => ({ relationship: pickRel(r), coach: r.coach })));
  } catch (err) {
    next(err);
  }
}

// Factory per le transizioni di stato lato cliente. 404 (non 403) se la riga
// non esiste o non è nello stato atteso: non rivela l'esistenza di relazioni
// altrui.
function makeTransition(fromStatus, updates) {
  return async function transition(req, res, next) {
    try {
      const rel = await CoachClient.findOne({
        where: { id: req.params.relationshipId, clientId: req.user.uid, status: fromStatus },
      });
      if (!rel) return res.status(404).json({ error: { message: 'Relazione non trovata' } });

      await rel.update(updates());
      res.json({ relationship: pickRel(rel) });
    } catch (err) {
      next(err);
    }
  };
}

const accept = makeTransition('pending', () => ({ status: 'active', acceptedAt: new Date() }));
const decline = makeTransition('pending', () => ({ status: 'declined' }));
const end = makeTransition('active', () => ({ status: 'ended', endedBy: 'client', endedAt: new Date() }));

module.exports = { myCoaches, accept, decline, end };
