const router = require('express').Router();
const authenticate = require('../middleware/authenticate');
const ctrl = require('../controllers/bodyMeasurementController');

router.use(authenticate);

router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);
router.delete('/:id', ctrl.destroy);

module.exports = router;
