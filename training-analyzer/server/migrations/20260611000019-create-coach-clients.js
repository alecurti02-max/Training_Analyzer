'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('coach_clients', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      coachId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'uid' },
        onDelete: 'CASCADE',
      },
      clientId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'uid' },
        onDelete: 'CASCADE',
      },
      status: { type: Sequelize.STRING(16), allowNull: false, defaultValue: 'pending' },
      invitedBy: { type: Sequelize.STRING(8), allowNull: false, defaultValue: 'coach' },
      invitedAt: { type: Sequelize.DATE, allowNull: false },
      acceptedAt: { type: Sequelize.DATE, allowNull: true },
      endedAt: { type: Sequelize.DATE, allowNull: true },
      endedBy: { type: Sequelize.STRING(8), allowNull: true },
      sharing: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: { body: false, nutrition: false, sleep: false },
      },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('coach_clients', ['coachId', 'clientId'], {
      unique: true,
      name: 'coach_clients_coach_id_client_id',
    });
    await queryInterface.addIndex('coach_clients', ['clientId', 'status'], {
      name: 'coach_clients_client_id_status',
    });
    await queryInterface.addIndex('coach_clients', ['coachId', 'status'], {
      name: 'coach_clients_coach_id_status',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('coach_clients');
  },
};
