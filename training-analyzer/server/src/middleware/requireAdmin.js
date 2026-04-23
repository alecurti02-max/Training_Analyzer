const { User } = require('../models');

async function requireAdmin(req, res, next) {
  try {
    const user = await User.findByPk(req.user.uid, { attributes: ['uid', 'role'] });
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: { message: 'Forbidden', code: 'not_admin' } });
    }
    req.user.role = user.role;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = requireAdmin;
