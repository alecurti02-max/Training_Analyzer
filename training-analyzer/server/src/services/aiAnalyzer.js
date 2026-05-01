const config = require('../config/env');
const { getClient } = require('./anthropicClient');
const { buildAnalysisContext } = require('./contextBuilder');
const { SYSTEM_PROMPT, PROMPT_VERSION } = require('./prompts/workoutAnalyzerSystem');

const MAX_TOKENS = 1024;
const TEMPERATURE = 0.4;

function buildUserMessage(profile, current, history) {
  return [
    'Profilo atleta:',
    JSON.stringify(profile, null, 2),
    '',
    'Allenamento da analizzare:',
    JSON.stringify(current, null, 2),
    '',
    `Storico recenti (ultimi ${history.length} dello stesso tipo, dal più recente):`,
    JSON.stringify(history, null, 2),
    '',
    'Rispondi con il JSON di analisi richiesto.',
  ].join('\n');
}

function tryParseJson(text) {
  if (!text) return null;
  let trimmed = text.trim();
  if (trimmed.startsWith('```')) {
    trimmed = trimmed.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  }
  try {
    return JSON.parse(trimmed);
  } catch (e) {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (e2) {
        return null;
      }
    }
    return null;
  }
}

function validateAnalysis(parsed) {
  if (!parsed || typeof parsed !== 'object') return null;
  const out = {
    summary: typeof parsed.summary === 'string' ? parsed.summary.slice(0, 600) : '',
    type_classification: typeof parsed.type_classification === 'string' ? parsed.type_classification.slice(0, 80) : '',
    highlights: Array.isArray(parsed.highlights)
      ? parsed.highlights
        .filter((h) => h && typeof h.text === 'string')
        .slice(0, 8)
        .map((h) => ({
          kind: ['positive', 'neutral', 'concern'].includes(h.kind) ? h.kind : 'neutral',
          text: h.text.slice(0, 280),
        }))
      : [],
    suggestions: Array.isArray(parsed.suggestions)
      ? parsed.suggestions
        .filter((s) => s && typeof s.text === 'string')
        .slice(0, 6)
        .map((s) => ({
          priority: ['high', 'med', 'low'].includes(s.priority) ? s.priority : 'med',
          text: s.text.slice(0, 280),
        }))
      : [],
    comparison_to_history: parsed.comparison_to_history && typeof parsed.comparison_to_history === 'object'
      ? {
        trend: ['up', 'flat', 'down', 'n/a'].includes(parsed.comparison_to_history.trend)
          ? parsed.comparison_to_history.trend
          : 'n/a',
        notes: typeof parsed.comparison_to_history.notes === 'string'
          ? parsed.comparison_to_history.notes.slice(0, 400)
          : '',
      }
      : { trend: 'n/a', notes: '' },
    confidence: typeof parsed.confidence === 'number'
      ? Math.max(0, Math.min(1, parsed.confidence))
      : 0.5,
  };
  if (!out.summary || !out.highlights.length) return null;
  return out;
}

async function callClaude({ profile, current, history }) {
  const client = getClient();
  const userText = buildUserMessage(profile, current, history);

  const response = await client.messages.create({
    model: config.aiAnalysisModel,
    max_tokens: MAX_TOKENS,
    temperature: TEMPERATURE,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
      {
        type: 'text',
        text: `Profilo atleta cached:\n${JSON.stringify(profile)}`,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      { role: 'user', content: userText },
    ],
  });

  const textBlock = (response.content || []).find((c) => c.type === 'text');
  const text = textBlock?.text || '';
  const parsed = tryParseJson(text);
  const validated = validateAnalysis(parsed);

  return {
    analysis: validated,
    raw: validated ? null : text,
    usage: response.usage || null,
    model: response.model || config.aiAnalysisModel,
  };
}

async function analyzeWorkout({ userId, workoutId, force = false }) {
  const ctx = await buildAnalysisContext({ userId, workoutId });
  const { workout, profile, current, history } = ctx;

  if (
    !force
    && workout.aiAnalysis
    && workout.aiAnalysisVersion === PROMPT_VERSION
  ) {
    return {
      cached: true,
      aiAnalysis: workout.aiAnalysis,
      aiAnalysisGeneratedAt: workout.aiAnalysisGeneratedAt,
      aiAnalysisModel: workout.aiAnalysisModel,
      aiAnalysisVersion: workout.aiAnalysisVersion,
    };
  }

  const { analysis, raw, model } = await callClaude({ profile, current, history });

  if (!analysis) {
    const err = new Error('AI analysis returned invalid format');
    err.status = 502;
    err.code = 'ai_parse_failed';
    err.details = { raw: raw ? raw.slice(0, 500) : null };
    throw err;
  }

  const generatedAt = new Date();
  await workout.update({
    aiAnalysis: analysis,
    aiAnalysisGeneratedAt: generatedAt,
    aiAnalysisModel: model,
    aiAnalysisVersion: PROMPT_VERSION,
  });

  return {
    cached: false,
    aiAnalysis: analysis,
    aiAnalysisGeneratedAt: generatedAt,
    aiAnalysisModel: model,
    aiAnalysisVersion: PROMPT_VERSION,
  };
}

async function clearAnalysis({ userId, workoutId }) {
  const { Workout } = require('../models');
  const workout = await Workout.findOne({ where: { id: workoutId, userId } });
  if (!workout) {
    const err = new Error('Workout not found');
    err.status = 404;
    err.code = 'workout_not_found';
    throw err;
  }
  await workout.update({
    aiAnalysis: null,
    aiAnalysisGeneratedAt: null,
    aiAnalysisModel: null,
    aiAnalysisVersion: null,
  });
  return { cleared: true };
}

module.exports = { analyzeWorkout, clearAnalysis, PROMPT_VERSION };
