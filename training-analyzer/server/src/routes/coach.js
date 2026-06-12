const router = require('express').Router();
const authenticate = require('../middleware/authenticate');
const requireTrainer = require('../middleware/requireTrainer');
const { loadCoachClient } = require('../middleware/coachAccess');
const ctrl = require('../controllers/coachClientsController');

// Area Personal Trainer. Catena obbligatoria: authenticate → requireTrainer;
// le route per-cliente aggiungono loadCoachClient (relazione ATTIVA verificata).
router.use(authenticate, requireTrainer);

// Roster + inviti (sulle relazioni, non sul singolo cliente)
router.get('/clients', ctrl.listClients);
router.post('/clients/invites', ctrl.invite);
router.delete('/clients/:relationshipId', ctrl.removeClient);

// Dati del cliente (read-only)
router.get('/clients/:clientId/workouts', loadCoachClient, ctrl.clientWorkouts);
router.get('/clients/:clientId/workouts/:id', loadCoachClient, ctrl.clientWorkoutById);
router.get('/clients/:clientId/stats', loadCoachClient, ctrl.clientStats);

// Pianificazione sul calendario del cliente (upsert per data, firma coach)
router.get('/clients/:clientId/planned-workouts', loadCoachClient, ctrl.coachPlanned.list);
router.post('/clients/:clientId/planned-workouts', loadCoachClient, ctrl.coachPlanned.create);
router.put('/clients/:clientId/planned-workouts/:id', loadCoachClient, ctrl.coachPlanned.update);
router.delete('/clients/:clientId/planned-workouts/:id', loadCoachClient, ctrl.coachPlanned.destroy);

module.exports = router;
