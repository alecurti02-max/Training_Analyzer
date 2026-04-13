const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Follow = sequelize.define(
    'Follow',
    {
      followerId: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        references: { model: 'users', key: 'uid' },
      },
      followingId: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        references: { model: 'users', key: 'uid' },
      },
    },
    {
      tableName: 'follows',
      timestamps: true,
      updatedAt: false,
    }
  );

  Follow.associate = (models) => {
    Follow.belongsTo(models.User, { foreignKey: 'followerId', as: 'follower' });
    Follow.belongsTo(models.User, { foreignKey: 'followingId', as: 'followedUser' });
  };

  return Follow;
};
