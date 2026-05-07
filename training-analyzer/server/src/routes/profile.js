const router = require('express').Router();
const authenticate = require('../middleware/authenticate');
const ctrl = require('../controllers/profileController');

router.use(authenticate);

router.post('/coach-summary', ctrl.coachSummary);

module.exports = router;
