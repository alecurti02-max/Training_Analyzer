const { DataTypes } = require('sequelize');

// Anagrafica CRM del cliente vista dal coach (1:1 con la relazione
// coach_clients) + timeline di note. PRIVACY HARD RULE: queste righe vivono
// SOLO sotto /api/coach/* — nessuna route client-facing le restituisce mai
// (il cliente non deve vedere note/anamnesi che il PT tiene su di lui).
module.exports = (sequelize) => {
  const CoachClientProfile = sequelize.define(
    'CoachClientProfile',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      relationshipId: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: true,
        references: { model: 'coach_clients', key: 'id' },
      },
      goals: { type: DataTypes.TEXT, allowNull: true },
      anamnesis: { type: DataTypes.TEXT, allowNull: true },
      // { phone, emergencyName, emergencyPhone } — chiavi whitelisted nel controller
      contacts: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      tags: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
      // timeline append-only via endpoint dedicati: [{ id, date, text }]
      notes: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    },
    {
      tableName: 'coach_client_profiles',
      timestamps: true,
    }
  );

  CoachClientProfile.associate = (models) => {
    CoachClientProfile.belongsTo(models.CoachClient, { foreignKey: 'relationshipId', as: 'relationship' });
  };

  return CoachClientProfile;
};
