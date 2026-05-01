const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Workout = sequelize.define(
    'Workout',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'users', key: 'uid' },
      },
      type: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      score: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      data: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      aiAnalysis: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: null,
      },
      aiAnalysisGeneratedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
      },
      aiAnalysisModel: {
        type: DataTypes.STRING(64),
        allowNull: true,
        defaultValue: null,
      },
      aiAnalysisVersion: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
    },
    {
      tableName: 'workouts',
      timestamps: true,
      indexes: [
        { fields: ['userId', 'date'] },
        { fields: ['userId', 'type'] },
      ],
    }
  );

  Workout.associate = (models) => {
    Workout.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
  };

  return Workout;
};
