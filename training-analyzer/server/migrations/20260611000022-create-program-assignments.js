'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('program_assignments', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      programId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'programs', key: 'id' },
        onDelete: 'CASCADE',
      },
      coachId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'uid' },
        onDelete: 'CASCADE',
      },
      clientId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'uid' },
        onDelete: 'CASCADE',
      },
      startDate: { type: Sequelize.DATEONLY, allowNull: false },
      weekdayMap: { type: Sequelize.JSONB, allowNull: true },
      status: { type: Sequelize.STRING(16), allowNull: false, defaultValue: 'active' },
      note: { type: Sequelize.TEXT, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('program_assignments', ['clientId', 'status'], { name: 'program_assignments_client_id_status' });
    await queryInterface.addIndex('program_assignments', ['coachId', 'status'], { name: 'program_assignments_coach_id_status' });
    // PG non indicizza le FK automaticamente: serve per il check di DELETE
    // programma (count per programId) e le query program-centriche future.
    await queryInterface.addIndex('program_assignments', ['programId'], { name: 'program_assignments_program_id' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('program_assignments');
  },
};
