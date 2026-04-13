#!/usr/bin/env node
/**
 * Migrazione dati da Firebase Realtime Database a PostgreSQL.
 *
 * Prerequisiti:
 *   npm install firebase-admin --save-dev
 *   Scaricare il service account JSON da Firebase Console
 *   Impostare FIREBASE_SERVICE_ACCOUNT_PATH e DATABASE_URL nel .env
 *
 * Uso:
 *   node scripts/migrateFromFirebase.js              # esegue la migrazione
 *   node scripts/migrateFromFirebase.js --dry-run    # mostra cosa verrebbe migrato
 */

require('dotenv').config();
const admin = require('firebase-admin');
const { sequelize, User, Workout, Exercise, Settings, Weight, Follow } = require('../src/models');

const DRY_RUN = process.argv.includes('--dry-run');
const DEFAULT_MUSCLES = [
  'Petto', 'Schiena', 'Spalle', 'Bicipiti', 'Tricipiti',
  'Quadricipiti', 'Femorali', 'Glutei', 'Polpacci',
  'Addominali', 'Avambracci', 'Trapezio', 'Full Body',
];

// Stats
let stats = { users: 0, workouts: 0, exercises: 0, settings: 0, weights: 0, follows: 0, errors: 0 };
const pendingFollows = [];

async function main() {
  console.log(DRY_RUN ? '=== DRY RUN MODE ===' : '=== MIGRAZIONE FIREBASE -> POSTGRESQL ===');

  // Init Firebase Admin
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './firebase-service-account.json';
  const serviceAccount = require(require('path').resolve(serviceAccountPath));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
  });

  // Connect to PostgreSQL
  if (!DRY_RUN) {
    await sequelize.authenticate();
    console.log('PostgreSQL connected');
  }

  // Read all Firebase data
  const fbDb = admin.database();
  console.log('Reading Firebase data...');

  const usersSnap = await fbDb.ref('users').once('value');
  const usersData = usersSnap.val() || {};
  const userIds = Object.keys(usersData);
  console.log(`Found ${userIds.length} users in Firebase`);

  // Migrate each user
  for (const [idx, firebaseUid] of userIds.entries()) {
    const userData = usersData[firebaseUid];
    if (idx % 10 === 0) console.log(`Processing user ${idx + 1}/${userIds.length}...`);

    try {
      await migrateUser(firebaseUid, userData);
      stats.users++;
    } catch (err) {
      console.error(`Error migrating user ${firebaseUid}:`, err.message);
      stats.errors++;
    }
  }

  // Second pass: create Follow relationships
  console.log(`\nCreating ${pendingFollows.length} follow relationships...`);
  for (const { followerId, followingId, createdAt } of pendingFollows) {
    try {
      if (!DRY_RUN) {
        await Follow.findOrCreate({
          where: { followerId, followingId },
          defaults: { followerId, followingId, createdAt: createdAt || new Date() },
        });
      }
      stats.follows++;
    } catch (err) {
      // Skip if either user doesn't exist in PG
      if (err.name !== 'SequelizeForeignKeyConstraintError') {
        console.warn(`Follow ${followerId} -> ${followingId}: ${err.message}`);
      }
    }
  }

  // Summary
  console.log('\n=== RIEPILOGO ===');
  console.log(`Utenti:     ${stats.users}`);
  console.log(`Workout:    ${stats.workouts}`);
  console.log(`Esercizi:   ${stats.exercises}`);
  console.log(`Settings:   ${stats.settings}`);
  console.log(`Pesi:       ${stats.weights}`);
  console.log(`Follow:     ${stats.follows}`);
  console.log(`Errori:     ${stats.errors}`);
  if (DRY_RUN) console.log('\n(Dry run — nessun dato scritto)');

  await sequelize.close();
  process.exit(0);
}

async function migrateUser(uid, data) {
  const profile = data.profile || {};

  if (DRY_RUN) {
    console.log(`  [DRY] User: ${profile.displayName || uid} (${profile.email || 'no email'})`);
    countData(data);
    collectFollows(uid, data.following);
    return;
  }

  await sequelize.transaction(async (t) => {
    // User
    await User.findOrCreate({
      where: { uid },
      defaults: {
        uid,
        email: profile.email || `${uid}@migrated.local`,
        displayName: profile.displayName || '',
        photoURL: profile.photoURL || '',
        provider: 'google',
        createdAt: profile.createdAt ? new Date(profile.createdAt) : new Date(),
      },
      transaction: t,
    });

    // Workouts
    if (data.workouts) {
      const workouts = Object.values(data.workouts);
      for (const w of workouts) {
        try {
          await Workout.findOrCreate({
            where: { id: w.id, userId: uid },
            defaults: {
              id: w.id,
              userId: uid,
              type: w.type || 'gym',
              date: w.date,
              score: w.scores?.overall ?? null,
              data: w,
            },
            transaction: t,
          });
          stats.workouts++;
        } catch (err) {
          console.warn(`  Workout ${w.id}: ${err.message}`);
        }
      }
    }

    // Exercises
    if (data.exercises) {
      const exercises = Array.isArray(data.exercises) ? data.exercises : Object.values(data.exercises);
      for (const ex of exercises) {
        if (!ex || !ex.name) continue;
        try {
          await Exercise.findOrCreate({
            where: { userId: uid, name: ex.name },
            defaults: {
              userId: uid,
              name: ex.name,
              muscle: ex.muscle || 'Full Body',
              param: ex.param || 'reps',
            },
            transaction: t,
          });
          stats.exercises++;
        } catch (err) {
          // Skip duplicates silently
        }
      }
    }

    // Settings
    if (data.settings) {
      const s = data.settings;
      try {
        await Settings.findOrCreate({
          where: { userId: uid },
          defaults: {
            userId: uid,
            fcMax: s.maxhr || null,
            fcRest: s.resthr || null,
            weight: s.bodyweight || null,
            height: s.height || null,
            vo2max: s.vo2max || null,
            age: s.age || null,
            sex: s.gender || null,
            flexibility: s.flexibility || null,
            weekgoal: s.weekgoal || 4,
            kmgoal: s.kmgoal || null,
            activeSports: s.activeSports || ['gym', 'running'],
            activeGroups: s.muscleGroups || DEFAULT_MUSCLES,
          },
          transaction: t,
        });
        stats.settings++;
      } catch (err) {
        console.warn(`  Settings: ${err.message}`);
      }
    }

    // Weights
    if (data.weights) {
      for (const w of Object.values(data.weights)) {
        if (!w || !w.date || !w.value) continue;
        try {
          await Weight.findOrCreate({
            where: { userId: uid, date: w.date },
            defaults: { userId: uid, date: w.date, value: w.value },
            transaction: t,
          });
          stats.weights++;
        } catch (err) {
          // Skip duplicates
        }
      }
    }

    // Collect follows for second pass
    collectFollows(uid, data.following);
  });
}

function collectFollows(uid, following) {
  if (!following) return;
  for (const [followedUid, info] of Object.entries(following)) {
    pendingFollows.push({
      followerId: uid,
      followingId: followedUid,
      createdAt: info?.followedAt ? new Date(info.followedAt) : new Date(),
    });
  }
}

function countData(data) {
  if (data.workouts) stats.workouts += Object.keys(data.workouts).length;
  if (data.exercises) {
    const ex = Array.isArray(data.exercises) ? data.exercises : Object.values(data.exercises);
    stats.exercises += ex.length;
  }
  if (data.settings) stats.settings++;
  if (data.weights) stats.weights += Object.keys(data.weights).length;
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
