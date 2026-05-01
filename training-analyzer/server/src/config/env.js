const path = require('path');
// Carica .env dalla root del progetto con override:true: in dev sovrascrive eventuali
// var d'ambiente shell che possano collidere (es. ANTHROPIC_API_KEY iniettata dall'IDE).
// In produzione il file non esiste, quindi non ha effetto e vincono le env del provider.
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env'), override: true });
require('dotenv').config();

const required = [
  'DATABASE_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
];

const optional = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_CALLBACK_URL',
  'CLIENT_ORIGIN',
];

const missingOptional = optional.filter((key) => !process.env[key]);
if (missingOptional.length > 0) {
  console.warn(`Warning: missing optional env vars: ${missingOptional.join(', ')} — Google OAuth disabled`);
}

const missing = required.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`Missing required env vars: ${missing.join(', ')}`);
  process.exit(1);
}

const config = Object.freeze({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL,
  clientOrigin: process.env.CLIENT_ORIGIN,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || null,
  aiAnalysisModel: process.env.AI_ANALYSIS_MODEL || 'claude-haiku-4-5-20251001',
  aiRequiresPremium: String(process.env.AI_REQUIRES_PREMIUM || 'false').toLowerCase() === 'true',
  aiRateLimitPerHour: parseInt(process.env.AI_RATE_LIMIT_PER_HOUR, 10) || 20,
});

module.exports = config;
