const jwt = require('jsonwebtoken');

const ACCESS_SECRET = process.env.JWT_SECRET || 'dev-access-secret';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret';

function generateAccessToken(user) {
  return jwt.sign(
    { uid: user.uid, email: user.email },
    ACCESS_SECRET,
    { expiresIn: '1h' }
  );
}

function generateRefreshToken(user) {
  return jwt.sign(
    { uid: user.uid },
    REFRESH_SECRET,
    { expiresIn: '30d' }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, ACCESS_SECRET);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, REFRESH_SECRET);
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
