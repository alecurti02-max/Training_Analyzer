const router = require('express').Router();
const passport = require('passport');
const authenticate = require('../middleware/authenticate');
const ctrl = require('../controllers/authController');

// Local auth
router.post('/register', ctrl.registerValidation, ctrl.register);
router.post('/login', ctrl.loginValidation, ctrl.login);
router.post('/logout', authenticate, ctrl.logout);
router.post('/refresh', ctrl.refresh);

// Google OAuth2
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);

router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/?error=auth_failed' }),
  ctrl.googleCallback
);

module.exports = router;
