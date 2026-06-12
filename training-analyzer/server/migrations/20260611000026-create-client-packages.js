'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('client_packages', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      relationshipId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'coach_clients', key: 'id' },
        onDelete: 'CASCADE',
      },
      type: { type: Sequelize.STRING(16), allowNull: false },
      title: { type: Sequelize.STRING(80), allowNull: false },
      totalSessions: { type: Sequelize.INTEGER, allowNull: true },
      usedSessions: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      startDate: { type: Sequelize.DATEONLY, allowNull: false },
      expiryDate: { type: Sequelize.DATEONLY, allowNull: true },
      price: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
      status: { type: Sequelize.STRING(16), allowNull: false, defaultValue: 'active' },
      notes: { type: Sequelize.TEXT, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('client_packages', ['relationshipId'], { name: 'client_packages_relationship_id' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('client_packages');
  },
};
