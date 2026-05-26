const { Op, fn, col, literal } = require('sequelize');
const { User, Workout } = require('../models');

async function stats(req, res, next) {
  try {
    const now = new Date();
    const d7 = new Date(now);
    d7.setDate(d7.getDate() - 7);
    const d30 = new Date(now);
    d30.setDate(d30.getDate() - 30);

    const [
      totalUsers,
      usersLast7,
      usersLast30,
      googleUsers,
      localUsers,
      adminCount,
      totalWorkouts,
      workoutsLast7,
    ] = await Promise.all([
      User.count(),
      User.count({ where: { createdAt: { [Op.gte]: d7 } } }),
      User.count({ where: { createdAt: { [Op.gte]: d30 } } }),
      User.count({ where: { provider: 'google' } }),
      User.count({ where: { provider: 'local' } }),
      User.count({ where: { role: 'admin' } }),
      Workout.count(),
      Workout.count({ where: { createdAt: { [Op.gte]: d7 } } }),
    ]);

    const sportsRaw = await Workout.findAll({
      attributes: ['type', [fn('COUNT', col('id')), 'count']],
      group: ['type'],
      order: [[literal('count'), 'DESC']],
      raw: true,
    });
    const sportBreakdown = sportsRaw.map((r) => ({
      type: r.type,
      count: parseInt(r.count, 10),
    }));

    const signupsRaw = await User.findAll({
      where: { createdAt: { [Op.gte]: d30 } },
      attributes: [
        [fn('date_trunc', 'day', col('createdAt')), 'day'],
        [fn('COUNT', col('uid')), 'count'],
      ],
      group: [literal('day')],
      order: [[literal('day'), 'ASC']],
      raw: true,
    });
    const signupsDaily = signupsRaw.map((r) => ({
      day: r.day instanceof Date ? r.day.toISOString().slice(0, 10) : String(r.day).slice(0, 10),
      count: parseInt(r.count, 10),
    }));

    res.json({
      users: {
        total: totalUsers,
        last7: usersLast7,
        last30: usersLast30,
        byProvider: { google: googleUsers, local: localUsers },
        admins: adminCount,
      },
      workouts: {
        total: totalWorkouts,
        last7: workoutsLast7,
        bySport: sportBreakdown,
      },
      signupsDaily,
    });
  } catch (err) {
    next(err);
  }
}

async function listUsers(req, res, next) {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const offset = (page - 1) * limit;

    // Single LEFT JOIN + GROUP BY avoids the previous 1+1 round-trip.
    // User.count() runs in parallel for the total (findAndCountAll + group:
    // returns per-group counts, not a global total).
    const [count, rows] = await Promise.all([
      User.count(),
      User.findAll({
        attributes: [
          'uid',
          'email',
          'firstName',
          'lastName',
          'displayName',
          'provider',
          'role',
          'photoURL',
          'createdAt',
          [fn('COUNT', col('workouts.id')), 'workoutCount'],
        ],
        include: [{ model: Workout, as: 'workouts', attributes: [], required: false }],
        group: ['User.uid'],
        subQuery: false,
        order: [['createdAt', 'DESC']],
        limit,
        offset,
      }),
    ]);

    const users = rows.map((u) => {
      const json = u.toJSON();
      json.workoutCount = parseInt(json.workoutCount, 10) || 0;
      return json;
    });

    res.json({ users, page, limit, total: count });
  } catch (err) {
    next(err);
  }
}

module.exports = { stats, listUsers };
