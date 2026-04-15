const router = require('express').Router();
const authenticate = require('../middleware/authenticate');
const ctrl = require('../controllers/workoutController');

router.use(authenticate);

router.get('/', ctrl.list);
router.get('/:id', ctrl.getById);
router.post('/', ctrl.create);
router.post('/bulk', ctrl.bulkCreate);
router.put('/:id', ctrl.update);
router.delete('/', ctrl.destroyAll);
router.delete('/:id', ctrl.destroy);
router.post('/import', ctrl.upload.single('file'), ctrl.importFile);

module.exports = router;
