const { Op, fn, col, literal } = require('sequelize');
const { User, Workout, Follow, sequelize } = require('../models');

// Dialect-aware JSONB numeric extraction. Postgres has `(data->>'k')::float`,
// SQLite has the JSON1 `json_extract(data, '$.k')`. Whitelist of allowed fields
// guards against accidental injection if a future caller passes a variable.
const ALLOWED_JSONB_NUM_FIELDS = new Set(['distance', '_tonnage']);
function jsonbNum(field) {
  if (!ALLOWED_JSONB_NUM_FIELDS.has(field)) {
    throw new Error(`jsonbNum: field "${field}" not in allowlist`);
  }
  return sequelize.getDialect() === 'postgres'
    ? literal(`("data"->>'${field}')::float`)
    : literal(`CAST(json_extract("data", '$.${field}') AS REAL)`);
}

async function search(req, res, next) {
  try {
    const q = req.query.q;
    if (!q || q.length < 2) {
      return res.status(400).json({ error: { message: 'Query must be at least 2 characters' } });
    }

    const users = await User.findAll({
      where: {
        displayName: { [Op.iLike]: `%${q}%` },
        uid: { [Op.ne]: req.user.uid },
      },
      attributes: ['uid', 'displayName', 'photoURL'],
      limit: 10,
    });

    res.json(users);
  } catch (err) {
    next(err);
  }
}

async function myProfile(req, res, next) {
  try {
    const user = await User.findByPk(req.user.uid, {
      attributes: { exclude: ['passwordHash', 'refreshToken'] },
    });
    if (!user) return res.status(404).json({ error: { message: 'User not found' } });

    // Compute stats
    const stats = await computeStats(req.user.uid);

    res.json({ ...user.toPublicJSON(), stats });
  } catch (err) {
    next(err);
  }
}

async function userStats(req, res, next) {
  try {
    const { uid } = req.params;
    const user = await User.findByPk(uid, {
      attributes: ['uid', 'displayName', 'photoURL'],
    });
    if (!user) return res.status(404).json({ error: { message: 'User not found' } });

    const stats = await computeStats(uid);

    res.json({ uid: user.uid, displayName: user.displayName, photoURL: user.photoURL, ...stats });
  } catch (err) {
    next(err);
  }
}

async function computeStats(uid) {
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekStr = weekAgo.toISOString().slice(0, 10);

  const [totalWorkouts, avgScoreResult, weekWorkouts, weekKmResult, weekTonnageResult] =
    await Promise.all([
      Workout.count({ where: { userId: uid } }),
      Workout.findOne({
        where: { userId: uid, score: { [Op.ne]: null } },
        attributes: [[fn('AVG', col('score')), 'avg']],
        raw: true,
      }),
      Workout.count({
        where: { userId: uid, date: { [Op.gte]: weekStr } },
      }),
      Workout.findOne({
        where: { userId: uid, type: 'running', date: { [Op.gte]: weekStr } },
        attributes: [[fn('SUM', jsonbNum('distance')), 'total']],
        raw: true,
      }),
      Workout.findOne({
        where: { userId: uid, type: 'gym', date: { [Op.gte]: weekStr } },
        attributes: [[fn('SUM', jsonbNum('_tonnage')), 'total']],
        raw: true,
      }),
    ]);

  const weekKm = parseFloat(weekKmResult?.total) || 0;
  const weekTonnage = parseFloat(weekTonnageResult?.total) || 0;
  const avgScore = avgScoreResult?.avg ? parseFloat(parseFloat(avgScoreResult.avg).toFixed(1)) : null;

  return { totalWorkouts, avgScore, weekWorkouts, weekKm, weekTonnage };
}

async function follow(req, res, next) {
  try {
    const { uid } = req.params;
    if (uid === req.user.uid) {
      return res.status(400).json({ error: { message: 'Cannot follow yourself' } });
    }

    const target = await User.findByPk(uid);
    if (!target) return res.status(404).json({ error: { message: 'User not found' } });

    await Follow.findOrCreate({
      where: { followerId: req.user.uid, followingId: uid },
      defaults: { followerId: req.user.uid, followingId: uid },
    });

    res.status(201).json({ message: 'Followed' });
  } catch (err) {
    next(err);
  }
}

async function unfollow(req, res, next) {
  try {
    const { uid } = req.params;
    const deleted = await Follow.destroy({
      where: { followerId: req.user.uid, followingId: uid },
    });

    if (!deleted) return res.status(404).json({ error: { message: 'Not following this user' } });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

async function myFollowing(req, res, next) {
  try {
    const follows = await Follow.findAll({
      where: { followerId: req.user.uid },
      include: [{ model: User, as: 'followedUser', attributes: ['uid', 'displayName', 'photoURL'] }],
      order: [['createdAt', 'DESC']],
    });

    const result = follows.map((f) => ({
      uid: f.followedUser.uid,
      displayName: f.followedUser.displayName,
      photoURL: f.followedUser.photoURL,
      followedAt: f.createdAt,
    }));

    res.json(result);
  } catch (err) {
    next(err);
  }
}

// Permanent account deletion. All user-owned rows (workouts, exercises,
// settings, weights, body measurements, follows in either direction) are
// removed via ON DELETE CASCADE on the FK from each table to users.uid.
async function deleteAccount(req, res, next) {
  try {
    const deleted = await User.destroy({ where: { uid: req.user.uid } });
    if (!deleted) return res.status(404).json({ error: { message: 'User not found' } });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

module.exports = { search, myProfile, userStats, follow, unfollow, myFollowing, deleteAccount };
