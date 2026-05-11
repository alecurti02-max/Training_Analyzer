const { Op } = require('sequelize');
const { Workout, Settings, User } = require('../../models');
const { slimWorkout, slimHistoryEntry, buildUserProfile } = require('./slimmers');

const HISTORY_LIMIT = 10;

async function buildAnalysisContext({ userId, workoutId }) {
  const workout = await Workout.findOne({ where: { id: workoutId, userId } });
  if (!workout) {
    const err = new Error('Workout not found');
    err.status = 404;
    err.code = 'workout_not_found';
    throw err;
  }
  const [user, settings, history] = await Promise.all([
    User.findByPk(userId, { attributes: ['uid', 'plan'] }),
    Settings.findOne({ where: { userId } }),
    Workout.findAll({
      where: {
        userId,
        type: workout.type,
        id: { [Op.ne]: workout.id },
      },
      order: [['date', 'DESC'], ['createdAt', 'DESC']],
      limit: HISTORY_LIMIT,
    }),
  ]);

  const userBW = settings?.bodyweight || 0;
  return {
    workout,
    profile: buildUserProfile(user, settings),
    current: slimWorkout(workout),
    history: history.map((w) => slimHistoryEntry(w, userBW)),
  };
}

module.exports = { buildAnalysisContext };
