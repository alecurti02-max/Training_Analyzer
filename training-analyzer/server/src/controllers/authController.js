const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const passport = require('passport');
const { User, Settings } = require('../models');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} = require('../utils/jwt');

// ── Validation rules ──
const registerValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Email non valida'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password minimo 8 caratteri')
    .matches(/[A-Z]/)
    .withMessage('Password deve contenere almeno una maiuscola')
    .matches(/[0-9]/)
    .withMessage('Password deve contenere almeno un numero'),
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('Nome richiesto')
    .isLength({ max: 60 })
    .withMessage('Nome troppo lungo'),
  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Cognome richiesto')
    .isLength({ max: 60 })
    .withMessage('Cognome troppo lungo'),
];

const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Email non valida'),
  body('password').notEmpty().withMessage('Password richiesta'),
];

// ── Helpers ──
function handleValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: { message: 'Validation error', details: errors.array() } });
  }
  return null;
}

async function issueTokens(user) {
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  const hashed = await bcrypt.hash(refreshToken, 10);
  await user.update({ refreshToken: hashed });
  return { accessToken, refreshToken };
}

// ── Controllers ──
async function register(req, res, next) {
  try {
    const invalid = handleValidation(req, res);
    if (invalid) return;

    const { email, password, firstName, lastName } = req.body;

    const existing = await User.findOne({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: { message: 'Email gia registrata' } });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const displayName = `${firstName} ${lastName}`.trim();
    const user = await User.create({
      email,
      firstName,
      lastName,
      displayName,
      provider: 'local',
      passwordHash,
    });

    await Settings.create({ userId: user.uid });

    const tokens = await issueTokens(user);
    res.status(201).json({ user: user.toPublicJSON(), ...tokens });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const invalid = handleValidation(req, res);
    if (invalid) return;

    passport.authenticate('local', { session: false }, async (err, user, info) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ error: { message: info?.message || 'Credenziali non valide' } });
      }

      const tokens = await issueTokens(user);
      res.json({ user: user.toPublicJSON(), ...tokens });
    })(req, res, next);
  } catch (err) {
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    const user = await User.findByPk(req.user.uid);
    if (user) {
      await user.update({ refreshToken: null });
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

async function refresh(req, res, next) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: { message: 'Refresh token richiesto' } });
    }

    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch {
      return res.status(401).json({ error: { message: 'Refresh token non valido', code: 'invalid_token' } });
    }

    const user = await User.findByPk(decoded.uid);
    if (!user || !user.refreshToken) {
      return res.status(401).json({ error: { message: 'Sessione scaduta', code: 'invalid_token' } });
    }

    const valid = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!valid) {
      return res.status(401).json({ error: { message: 'Refresh token non valido', code: 'invalid_token' } });
    }

    const tokens = await issueTokens(user);
    res.json({ user: user.toPublicJSON(), ...tokens });
  } catch (err) {
    next(err);
  }
}

async function googleCallback(req, res, next) {
  try {
    const user = req.user;
    if (!user) {
      return res.redirect(`${process.env.CLIENT_ORIGIN}/?error=auth_failed`);
    }

    const tokens = await issueTokens(user);
    const params = new URLSearchParams({
      token: tokens.accessToken,
      refresh: tokens.refreshToken,
    });
    res.redirect(`${process.env.CLIENT_ORIGIN}/?${params.toString()}`);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  register,
  login,
  logout,
  refresh,
  googleCallback,
  registerValidation,
  loginValidation,
};
