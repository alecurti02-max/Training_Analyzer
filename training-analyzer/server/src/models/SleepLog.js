const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const SleepLog = sequelize.define(
    'SleepLog',
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
      // Convenzione: `date` = giorno del risveglio.
      date: { type: DataTypes.DATEONLY, allowNull: false },
      durationHours: { type: DataTypes.FLOAT, allowNull: true },
      quality: { type: DataTypes.INTEGER, allowNull: true }, // scala 1-10
      notes: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      tableName: 'sleep_logs',
      timestamps: true,
      indexes: [{ unique: true, fields: ['userId', 'date'] }],
    }
  );

  SleepLog.associate = (models) => {
    SleepLog.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
  };

  return SleepLog;
};
