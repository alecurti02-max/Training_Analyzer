'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('users', {
      uid: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      displayName: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      photoURL: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      provider: {
        type: Sequelize.ENUM('google', 'local'),
        defaultValue: 'google',
      },
      passwordHash: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      refreshToken: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('users');
  },
};
