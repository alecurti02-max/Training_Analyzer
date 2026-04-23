const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const { User, Settings } = require('../models');

// ── Google OAuth2 (only if credentials are configured) ──
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) return done(null, false, { message: 'No email from Google' });

          const firstName = profile.name?.givenName || null;
          const lastName = profile.name?.familyName || null;

          let user = await User.findOne({ where: { email } });

          if (user) {
            const updates = {};
            if (!user.displayName) updates.displayName = profile.displayName;
            if (!user.photoURL) updates.photoURL = profile.photos?.[0]?.value;
            if (!user.firstName && firstName) updates.firstName = firstName;
            if (!user.lastName && lastName) updates.lastName = lastName;
            if (Object.keys(updates).length) await user.update(updates);
          } else {
            user = await User.create({
              email,
              displayName: profile.displayName,
              firstName,
              lastName,
              photoURL: profile.photos?.[0]?.value || null,
              provider: 'google',
            });
            await Settings.create({ userId: user.uid });
          }

          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    )
  );
} else {
  console.warn('Google OAuth not configured — Google login disabled');
}

// ── Local (email + password) ──
passport.use(
  new LocalStrategy(
    { usernameField: 'email', passwordField: 'password' },
    async (email, password, done) => {
      try {
        const user = await User.findOne({ where: { email } });
        if (!user || !user.passwordHash) {
          return done(null, false, { message: 'Email o password non validi' });
        }

        const match = await bcrypt.compare(password, user.passwordHash);
        if (!match) {
          return done(null, false, { message: 'Email o password non validi' });
        }

        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  )
);

// Serialize/deserialize (only needed for session-based, but required by passport)
passport.serializeUser((user, done) => done(null, user.uid));
passport.deserializeUser(async (uid, done) => {
  try {
    const user = await User.findByPk(uid);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

module.exports = passport;
