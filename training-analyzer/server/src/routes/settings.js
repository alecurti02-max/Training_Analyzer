const router = require('express').Router();
const authenticate = require('../middleware/authenticate');
const ctrl = require('../controllers/settingsController');

router.use(authenticate);

router.get('/', ctrl.get);
router.put('/', ctrl.update);

module.exports = router;
