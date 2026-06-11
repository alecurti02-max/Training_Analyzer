const { DataTypes } = require('sequelize');

// Relazione coach↔cliente con consenso esplicito: il trainer invita (pending),
// il cliente accetta (active) o rifiuta (declined); entrambi possono chiudere
// (ended). UNIQUE pieno su (coachId, clientId): un re-invito dopo ended/declined
// riusa la riga resettandola a pending. Nessun vincolo 1-coach-per-cliente.
// `sharing` è l'opt-in del cliente sui dati sensibili (modificabile SOLO da lui).
module.exports = (sequelize) => {
  const CoachClient = sequelize.define(
    'CoachClient',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
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
      status: {
        type: DataTypes.STRING(16),
        allowNull: false,
        defaultValue: 'pending',
        validate: { isIn: [['pending', 'active', 'ended', 'declined']] },
      },
      invitedBy: {
        type: DataTypes.STRING(8),
        allowNull: false,
        defaultValue: 'coach',
        validate: { isIn: [['coach', 'client']] },
      },
      invitedAt: { type: DataTypes.DATE, allowNull: false },
      acceptedAt: { type: DataTypes.DATE, allowNull: true },
      endedAt: { type: DataTypes.DATE, allowNull: true },
      endedBy: {
        type: DataTypes.STRING(8),
        allowNull: true,
        validate: { isIn: [['coach', 'client']] },
      },
      sharing: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: { body: false, nutrition: false, sleep: false },
      },
    },
    {
      tableName: 'coach_clients',
      timestamps: true,
      indexes: [
        { unique: true, fields: ['coachId', 'clientId'] },
        { fields: ['clientId', 'status'] },
        { fields: ['coachId', 'status'] },
      ],
      validate: {
        notSelfCoaching() {
          if (this.coachId === this.clientId) {
            throw new Error('coachId and clientId must differ');
          }
        },
      },
    }
  );

  CoachClient.associate = (models) => {
    CoachClient.belongsTo(models.User, { foreignKey: 'coachId', as: 'coach' });
    CoachClient.belongsTo(models.User, { foreignKey: 'clientId', as: 'client' });
  };

  return CoachClient;
};
