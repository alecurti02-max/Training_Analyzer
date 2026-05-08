const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const NutritionLog = sequelize.define(
    'NutritionLog',
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
      date: { type: DataTypes.DATEONLY, allowNull: false },
      calories: { type: DataTypes.INTEGER, allowNull: true },
      proteinG: { type: DataTypes.FLOAT, allowNull: true },
      carbsG: { type: DataTypes.FLOAT, allowNull: true },
      fatG: { type: DataTypes.FLOAT, allowNull: true },
      notes: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      tableName: 'nutrition_logs',
      timestamps: true,
      indexes: [{ unique: true, fields: ['userId', 'date'] }],
    }
  );

  NutritionLog.associate = (models) => {
    NutritionLog.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
  };

  return NutritionLog;
};
