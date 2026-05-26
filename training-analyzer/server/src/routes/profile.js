const router = require('express').Router();
const authenticate = require('../middleware/authenticate');
const requireAiEnabled = require('../middleware/requireAiEnabled');
const aiLimiter = require('../middleware/aiLimiter');
const ctrl = require('../controllers/profileController');

router.use(authenticate);

router.post('/coach-summary', requireAiEnabled, aiLimiter, ctrl.coachSummary);

module.exports = router;
