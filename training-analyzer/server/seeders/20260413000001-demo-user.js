'use strict';

const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const DEMO_UID = '00000000-0000-4000-a000-000000000001';

module.exports = {
  async up(queryInterface) {
    // --- Demo user ---
    await queryInterface.bulkInsert('users', [
      {
        uid: DEMO_UID,
        email: 'demo@training-analyzer.app',
        displayName: 'Demo User',
        photoURL: null,
        provider: 'local',
        passwordHash: bcrypt.hashSync('Demo123!', 10),
        refreshToken: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    // --- Settings ---
    await queryInterface.bulkInsert('settings', [
      {
        userId: DEMO_UID,
        fcMax: 190,
        fcRest: 55,
        weight: 78,
        height: 180,
        vo2max: 48,
        age: 25,
        sex: 'M',
        flexibility: 6,
        weekgoal: 4,
        kmgoal: 20,
        activeSports: JSON.stringify(['gym', 'running', 'karting']),
        activeGroups: JSON.stringify([
          'Petto', 'Schiena', 'Spalle', 'Bicipiti', 'Tricipiti',
          'Quadricipiti', 'Femorali', 'Glutei', 'Polpacci',
          'Addominali', 'Avambracci', 'Trapezio', 'Full Body',
        ]),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    // --- Exercises ---
    const exercises = [
      { name: 'Panca Piana', muscle: 'Petto', param: 'reps' },
      { name: 'Squat', muscle: 'Quadricipiti', param: 'reps' },
      { name: 'Stacco da Terra', muscle: 'Schiena', param: 'reps' },
      { name: 'Curl Bilanciere', muscle: 'Bicipiti', param: 'reps' },
      { name: 'Lat Machine', muscle: 'Schiena', param: 'reps' },
    ];
    await queryInterface.bulkInsert(
      'exercises',
      exercises.map((ex) => ({
        id: uuidv4(),
        userId: DEMO_UID,
        ...ex,
        createdAt: new Date(),
        updatedAt: new Date(),
      }))
    );

    // --- 3 Sample workouts ---
    const workoutGym = {
      id: uuidv4(),
      userId: DEMO_UID,
      type: 'gym',
      date: '2026-04-10',
      score: 7.5,
      data: JSON.stringify({
        duration: 65,
        rpe: 8,
        exercises: [
          {
            name: 'Panca Piana',
            muscle: 'Petto',
            sets: [
              { reps: 8, weight: 80, rpe: 7 },
              { reps: 8, weight: 85, rpe: 8 },
              { reps: 6, weight: 90, rpe: 9 },
            ],
          },
          {
            name: 'Squat',
            muscle: 'Quadricipiti',
            sets: [
              { reps: 10, weight: 100, rpe: 7 },
              { reps: 8, weight: 110, rpe: 8 },
              { reps: 6, weight: 120, rpe: 9 },
            ],
          },
          {
            name: 'Lat Machine',
            muscle: 'Schiena',
            sets: [
              { reps: 10, weight: 60, rpe: 6 },
              { reps: 10, weight: 65, rpe: 7 },
              { reps: 8, weight: 70, rpe: 8 },
            ],
          },
        ],
        _tonnage: 4930,
        scores: {
          overall: 7.5,
          volume: 8,
          intensity: 7,
          variety: 8,
          progression: 7,
          duration: 7,
        },
        advice: [
          'Buon volume di allenamento. Prova ad aumentare leggermente i carichi la prossima volta.',
        ],
      }),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const workoutRun = {
      id: uuidv4(),
      userId: DEMO_UID,
      type: 'running',
      date: '2026-04-11',
      score: 6.8,
      data: JSON.stringify({
        duration: 48,
        distance: 10.2,
        pace: '4:42',
        _pace: 282,
        avghr: 162,
        maxhr: 178,
        elevation: 85,
        cadence: 172,
        runType: 'tempo',
        rpe: 7,
        scores: {
          overall: 6.8,
          distance: 7,
          pace: 7,
          hrEfficiency: 6,
          effort: 7,
        },
        advice: [
          'Buon ritmo! Lavora sulla cadenza per migliorare l\'efficienza.',
        ],
      }),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const workoutKart = {
      id: uuidv4(),
      userId: DEMO_UID,
      type: 'karting',
      date: '2026-04-12',
      score: 7.2,
      data: JSON.stringify({
        duration: 30,
        track: 'Pista Azzurra',
        laps: 20,
        bestLap: '48.3',
        avgLap: '49.8',
        rpe: 6,
        scores: {
          overall: 7.2,
          consistency: 7,
          improvement: 8,
          effort: 6,
        },
        advice: [
          'Buona costanza nei giri. Cerca di migliorare il best lap.',
        ],
      }),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await queryInterface.bulkInsert('workouts', [workoutGym, workoutRun, workoutKart]);

    // --- Weight entries ---
    await queryInterface.bulkInsert('weights', [
      { id: uuidv4(), userId: DEMO_UID, date: '2026-04-10', value: 78.2, createdAt: new Date(), updatedAt: new Date() },
      { id: uuidv4(), userId: DEMO_UID, date: '2026-04-11', value: 77.9, createdAt: new Date(), updatedAt: new Date() },
      { id: uuidv4(), userId: DEMO_UID, date: '2026-04-12', value: 78.0, createdAt: new Date(), updatedAt: new Date() },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('follows', null, {});
    await queryInterface.bulkDelete('weights', null, {});
    await queryInterface.bulkDelete('workouts', null, {});
    await queryInterface.bulkDelete('exercises', null, {});
    await queryInterface.bulkDelete('settings', null, {});
    await queryInterface.bulkDelete('users', null, {});
  },
};
