const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Exercise = sequelize.define(
    'Exercise',
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
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      muscle: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      param: {
        type: DataTypes.STRING,
        defaultValue: 'reps',
      },
      weightMode: {
        type: DataTypes.STRING,
        defaultValue: 'total',
      },
      barbellWeight: {
        type: DataTypes.FLOAT,
        allowNull: true,
        defaultValue: null,
      },
      isUnilateral: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
    },
    {
      tableName: 'exercises',
      timestamps: true,
      indexes: [
        { unique: true, fields: ['userId', 'name'] },
      ],
    }
  );

  Exercise.associate = (models) => {
    Exercise.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
  };

  return Exercise;
};
