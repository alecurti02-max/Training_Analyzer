const Anthropic = require('@anthropic-ai/sdk');
const config = require('../../config/env');

let client = null;

function getClient() {
  if (!config.anthropicApiKey) {
    const err = new Error('ANTHROPIC_API_KEY not configured');
    err.code = 'ai_not_configured';
    err.status = 503;
    throw err;
  }
  if (!client) {
    client = new Anthropic.default({ apiKey: config.anthropicApiKey });
  }
  return client;
}

module.exports = { getClient };
