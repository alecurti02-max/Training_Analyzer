'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('coach_client_profiles', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      relationshipId: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        references: { model: 'coach_clients', key: 'id' },
        onDelete: 'CASCADE',
      },
      goals: { type: Sequelize.TEXT, allowNull: true },
      anamnesis: { type: Sequelize.TEXT, allowNull: true },
      contacts: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      tags: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
      notes: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('coach_client_profiles');
  },
};
