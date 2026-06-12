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
      // CRM F2 — aggancio scheda: popolate dal "lift" server-side di
      // data._assignment in workoutController.create (mai dal body diretto).
      // Colonne (non solo JSONB) perché l'aderenza aggrega con GROUP BY anche
      // su SQLite nei test. SET NULL alla cancellazione dell'assignment.
      assignmentId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'program_assignments', key: 'id' },
      },
      assignmentDayKey: { type: DataTypes.STRING(8), allowNull: true },
      assignmentWeek: { type: DataTypes.INTEGER, allowNull: true },
    },
    {
      tableName: 'workouts',
      timestamps: true,
      indexes: [
        { fields: ['userId', 'date'] },
        { fields: ['userId', 'type'] },
        { fields: ['assignmentId'] },
      ],
    }
  );

  Workout.associate = (models) => {
    Workout.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
  };

  return Workout;
};
