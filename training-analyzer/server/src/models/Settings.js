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
      fcMax: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      fcRest: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      weight: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      height: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      vo2max: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      age: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      sex: {
        type: DataTypes.STRING(1),
        allowNull: true,
      },
      flexibility: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      weekgoal: {
        type: DataTypes.INTEGER,
        defaultValue: 4,
      },
      kmgoal: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      activeSports: {
        type: DataTypes.JSONB,
        defaultValue: ['gym', 'running'],
      },
      activeGroups: {
        type: DataTypes.JSONB,
        defaultValue: [
          'Petto', 'Schiena', 'Spalle', 'Bicipiti', 'Tricipiti',
          'Quadricipiti', 'Femorali', 'Glutei', 'Polpacci',
          'Addominali', 'Avambracci', 'Trapezio', 'Full Body',
        ],
      },
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
