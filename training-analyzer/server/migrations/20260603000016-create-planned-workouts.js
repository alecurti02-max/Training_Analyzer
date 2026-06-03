'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('planned_workouts', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'uid' },
        onDelete: 'CASCADE',
      },
      date: { type: Sequelize.DATEONLY, allowNull: false },
      type: { type: Sequelize.STRING, allowNull: false, defaultValue: 'gym' },
      muscleGroups: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
      exercises: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
      note: { type: Sequelize.TEXT, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('planned_workouts', ['userId', 'date'], {
      unique: true,
      name: 'planned_workouts_user_id_date',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('planned_workouts');
  },
};
