'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('trainer_profiles', {
      uid: {
        type: Sequelize.UUID,
        primaryKey: true,
        references: { model: 'users', key: 'uid' },
        onDelete: 'CASCADE',
      },
      status: { type: Sequelize.STRING(16), allowNull: false, defaultValue: 'active' },
      bio: { type: Sequelize.TEXT, allowNull: true },
      activatedBy: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'uid' },
        onDelete: 'SET NULL',
      },
      source: { type: Sequelize.STRING(16), allowNull: false, defaultValue: 'self_serve' },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('trainer_profiles');
  },
};
