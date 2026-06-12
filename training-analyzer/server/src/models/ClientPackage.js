const { DataTypes } = require('sequelize');

// Pacchetto lezioni / abbonamento del cliente presso il coach (tracking
// MANUALE, niente pagamenti online). usedSessions si incrementa solo via
// endpoint dedicato (una "lezione col PT" non coincide con un allenamento).
// Gli alert di scadenza sono computati a lettura (roster) — nessun cron.
module.exports = (sequelize) => {
  const ClientPackage = sequelize.define(
    'ClientPackage',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      relationshipId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'coach_clients', key: 'id' },
      },
      type: {
        type: DataTypes.STRING(16),
        allowNull: false,
        validate: { isIn: [['package', 'subscription']] },
      },
      title: { type: DataTypes.STRING(80), allowNull: false },
      totalSessions: { type: DataTypes.INTEGER, allowNull: true },
      usedSessions: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      startDate: { type: DataTypes.DATEONLY, allowNull: false },
      expiryDate: { type: DataTypes.DATEONLY, allowNull: true },
      price: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
      status: {
        type: DataTypes.STRING(16),
        allowNull: false,
        defaultValue: 'active',
        validate: { isIn: [['active', 'completed', 'expired', 'cancelled']] },
      },
      notes: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      tableName: 'client_packages',
      timestamps: true,
      indexes: [{ fields: ['relationshipId'] }],
    }
  );

  ClientPackage.associate = (models) => {
    ClientPackage.belongsTo(models.CoachClient, { foreignKey: 'relationshipId', as: 'relationship' });
  };

  return ClientPackage;
};
