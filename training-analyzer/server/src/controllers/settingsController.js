const { Settings } = require('../models');

const ALLOWED_FIELDS = [
  'fcMax', 'fcRest', 'weight', 'height', 'vo2max', 'age', 'sex',
  'flexibility', 'weekgoal', 'kmgoal', 'activeSports', 'activeGroups',
];

async function get(req, res, next) {
  try {
    let settings = await Settings.findByPk(req.user.uid);
    if (!settings) {
      settings = await Settings.create({ userId: req.user.uid });
    }
    res.json(settings);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const updates = {};
    for (const key of ALLOWED_FIELDS) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    // Basic validation for numeric fields
    if (updates.fcMax != null && (updates.fcMax < 100 || updates.fcMax > 250)) {
      return res.status(400).json({ error: { message: 'fcMax must be between 100 and 250' } });
    }
    if (updates.fcRest != null && (updates.fcRest < 30 || updates.fcRest > 120)) {
      return res.status(400).json({ error: { message: 'fcRest must be between 30 and 120' } });
    }
    if (updates.flexibility != null && (updates.flexibility < 1 || updates.flexibility > 10)) {
      return res.status(400).json({ error: { message: 'flexibility must be between 1 and 10' } });
    }

    const [settings] = await Settings.upsert({ userId: req.user.uid, ...updates });
    res.json(settings);
  } catch (err) {
    next(err);
  }
}

module.exports = { get, update };
