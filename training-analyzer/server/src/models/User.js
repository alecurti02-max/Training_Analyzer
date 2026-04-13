const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const User = sequelize.define(
    'User',
    {
      uid: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: { isEmail: true },
      },
      displayName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      photoURL: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      provider: {
        type: DataTypes.ENUM('google', 'local'),
        defaultValue: 'google',
      },
      passwordHash: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      refreshToken: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      tableName: 'users',
      timestamps: true,
    }
  );

  User.associate = (models) => {
    User.hasMany(models.Workout, { foreignKey: 'userId', as: 'workouts' });
    User.hasMany(models.Exercise, { foreignKey: 'userId', as: 'exercises' });
    User.hasOne(models.Settings, { foreignKey: 'userId', as: 'settings' });
    User.hasMany(models.Weight, { foreignKey: 'userId', as: 'weights' });
    User.hasMany(models.Follow, { foreignKey: 'followerId', as: 'following' });
    User.hasMany(models.Follow, { foreignKey: 'followingId', as: 'followers' });
  };

  User.prototype.toPublicJSON = function () {
    const values = { ...this.get() };
    delete values.passwordHash;
    delete values.refreshToken;
    return values;
  };

  return User;
};
