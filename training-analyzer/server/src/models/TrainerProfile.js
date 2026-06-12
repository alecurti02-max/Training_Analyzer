const { DataTypes } = require('sequelize');

// Profilo Personal Trainer (1:1 con users). La presenza di una riga con
// status='active' rende l'utente un trainer; il ruolo resta separato da
// User.role (un trainer è anche atleta, e l'admin è ortogonale). `source` e
// `activatedBy` predispongono l'attivazione futura da parte di un gestore
// palestra senza cambiare schema.
module.exports = (sequelize) => {
  const TrainerProfile = sequelize.define(
    'TrainerProfile',
    {
      uid: {
        type: DataTypes.UUID,
        primaryKey: true,
        references: { model: 'users', key: 'uid' },
      },
      status: {
        type: DataTypes.STRING(16),
        allowNull: false,
        defaultValue: 'active',
        validate: { isIn: [['active', 'suspended', 'pending']] },
      },
      bio: { type: DataTypes.TEXT, allowNull: true },
      activatedBy: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'users', key: 'uid' },
      },
      source: {
        type: DataTypes.STRING(16),
        allowNull: false,
        defaultValue: 'self_serve',
        validate: { isIn: [['self_serve', 'seed', 'admin', 'gym']] },
      },
    },
    {
      tableName: 'trainer_profiles',
      timestamps: true,
    }
  );

  TrainerProfile.associate = (models) => {
    TrainerProfile.belongsTo(models.User, { foreignKey: 'uid', as: 'user' });
  };

  return TrainerProfile;
};
