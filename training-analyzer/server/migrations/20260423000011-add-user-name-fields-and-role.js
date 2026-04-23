'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'firstName', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('users', 'lastName', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('users', 'role', {
      type: Sequelize.ENUM('user', 'admin'),
      allowNull: false,
      defaultValue: 'user',
    });

    await queryInterface.sequelize.query(`
      UPDATE users
      SET "firstName" = split_part("displayName", ' ', 1),
          "lastName"  = NULLIF(regexp_replace("displayName", '^\\S+\\s*', ''), '')
      WHERE "displayName" IS NOT NULL AND "firstName" IS NULL;
    `);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'role');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_users_role";');
    await queryInterface.removeColumn('users', 'lastName');
    await queryInterface.removeColumn('users', 'firstName');
  },
};
