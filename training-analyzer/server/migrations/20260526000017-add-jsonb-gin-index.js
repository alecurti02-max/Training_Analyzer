'use strict';

// GIN index on workouts.data for future containment queries (`data @> '{...}'`).
// Postgres-only: SQLite (used by the test suite) doesn't support GIN, so we
// short-circuit cleanly when the dialect isn't postgres. `jsonb_path_ops` is
// smaller and faster than the default `jsonb_ops` opclass for @>/?? queries.
module.exports = {
  async up(queryInterface) {
    if (queryInterface.sequelize.getDialect() !== 'postgres') return;
    await queryInterface.sequelize.query(
      'CREATE INDEX IF NOT EXISTS workouts_data_gin ON workouts USING GIN (data jsonb_path_ops)'
    );
  },

  async down(queryInterface) {
    if (queryInterface.sequelize.getDialect() !== 'postgres') return;
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS workouts_data_gin');
  },
};
