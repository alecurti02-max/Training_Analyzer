const { DataTypes } = require('sequelize');

// Assegnazione di una scheda a un cliente. coachId è denormalizzato per authz e
// aderenza senza join. currentWeek NON è una colonna: si calcola da startDate
// (services/assignmentMath.js::weekOf) — niente cron, niente drift. Un solo
// assignment 'active' per coppia coach+cliente (enforcement a livello app, 409).
module.exports = (sequelize) => {
  const ProgramAssignment = sequelize.define(
    'ProgramAssignment',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      programId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'programs', key: 'id' },
      },
      coachId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'users', key: 'uid' },
      },
      clientId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'users', key: 'uid' },
      },
      startDate: { type: DataTypes.DATEONLY, allowNull: false },
      // { "A": 1, "B": 3 } — dayKey → ISO weekday (1=lun); opzionale, usato per
      // le "sessioni attese a settimana" e i suggerimenti, non vincola il cliente.
      weekdayMap: { type: DataTypes.JSONB, allowNull: true },
      status: {
        type: DataTypes.STRING(16),
        allowNull: false,
        defaultValue: 'active',
        validate: { isIn: [['active', 'completed', 'cancelled']] },
      },
      note: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      tableName: 'program_assignments',
      timestamps: true,
      indexes: [
        { fields: ['clientId', 'status'] },
        { fields: ['coachId', 'status'] },
        { fields: ['programId'] },
      ],
    }
  );

  ProgramAssignment.associate = (models) => {
    ProgramAssignment.belongsTo(models.Program, { foreignKey: 'programId', as: 'program' });
    ProgramAssignment.belongsTo(models.User, { foreignKey: 'coachId', as: 'coach' });
    ProgramAssignment.belongsTo(models.User, { foreignKey: 'clientId', as: 'client' });
  };

  return ProgramAssignment;
};
