const rateLimit = require('express-rate-limit');
const config = require('../config/env');

// Shared rate limiter for endpoints that call Anthropic. The bucket is keyed
// on req.user.uid so a single user can't dodge the cap by alternating between
// /workouts/:id/analyze and /profile/coach-summary.
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: config.aiRateLimitPerHour,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.uid || req.ip,
  message: { error: { message: 'Too many AI analyses, try again later', code: 'ai_rate_limited' } },
});

module.exports = aiLimiter;
