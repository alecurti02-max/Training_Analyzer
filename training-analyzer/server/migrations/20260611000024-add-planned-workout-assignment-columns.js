'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Pin di un giorno-scheda su una data del calendario cliente.
    await queryInterface.addColumn('planned_workouts', 'assignmentId', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'program_assignments', key: 'id' },
      onDelete: 'SET NULL',
    });
    await queryInterface.addColumn('planned_workouts', 'dayKey', {
      type: Sequelize.STRING(8),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('planned_workouts', 'dayKey');
    await queryInterface.removeColumn('planned_workouts', 'assignmentId');
  },
};
