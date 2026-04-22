'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('settings', 'weightTarget', {
      type: Sequelize.FLOAT,
      allowNull: true,
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('settings', 'weightTarget');
  },
};
