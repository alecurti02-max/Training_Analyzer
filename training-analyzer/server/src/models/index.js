const { sequelize, Sequelize } = require('../config/database');

const User = require('./User')(sequelize);
const Workout = require('./Workout')(sequelize);
const Exercise = require('./Exercise')(sequelize);
const Settings = require('./Settings')(sequelize);
const Weight = require('./Weight')(sequelize);
const Follow = require('./Follow')(sequelize);
const BodyMeasurement = require('./BodyMeasurement')(sequelize);

const models = { User, Workout, Exercise, Settings, Weight, Follow, BodyMeasurement };

Object.values(models).forEach((model) => {
  if (typeof model.associate === 'function') {
    model.associate(models);
  }
});

module.exports = { sequelize, Sequelize, ...models };
