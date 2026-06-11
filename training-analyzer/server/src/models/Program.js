const { DataTypes } = require('sequelize');

// Scheda di allenamento riusabile del coach: N giornate (A/B/C…) con esercizi
// nella stessa shape di PlannedWorkout.exercises (zero trasformazioni lato
// client) + progressioni per-settimana (loadPct/deload). Assegnabile a più
// clienti via ProgramAssignment; l'esecuzione è on-demand (nessuna
// materializzazione di righe planned).
module.exports = (sequelize) => {
  const Program = sequelize.define(
    'Program',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      coachId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'users', key: 'uid' },
      },
      title: { type: DataTypes.STRING(120), allowNull: false },
      goal: { type: DataTypes.STRING(200), allowNull: true },
      notes: { type: DataTypes.TEXT, allowNull: true },
      weeks: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 4,
        validate: { min: 1, max: 52 },
      },
      // [{ key:'A', label, type, muscleGroups:[], note, exercises:[{name, muscle, sets:[...], ...}] }]
      days: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
      // [{ week:1, loadPct:100, deload:false, note:'' }] — settimana assente ⇒ 100%
      progressions: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
      status: {
        type: DataTypes.STRING(16),
        allowNull: false,
        defaultValue: 'draft',
        validate: { isIn: [['draft', 'active', 'archived']] },
      },
    },
    {
      tableName: 'programs',
      timestamps: true,
      indexes: [{ fields: ['coachId'] }],
    }
  );

  Program.associate = (models) => {
    Program.belongsTo(models.User, { foreignKey: 'coachId', as: 'coach' });
    Program.hasMany(models.ProgramAssignment, { foreignKey: 'programId', as: 'assignments' });
  };

  return Program;
};
