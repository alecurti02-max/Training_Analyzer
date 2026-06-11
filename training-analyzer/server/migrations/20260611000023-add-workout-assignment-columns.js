'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // ON DELETE SET NULL: lo storico del cliente sopravvive alla cancellazione
    // dell'assignment/programma.
    await queryInterface.addColumn('workouts', 'assignmentId', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'program_assignments', key: 'id' },
      onDelete: 'SET NULL',
    });
    await queryInterface.addColumn('workouts', 'assignmentDayKey', {
      type: Sequelize.STRING(8),
      allowNull: true,
    });
    await queryInterface.addColumn('workouts', 'assignmentWeek', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addIndex('workouts', ['assignmentId'], { name: 'workouts_assignment_id' });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('workouts', 'workouts_assignment_id');
    await queryInterface.removeColumn('workouts', 'assignmentWeek');
    await queryInterface.removeColumn('workouts', 'assignmentDayKey');
    await queryInterface.removeColumn('workouts', 'assignmentId');
  },
};
