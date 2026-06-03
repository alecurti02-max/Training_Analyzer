const { DataTypes } = require('sequelize');

// Allenamento PROGRAMMATO in anticipo (non ancora svolto). L'utente lo pianifica;
// la Dashboard mostra il più imminente in "Prossima sessione" e "INIZIA ORA" lo
// apre nel wizard pre-compilato. Una sessione programmata per giorno (upsert userId+date).
module.exports = (sequelize) => {
  const PlannedWorkout = sequelize.define(
    'PlannedWorkout',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'users', key: 'uid' },
      },
      date: { type: DataTypes.DATEONLY, allowNull: false },
      type: { type: DataTypes.STRING, allowNull: false, defaultValue: 'gym' },
      muscleGroups: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
      exercises: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
      note: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      tableName: 'planned_workouts',
      timestamps: true,
      indexes: [{ unique: true, fields: ['userId', 'date'] }],
    }
  );

  PlannedWorkout.associate = (models) => {
    PlannedWorkout.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
  };

  return PlannedWorkout;
};
