const { User } = require('../models');

async function requirePremium(req, res, next) {
  try {
    const user = await User.findByPk(req.user.uid, { attributes: ['uid', 'plan'] });
    if (!user || user.plan !== 'premium') {
      return res.status(402).json({ error: { message: 'Premium plan required', code: 'premium_required' } });
    }
    req.user.plan = user.plan;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = requirePremium;
