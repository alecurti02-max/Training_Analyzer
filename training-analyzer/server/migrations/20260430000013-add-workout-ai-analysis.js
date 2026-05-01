'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('workouts', 'aiAnalysis', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: null,
    });
    await queryInterface.addColumn('workouts', 'aiAnalysisGeneratedAt', {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null,
    });
    await queryInterface.addColumn('workouts', 'aiAnalysisModel', {
      type: Sequelize.STRING(64),
      allowNull: true,
      defaultValue: null,
    });
    await queryInterface.addColumn('workouts', 'aiAnalysisVersion', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('workouts', 'aiAnalysisVersion');
    await queryInterface.removeColumn('workouts', 'aiAnalysisModel');
    await queryInterface.removeColumn('workouts', 'aiAnalysisGeneratedAt');
    await queryInterface.removeColumn('workouts', 'aiAnalysis');
  },
};
