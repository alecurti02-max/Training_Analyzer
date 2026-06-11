'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('programs', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      coachId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'uid' },
        onDelete: 'CASCADE',
      },
      title: { type: Sequelize.STRING(120), allowNull: false },
      goal: { type: Sequelize.STRING(200), allowNull: true },
      notes: { type: Sequelize.TEXT, allowNull: true },
      weeks: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 4 },
      days: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
      progressions: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
      status: { type: Sequelize.STRING(16), allowNull: false, defaultValue: 'draft' },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('programs', ['coachId'], { name: 'programs_coach_id' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('programs');
  },
};
