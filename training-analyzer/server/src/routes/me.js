const router = require('express').Router();
const authenticate = require('../middleware/authenticate');
const ctrl = require('../controllers/myCoachController');

// Lato cliente della relazione coach↔cliente (inviti, consenso, chiusura).
router.use(authenticate);

router.get('/coach', ctrl.myCoaches);
router.post('/coach/:relationshipId/accept', ctrl.accept);
router.post('/coach/:relationshipId/decline', ctrl.decline);
router.post('/coach/:relationshipId/end', ctrl.end);

module.exports = router;
