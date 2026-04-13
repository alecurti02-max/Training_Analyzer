'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('settings', {
      userId: {
        type: Sequelize.UUID,
        primaryKey: true,
        references: { model: 'users', key: 'uid' },
        onDelete: 'CASCADE',
      },
      fcMax: { type: Sequelize.INTEGER, allowNull: true },
      fcRest: { type: Sequelize.INTEGER, allowNull: true },
      weight: { type: Sequelize.FLOAT, allowNull: true },
      height: { type: Sequelize.INTEGER, allowNull: true },
      vo2max: { type: Sequelize.FLOAT, allowNull: true },
      age: { type: Sequelize.INTEGER, allowNull: true },
      sex: { type: Sequelize.STRING(1), allowNull: true },
      flexibility: { type: Sequelize.INTEGER, allowNull: true },
      weekgoal: { type: Sequelize.INTEGER, defaultValue: 4 },
      kmgoal: { type: Sequelize.INTEGER, allowNull: true },
      activeSports: {
        type: Sequelize.JSONB,
        defaultValue: ['gym', 'running'],
      },
      activeGroups: {
        type: Sequelize.JSONB,
        defaultValue: [
          'Petto', 'Schiena', 'Spalle', 'Bicipiti', 'Tricipiti',
          'Quadricipiti', 'Femorali', 'Glutei', 'Polpacci',
          'Addominali', 'Avambracci', 'Trapezio', 'Full Body',
        ],
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('settings');
  },
};
