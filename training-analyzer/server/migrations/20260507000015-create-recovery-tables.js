'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // ----- nutrition_logs -----
    await queryInterface.createTable('nutrition_logs', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'uid' },
        onDelete: 'CASCADE',
      },
      date: { type: Sequelize.DATEONLY, allowNull: false },
      calories: { type: Sequelize.INTEGER, allowNull: true },
      proteinG: { type: Sequelize.FLOAT, allowNull: true },
      carbsG: { type: Sequelize.FLOAT, allowNull: true },
      fatG: { type: Sequelize.FLOAT, allowNull: true },
      notes: { type: Sequelize.TEXT, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('nutrition_logs', ['userId', 'date'], {
      unique: true,
      name: 'nutrition_logs_user_id_date',
    });

    // ----- sleep_logs -----
    await queryInterface.createTable('sleep_logs', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'uid' },
        onDelete: 'CASCADE',
      },
      // `date` = giorno del risveglio (la notte attribuita a quel giorno)
      date: { type: Sequelize.DATEONLY, allowNull: false },
      durationHours: { type: Sequelize.FLOAT, allowNull: true },
      quality: { type: Sequelize.INTEGER, allowNull: true }, // 1-10
      notes: { type: Sequelize.TEXT, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('sleep_logs', ['userId', 'date'], {
      unique: true,
      name: 'sleep_logs_user_id_date',
    });

    // ----- settings: target alimentazione + sonno -----
    await queryInterface.addColumn('settings', 'caloriesTarget', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addColumn('settings', 'proteinTargetG', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addColumn('settings', 'sleepHoursTarget', {
      type: Sequelize.FLOAT,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('nutrition_logs');
    await queryInterface.dropTable('sleep_logs');
    await queryInterface.removeColumn('settings', 'caloriesTarget');
    await queryInterface.removeColumn('settings', 'proteinTargetG');
    await queryInterface.removeColumn('settings', 'sleepHoursTarget');
  },
};
