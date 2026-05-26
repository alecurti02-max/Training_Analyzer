const router = require('express').Router();
const authenticate = require('../middleware/authenticate');
const requireAiEnabled = require('../middleware/requireAiEnabled');
const aiLimiter = require('../middleware/aiLimiter');
const ctrl = require('../controllers/workoutController');
const aiCtrl = require('../controllers/aiAnalysisController');

router.use(authenticate);

router.get('/', ctrl.list);
router.get('/:id', ctrl.getById);
router.post('/', ctrl.create);
router.post('/bulk', ctrl.bulkCreate);
router.put('/:id', ctrl.update);
router.delete('/', ctrl.destroyAll);
router.delete('/:id', ctrl.destroy);
router.post('/import', ctrl.upload.single('file'), ctrl.importFile);

router.post('/:id/analyze', requireAiEnabled, aiLimiter, aiCtrl.analyze);
router.delete('/:id/analyze', requireAiEnabled, aiCtrl.clear);

module.exports = router;
