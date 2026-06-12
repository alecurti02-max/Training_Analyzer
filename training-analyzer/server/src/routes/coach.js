const router = require('express').Router();
const authenticate = require('../middleware/authenticate');
const requireTrainer = require('../middleware/requireTrainer');
const { loadCoachClient, requireSharing } = require('../middleware/coachAccess');
const ctrl = require('../controllers/coachClientsController');
const programs = require('../controllers/programController');
const assignments = require('../controllers/assignmentController');
const crm = require('../controllers/crmController');
const coachData = require('../controllers/coachDataController');

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

// Pianificazione sul calendario del cliente (upsert per data, firma coach).
// validatePinRef ripulisce eventuali riferimenti scheda non legittimi nel body.
router.get('/clients/:clientId/planned-workouts', loadCoachClient, ctrl.coachPlanned.list);
router.post('/clients/:clientId/planned-workouts', loadCoachClient, ctrl.validatePinRef, ctrl.coachPlanned.create);
router.put('/clients/:clientId/planned-workouts/:id', loadCoachClient, ctrl.validatePinRef, ctrl.coachPlanned.update);
router.delete('/clients/:clientId/planned-workouts/:id', loadCoachClient, ctrl.coachPlanned.destroy);

// Schede (programs) del coach — F2
router.get('/programs', programs.list);
router.post('/programs', programs.create);
router.get('/programs/:id', programs.getById);
router.put('/programs/:id', programs.update);
router.delete('/programs/:id', programs.destroy);
router.post('/programs/:id/duplicate', programs.duplicate);

// Assegnazioni e aderenza — F2
router.post('/clients/:clientId/assignments', loadCoachClient, assignments.create);
router.get('/clients/:clientId/assignments', loadCoachClient, assignments.listForClient);
router.get('/clients/:clientId/adherence', loadCoachClient, assignments.adherence);
router.put('/assignments/:id', assignments.update);

// CRM: anagrafica + note private del coach — F3 (MAI client-facing)
router.get('/clients/:clientId/profile', loadCoachClient, crm.getProfile);
router.put('/clients/:clientId/profile', loadCoachClient, crm.updateProfile);
router.post('/clients/:clientId/notes', loadCoachClient, crm.addNote);
router.delete('/clients/:clientId/notes/:noteId', loadCoachClient, crm.deleteNote);

// CRM: pacchetti/abbonamenti — F3
router.get('/clients/:clientId/packages', loadCoachClient, crm.listPackages);
router.post('/clients/:clientId/packages', loadCoachClient, crm.createPackage);
router.put('/packages/:id', crm.updatePackage);
router.post('/packages/:id/use', crm.usePackage);

// Dati sensibili del cliente, READ-ONLY e gated dall'opt-in (sharing) — F3
router.get('/clients/:clientId/weights', loadCoachClient, requireSharing('body'), coachData.listWeights);
router.get('/clients/:clientId/body-measurements', loadCoachClient, requireSharing('body'), coachData.listBodyMeasurements);
router.get('/clients/:clientId/nutrition', loadCoachClient, requireSharing('nutrition'), coachData.listNutrition);
router.get('/clients/:clientId/sleep', loadCoachClient, requireSharing('sleep'), coachData.listSleep);

module.exports = router;
