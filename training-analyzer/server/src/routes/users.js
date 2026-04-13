const router = require('express').Router();
const authenticate = require('../middleware/authenticate');
const ctrl = require('../controllers/userController');

router.use(authenticate);

router.get('/search', ctrl.search);
router.get('/me/profile', ctrl.myProfile);
router.get('/me/following', ctrl.myFollowing);
router.get('/:uid/stats', ctrl.userStats);
router.post('/:uid/follow', ctrl.follow);
router.delete('/:uid/follow', ctrl.unfollow);

module.exports = router;
