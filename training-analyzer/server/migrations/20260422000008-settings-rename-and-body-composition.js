'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.renameColumn('settings', 'fcMax', 'maxhr');
    await queryInterface.renameColumn('settings', 'fcRest', 'resthr');
    await queryInterface.renameColumn('settings', 'weight', 'bodyweight');
    await queryInterface.renameColumn('settings', 'sex', 'gender');
    await queryInterface.renameColumn('settings', 'activeGroups', 'muscleGroups');

    const circ = ['circChest', 'circWaist', 'circHips', 'circShoulders',
                  'circBicep', 'circNeck', 'circThigh', 'circCalf'];
    for (const c of circ) {
      await queryInterface.addColumn('settings', c, { type: Sequelize.FLOAT, allowNull: true });
    }

    const bodyComp = ['bodyFat', 'skeletalMuscle', 'subcutaneousFat', 'visceralFat',
                      'bodyWater', 'muscleMass', 'boneMass', 'protein'];
    for (const b of bodyComp) {
      await queryInterface.addColumn('settings', b, { type: Sequelize.FLOAT, allowNull: true });
    }
  },

  async down(queryInterface) {
    const bodyComp = ['bodyFat', 'skeletalMuscle', 'subcutaneousFat', 'visceralFat',
                      'bodyWater', 'muscleMass', 'boneMass', 'protein'];
    for (const b of bodyComp) {
      await queryInterface.removeColumn('settings', b);
    }
    const circ = ['circChest', 'circWaist', 'circHips', 'circShoulders',
                  'circBicep', 'circNeck', 'circThigh', 'circCalf'];
    for (const c of circ) {
      await queryInterface.removeColumn('settings', c);
    }
    await queryInterface.renameColumn('settings', 'muscleGroups', 'activeGroups');
    await queryInterface.renameColumn('settings', 'gender', 'sex');
    await queryInterface.renameColumn('settings', 'bodyweight', 'weight');
    await queryInterface.renameColumn('settings', 'resthr', 'fcRest');
    await queryInterface.renameColumn('settings', 'maxhr', 'fcMax');
  },
};
