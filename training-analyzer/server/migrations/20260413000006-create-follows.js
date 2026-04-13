'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('follows', {
      followerId: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        references: { model: 'users', key: 'uid' },
        onDelete: 'CASCADE',
      },
      followingId: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        references: { model: 'users', key: 'uid' },
        onDelete: 'CASCADE',
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('follows');
  },
};
