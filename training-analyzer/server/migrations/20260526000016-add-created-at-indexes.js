'use strict';

// Supports admin dashboard COUNT queries filtering on createdAt
// (users/workouts created in the last 7/30 days) — without these the planner
// falls back to seq scan.
module.exports = {
  async up(queryInterface) {
    await queryInterface.addIndex('users', ['createdAt'], {
      name: 'users_created_at',
    });
    await queryInterface.addIndex('workouts', ['createdAt'], {
      name: 'workouts_created_at',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('users', 'users_created_at');
    await queryInterface.removeIndex('workouts', 'workouts_created_at');
  },
};
