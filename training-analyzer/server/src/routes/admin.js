const router = require('express').Router();
const authenticate = require('../middleware/authenticate');
const requireAdmin = require('../middleware/requireAdmin');
const ctrl = require('../controllers/adminController');

router.use(authenticate, requireAdmin);

router.get('/stats', ctrl.stats);
router.get('/users', ctrl.listUsers);

module.exports = router;
