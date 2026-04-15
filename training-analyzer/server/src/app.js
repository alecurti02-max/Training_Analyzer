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
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://cdnjs.cloudflare.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https://*.googleusercontent.com'],
        connectSrc: ["'self'", 'https://eutils.ncbi.nlm.nih.gov'],
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
const clientDir = path.join(__dirname, '../../client');
app.use(express.static(clientDir));

// --- API routes ---
app.use('/api/auth', require('./routes/auth'));
app.use('/api/workouts', require('./routes/workouts'));
app.use('/api/exercises', require('./routes/exercises'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/weights', require('./routes/weights'));
app.use('/api/users', require('./routes/users'));

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
