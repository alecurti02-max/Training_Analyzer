const { Settings } = require('../models');

const ALLOWED_FIELDS = [
  'maxhr', 'resthr', 'bodyweight', 'height', 'vo2max', 'age', 'gender',
  'flexibility', 'weekgoal', 'kmgoal', 'activeSports', 'muscleGroups',
  // Circonferenze corporee
  'circChest', 'circWaist', 'circHips', 'circShoulders',
  'circBicep', 'circNeck', 'circThigh', 'circCalf',
  // Composizione corporea (opzionale)
  'bodyFat', 'skeletalMuscle', 'subcutaneousFat', 'visceralFat',
  'bodyWater', 'muscleMass', 'boneMass', 'protein',
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

    if (updates.maxhr != null && (updates.maxhr < 100 || updates.maxhr > 250)) {
      return res.status(400).json({ error: { message: 'maxhr must be between 100 and 250' } });
    }
    if (updates.resthr != null && (updates.resthr < 30 || updates.resthr > 120)) {
      return res.status(400).json({ error: { message: 'resthr must be between 30 and 120' } });
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
