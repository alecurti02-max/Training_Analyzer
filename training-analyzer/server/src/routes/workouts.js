const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const authenticate = require('../middleware/authenticate');
const requireAiEnabled = require('../middleware/requireAiEnabled');
const ctrl = require('../controllers/workoutController');
const aiCtrl = require('../controllers/aiAnalysisController');
const config = require('../config/env');

router.use(authenticate);

router.get('/', ctrl.list);
router.get('/:id', ctrl.getById);
router.post('/', ctrl.create);
router.post('/bulk', ctrl.bulkCreate);
router.put('/:id', ctrl.update);
router.delete('/', ctrl.destroyAll);
router.delete('/:id', ctrl.destroy);
router.post('/import', ctrl.upload.single('file'), ctrl.importFile);

const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: config.aiRateLimitPerHour,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.uid || req.ip,
  message: { error: { message: 'Too many AI analyses, try again later', code: 'ai_rate_limited' } },
});

router.post('/:id/analyze', requireAiEnabled, aiLimiter, aiCtrl.analyze);
router.delete('/:id/analyze', requireAiEnabled, aiCtrl.clear);

module.exports = router;
