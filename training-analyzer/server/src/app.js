const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const passport = require('./config/passport');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// --- Security ---
const isDev = (process.env.NODE_ENV || 'development') !== 'production';
app.use(
  helmet({
    strictTransportSecurity: isDev ? false : undefined,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // 'sha256-…' = hash dello <script> inline anti-FOUC in client/index.html,
        // che imposta data-theme + data-skin PRIMA del primo paint. Senza questo,
        // la CSP blocca l'inline e lo skin "carbon" non si attiva (resta Pista/v2).
        // AGGIORNARE questo hash se quel blocco <script> cambia anche di un byte.
        scriptSrc: [
          "'self'",
          'https://cdnjs.cloudflare.com',
          "'sha256-hxQEWGINfHZcWYsFSpM+nH8oRVvJkAb2DgPZ5QuA/fk='",
        ],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https://*.googleusercontent.com'],
        connectSrc: ["'self'", 'https://eutils.ncbi.nlm.nih.gov'],
        upgradeInsecureRequests: isDev ? null : [],
      },
    },
  })
);

const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:3000';
app.use(
  cors({
    origin: clientOrigin,
    credentials: true,
  })
);

// --- Body parsing ---
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// --- Logging ---
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// --- Rate limiting ---
app.use(
  '/api/',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 2000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { message: 'Too many requests, try again later' } },
  })
);

// --- Passport ---
app.use(passport.initialize());

// --- Static files (client) ---
// Prefer the Vite-built dist/ when present (production), otherwise serve the
// raw client/ folder (legacy dev workflow before Fase 1, or when Vite hasn't
// been built yet).
const fs = require('fs');
const clientRoot = path.join(__dirname, '../../client');
const clientDist = path.join(clientRoot, 'dist');
const clientDir = fs.existsSync(path.join(clientDist, 'index.html')) ? clientDist : clientRoot;
app.use(express.static(clientDir));

// --- API routes ---
app.use('/api/auth', require('./routes/auth'));
app.use('/api/workouts', require('./routes/workouts'));
app.use('/api/exercises', require('./routes/exercises'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/weights', require('./routes/weights'));
app.use('/api/body-measurements', require('./routes/bodyMeasurements'));
app.use('/api/users', require('./routes/users'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/nutrition', require('./routes/nutrition'));
app.use('/api/sleep', require('./routes/sleep'));
app.use('/api/planned-workouts', require('./routes/plannedWorkouts'));
app.use('/api/coach', require('./routes/coach'));
app.use('/api/me', require('./routes/me'));

// --- Health check ---
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- SPA fallback ---
app.get('*', (_req, res) => {
  res.sendFile('index.html', { root: clientDir });
});

// --- Error handler ---
app.use(errorHandler);

module.exports = app;
