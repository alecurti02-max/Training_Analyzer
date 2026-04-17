'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('exercises', 'weightMode', {
      type: Sequelize.STRING,
      defaultValue: 'total',
    });
    await queryInterface.addColumn('exercises', 'barbellWeight', {
      type: Sequelize.FLOAT,
      allowNull: true,
      defaultValue: null,
    });
    await queryInterface.addColumn('exercises', 'isUnilateral', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('exercises', 'weightMode');
    await queryInterface.removeColumn('exercises', 'barbellWeight');
    await queryInterface.removeColumn('exercises', 'isUnilateral');
  },
};
