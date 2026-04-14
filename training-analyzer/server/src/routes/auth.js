const router = require('express').Router();
const passport = require('passport');
const authenticate = require('../middleware/authenticate');
const ctrl = require('../controllers/authController');

// Local auth
router.post('/register', ctrl.registerValidation, ctrl.register);
router.post('/login', ctrl.loginValidation, ctrl.login);
router.post('/logout', authenticate, ctrl.logout);
router.post('/refresh', ctrl.refresh);

// Google OAuth2 (only if strategy is registered)
router.get('/google', (req, res, next) => {
  if (!passport._strategy('google')) {
    return res.status(501).json({ error: { message: 'Google OAuth non configurato sul server' } });
  }
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })(req, res, next);
});

router.get('/google/callback', (req, res, next) => {
  if (!passport._strategy('google')) {
    return res.redirect('/?error=auth_not_configured');
  }
  passport.authenticate('google', { session: false, failureRedirect: '/?error=auth_failed' })(req, res, next);
}, ctrl.googleCallback);

module.exports = router;
