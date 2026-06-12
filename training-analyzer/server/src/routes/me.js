const router = require('express').Router();
const authenticate = require('../middleware/authenticate');
const ctrl = require('../controllers/myCoachController');
const assignments = require('../controllers/assignmentController');

// Lato cliente della relazione coach↔cliente (inviti, consenso, chiusura).
router.use(authenticate);

router.get('/coach', ctrl.myCoaches);
router.post('/coach/:relationshipId/accept', ctrl.accept);
router.post('/coach/:relationshipId/decline', ctrl.decline);
router.post('/coach/:relationshipId/end', ctrl.end);
// Opt-in condivisione dati sensibili col coach (F3) — solo il cliente.
router.put('/coach/:relationshipId/sharing', ctrl.updateSharing);

// Schede attive assegnate a me (F2) — solo per relazioni coach ancora attive.
router.get('/program', assignments.myPrograms);

module.exports = router;
