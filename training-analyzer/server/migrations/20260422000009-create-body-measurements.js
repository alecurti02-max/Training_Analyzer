'use strict';

const CIRC = ['circChest', 'circWaist', 'circHips', 'circShoulders',
              'circBicep', 'circNeck', 'circThigh', 'circCalf'];
const COMP = ['bodyFat', 'skeletalMuscle', 'subcutaneousFat', 'visceralFat',
              'bodyWater', 'muscleMass', 'boneMass', 'protein'];
const ALL = [...CIRC, ...COMP];

module.exports = {
  async up(queryInterface, Sequelize) {
    const cols = {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'uid' },
        onDelete: 'CASCADE',
      },
      date: { type: Sequelize.DATEONLY, allowNull: false },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    };
    for (const f of ALL) cols[f] = { type: Sequelize.FLOAT, allowNull: true };

    await queryInterface.createTable('body_measurements', cols);
    await queryInterface.addIndex('body_measurements', ['userId', 'date'], {
      unique: true,
      name: 'body_measurements_user_id_date',
    });

    // Backfill: for every settings row with at least one non-null measurement,
    // create a first historical entry dated today.
    const today = new Date().toISOString().slice(0, 10);
    const notNullCheck = ALL.map((c) => `"${c}" IS NOT NULL`).join(' OR ');
    const selectCols = ALL.map((c) => `"${c}"`).join(', ');
    await queryInterface.sequelize.query(`
      INSERT INTO body_measurements ("id", "userId", "date", ${selectCols}, "createdAt", "updatedAt")
      SELECT gen_random_uuid(), "userId", :today, ${selectCols}, NOW(), NOW()
      FROM settings
      WHERE ${notNullCheck}
      ON CONFLICT ("userId", "date") DO NOTHING;
    `, { replacements: { today } });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('body_measurements');
  },
};
