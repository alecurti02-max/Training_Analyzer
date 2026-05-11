const config = require('../../config/env');
const { getClient } = require('./anthropicClient');
const { tryParseJson } = require('./jsonExtract');
const { safeNumber } = require('../../utils/safeNum');
const { User, Settings, Workout, BodyMeasurement } = require('../../models');
const { SYSTEM_PROMPT } = require('../prompts/profileCoachSystem');

function buildSnapshot({ user, settings, measurements, workouts }) {
  const last30days = (() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  })();
  const last90days = (() => {
    const d = new Date(); d.setDate(d.getDate() - 90);
    return d.toISOString().slice(0, 10);
  })();

  const recent = workouts.filter((w) => w.date >= last30days);
  const recent90 = workouts.filter((w) => w.date >= last90days);
  const lastM = measurements[measurements.length - 1] || null;
  const firstM = measurements[0] || null;

  const byType = {};
  recent.forEach((w) => { byType[w.type] = (byType[w.type] || 0) + 1; });

  const totalKm30 = recent
    .filter((w) => w.type === 'running')
    .reduce((s, w) => s + (w.data?.distance || 0), 0);

  const tonnage30 = recent
    .filter((w) => w.type === 'gym')
    .reduce((s, w) => {
      const exs = w.data?.exercises || [];
      let t = 0;
      exs.forEach((ex) => {
        const bw = ex.barbellWeight || 0;
        (ex.sets || []).forEach((set) => {
          const reps = set.reps || 0;
          const weight = (set.weight || 0) + (set.bodyweight ? (settings?.bodyweight || 0) : 0);
          let eff = ex.weightMode === 'per_side' ? weight * 2 : weight;
          eff += bw;
          t += reps * eff;
        });
      });
      return s + t;
    }, 0);

  const avgScore30 = recent.length
    ? +(recent.reduce((s, w) => s + (Number(w.score) || 0), 0) / recent.length).toFixed(1)
    : null;

  return {
    profilo: {
      eta: settings?.age || null,
      sesso: settings?.gender || null,
      altezzaCm: settings?.height || null,
      pesoKg: settings?.bodyweight || null,
      pesoTargetKg: settings?.weightTarget || null,
      vo2max: settings?.vo2max || null,
      fcMax: settings?.maxhr || null,
      fcRiposo: settings?.resthr || null,
      flessibilita10: settings?.flexibility || null,
      sportAttivi: Array.isArray(settings?.activeSports) ? settings.activeSports : null,
      obiettivoSettimanale: settings?.weekgoal || null,
      obiettivoKm: settings?.kmgoal || null,
    },
    composizione: {
      attuale: lastM ? {
        bodyFatPct: lastM.bodyFat,
        muscoloScheletricoPct: lastM.skeletalMuscle,
        massaMuscolareKg: lastM.muscleMass,
        massaOsseaKg: lastM.boneMass,
        acquaPct: lastM.bodyWater,
        proteinePct: lastM.protein,
        grassoSottocutaneoPct: lastM.subcutaneousFat,
        grassoViscerale: lastM.visceralFat,
        circVita: lastM.circWaist,
        circFianchi: lastM.circHips,
        circPetto: lastM.circChest,
      } : null,
      delta: lastM && firstM && lastM !== firstM ? {
        bodyFatPct: safeNumber((lastM.bodyFat || 0) - (firstM.bodyFat || 0)),
        massaMuscolareKg: safeNumber((lastM.muscleMass || 0) - (firstM.muscleMass || 0)),
        circVita: safeNumber((lastM.circWaist || 0) - (firstM.circWaist || 0)),
        giorniIntervallo: Math.round((new Date(lastM.date) - new Date(firstM.date)) / 86400000),
      } : null,
    },
    attivita: {
      ultimi30gg: {
        totaleAllenamenti: recent.length,
        perTipo: byType,
        kmRunning: safeNumber(totalKm30, 1),
        tonnellaggioGymKg: Math.round(tonnage30),
        scoreMedio: avgScore30,
      },
      ultimi90gg: {
        totaleAllenamenti: recent90.length,
      },
    },
  };
}

function validateSummary(parsed) {
  if (!parsed || typeof parsed !== 'object') return null;
  const trimList = (arr) => Array.isArray(arr)
    ? arr.filter((s) => typeof s === 'string' && s.trim())
      .slice(0, 5)
      .map((s) => s.trim().slice(0, 280))
    : [];
  const out = {
    summary: typeof parsed.summary === 'string' ? parsed.summary.trim().slice(0, 1500) : '',
    strengths: trimList(parsed.strengths),
    improvements: trimList(parsed.improvements),
    recommendations: trimList(parsed.recommendations),
  };
  if (!out.summary && !out.strengths.length && !out.improvements.length) return null;
  return out;
}

async function generateCoachSummary({ userId }) {
  const [user, settings, workouts, measurements] = await Promise.all([
    User.findByPk(userId, { attributes: ['uid', 'displayName', 'firstName', 'lastName', 'email'] }),
    Settings.findOne({ where: { userId } }),
    Workout.findAll({
      where: { userId },
      order: [['date', 'DESC']],
      limit: 50,
    }),
    BodyMeasurement.findAll({
      where: { userId },
      order: [['date', 'ASC']],
      limit: 30,
    }),
  ]);

  const snapshot = buildSnapshot({
    user: user || {},
    settings: settings || {},
    measurements: measurements || [],
    workouts: workouts || [],
  });

  const client = getClient();
  const userText = [
    'Panoramica fisica dell\'atleta:',
    JSON.stringify(snapshot, null, 2),
    '',
    'Restituisci il JSON di sintesi richiesto.',
  ].join('\n');

  const response = await client.messages.create({
    model: config.aiAnalysisModel,
    max_tokens: 1024,
    temperature: 0.4,
    system: [{ type: 'text', text: SYSTEM_PROMPT }],
    messages: [
      { role: 'user', content: userText },
      { role: 'assistant', content: '{' },
    ],
  });

  const textBlock = (response.content || []).find((c) => c.type === 'text');
  const rawText = '{' + (textBlock?.text || '');
  const parsed = tryParseJson(rawText);
  const validated = validateSummary(parsed);

  if (!validated) {
    console.error('[coach-summary] parse_failed', { preview: (textBlock?.text || '').slice(0, 400) });
    const err = new Error('AI summary returned invalid format');
    err.status = 502;
    err.code = 'ai_parse_failed';
    throw err;
  }

  return validated;
}

module.exports = { generateCoachSummary, buildSnapshot };
