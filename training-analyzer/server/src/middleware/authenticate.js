const { verifyAccessToken } = require('../utils/jwt');

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: { message: 'Missing token', code: 'no_token' } });
  }

  const token = header.slice(7);
  try {
    const decoded = verifyAccessToken(token);
    req.user = { uid: decoded.uid, email: decoded.email };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: { message: 'Token expired', code: 'token_expired' } });
    }
    return res.status(401).json({ error: { message: 'Invalid token', code: 'invalid_token' } });
  }
}

module.exports = authenticate;
