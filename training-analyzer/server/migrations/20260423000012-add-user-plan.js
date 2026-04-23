'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'plan', {
      type: Sequelize.ENUM('free', 'premium'),
      allowNull: false,
      defaultValue: 'free',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'plan');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_users_plan";');
  },
};
