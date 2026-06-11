'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('planned_workouts', 'createdByCoachId', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'users', key: 'uid' },
      onDelete: 'SET NULL',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('planned_workouts', 'createdByCoachId');
  },
};
