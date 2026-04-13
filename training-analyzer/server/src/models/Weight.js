const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Weight = sequelize.define(
    'Weight',
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
      date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      value: {
        type: DataTypes.FLOAT,
        allowNull: false,
      },
    },
    {
      tableName: 'weights',
      timestamps: true,
      indexes: [
        { unique: true, fields: ['userId', 'date'] },
      ],
    }
  );

  Weight.associate = (models) => {
    Weight.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
  };

  return Weight;
};
