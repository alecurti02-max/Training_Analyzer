const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Settings = sequelize.define(
    'Settings',
    {
      userId: {
        type: DataTypes.UUID,
        primaryKey: true,
        references: { model: 'users', key: 'uid' },
      },
      maxhr: { type: DataTypes.INTEGER, allowNull: true },
      resthr: { type: DataTypes.INTEGER, allowNull: true },
      bodyweight: { type: DataTypes.FLOAT, allowNull: true },
      height: { type: DataTypes.INTEGER, allowNull: true },
      vo2max: { type: DataTypes.FLOAT, allowNull: true },
      age: { type: DataTypes.INTEGER, allowNull: true },
      gender: { type: DataTypes.STRING(1), allowNull: true },
      flexibility: { type: DataTypes.INTEGER, allowNull: true },
      weekgoal: { type: DataTypes.INTEGER, defaultValue: 4 },
      kmgoal: { type: DataTypes.INTEGER, allowNull: true },
      activeSports: {
        type: DataTypes.JSONB,
        defaultValue: ['gym', 'running'],
      },
      muscleGroups: {
        type: DataTypes.JSONB,
        defaultValue: [
          'Petto', 'Schiena', 'Spalle', 'Bicipiti', 'Tricipiti',
          'Quadricipiti', 'Femorali', 'Glutei', 'Polpacci',
          'Addominali', 'Avambracci', 'Trapezio', 'Full Body',
        ],
      },
      // Circonferenze corporee (cm)
      circChest: { type: DataTypes.FLOAT, allowNull: true },
      circWaist: { type: DataTypes.FLOAT, allowNull: true },
      circHips: { type: DataTypes.FLOAT, allowNull: true },
      circShoulders: { type: DataTypes.FLOAT, allowNull: true },
      circBicep: { type: DataTypes.FLOAT, allowNull: true },
      circNeck: { type: DataTypes.FLOAT, allowNull: true },
      circThigh: { type: DataTypes.FLOAT, allowNull: true },
      circCalf: { type: DataTypes.FLOAT, allowNull: true },
      // Composizione corporea (opzionale, da bilancia impedenziometrica)
      bodyFat: { type: DataTypes.FLOAT, allowNull: true },
      skeletalMuscle: { type: DataTypes.FLOAT, allowNull: true },
      subcutaneousFat: { type: DataTypes.FLOAT, allowNull: true },
      visceralFat: { type: DataTypes.FLOAT, allowNull: true },
      bodyWater: { type: DataTypes.FLOAT, allowNull: true },
      muscleMass: { type: DataTypes.FLOAT, allowNull: true },
      boneMass: { type: DataTypes.FLOAT, allowNull: true },
      protein: { type: DataTypes.FLOAT, allowNull: true },
    },
    {
      tableName: 'settings',
      timestamps: true,
    }
  );

  Settings.associate = (models) => {
    Settings.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
  };

  return Settings;
};
