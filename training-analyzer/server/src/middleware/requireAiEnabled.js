const config = require('../config/env');
const { User } = require('../models');

async function requireAiEnabled(req, res, next) {
  try {
    if (!config.anthropicApiKey) {
      return res.status(503).json({ error: { message: 'AI feature not configured', code: 'ai_not_configured' } });
    }
    if (!config.aiRequiresPremium) {
      return next();
    }
    const user = await User.findByPk(req.user.uid, { attributes: ['uid', 'plan'] });
    if (!user || user.plan !== 'premium') {
      return res.status(402).json({ error: { message: 'AI analysis requires premium plan', code: 'ai_requires_premium' } });
    }
    req.user.plan = user.plan;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = requireAiEnabled;
