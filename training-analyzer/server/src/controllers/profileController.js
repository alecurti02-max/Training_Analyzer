const { Op } = require('sequelize');
const config = require('../config/env');
const { getClient } = require('../services/anthropicClient');
const { User, Settings, Workout, BodyMeasurement } = require('../models');

const COACH_SYSTEM_PROMPT = `Sei un personal trainer esperto. Analizzi una panoramica fisica completa di un atleta e produci un riepilogo professionale in italiano destinato a un altro coach o all'atleta stesso.

OUTPUT: rispondi SOLO con un oggetto JSON valido (no markdown, no testo prima/dopo). Schema esatto:

{
  "summary": "string — max 200 parole, riepilogo dello stato fisico-atletico complessivo, con 2-3 numeri concreti tratti dai dati",
  "strengths": ["string", "string", "string"],
  "improvements": ["string", "string", "string"],
  "recommendations": ["string", "string"]
}

REGOLE:
- summary: 200 parole massime, italiano fluente, tono professionale ma non clinico, basato esclusivamente sui dati forniti.
- strengths: esattamente 3 punti di forza concreti, ognuno 1 frase massimo. Cita numeri se rilevanti.
- improvements: esattamente 3 aree concrete da migliorare, ognuna 1 frase. Niente generici tipo "allenati di più".
- recommendations: esattamente 2 azioni specifiche e concrete che il coach può implementare nel prossimo blocco di allenamento.
- Non inventare metriche assenti. Se un dato manca, ignoralo invece di stimarlo.
- Niente disclaimer medici, niente "consulta un professionista".

Rispondi SOLO con il JSON.`;

function safeNumber(n, digits = 1) {
  if (n == null || !isFinite(Number(n))) return null;
  return +Number(n).toFixed(digits);
}

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

  // Aggregati ultimi 30gg
  const byType = {};
  recent.forEach((w) => {
    byType[w.type] = (byType[w.type] || 0) + 1;
  });
  const totalKm30 = recent.filter((w) => w.type === 'running').reduce((s, w) => s + (w.data?.distance || 0), 0);
  const tonnage30 = recent.filter((w) => w.type === 'gym').reduce((s, w) => {
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

function tryParseJson(text) {
  if (!text) return null;
  let trimmed = String(text).trim();
  if (trimmed.startsWith('```')) {
    trimmed = trimmed.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  }
  try { return JSON.parse(trimmed); } catch (e) { /* fallthrough */ }
  const m = trimmed.match(/\{[\s\S]*\}/);
  if (m) {
    try { return JSON.parse(m[0]); } catch (e2) { /* fallthrough */ }
  }
  return null;
}

function validate(parsed) {
  if (!parsed || typeof parsed !== 'object') return null;
  const out = {
    summary: typeof parsed.summary === 'string' ? parsed.summary.trim().slice(0, 1500) : '',
    strengths: Array.isArray(parsed.strengths)
      ? parsed.strengths.filter((s) => typeof s === 'string' && s.trim()).slice(0, 5).map((s) => s.trim().slice(0, 280))
      : [],
    improvements: Array.isArray(parsed.improvements)
      ? parsed.improvements.filter((s) => typeof s === 'string' && s.trim()).slice(0, 5).map((s) => s.trim().slice(0, 280))
      : [],
    recommendations: Array.isArray(parsed.recommendations)
      ? parsed.recommendations.filter((s) => typeof s === 'string' && s.trim()).slice(0, 5).map((s) => s.trim().slice(0, 280))
      : [],
  };
  if (!out.summary && !out.strengths.length && !out.improvements.length) return null;
  return out;
}

async function coachSummary(req, res, next) {
  try {
    const userId = req.user.uid;
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
      system: [{ type: 'text', text: COACH_SYSTEM_PROMPT }],
      messages: [
        { role: 'user', content: userText },
        { role: 'assistant', content: '{' },
      ],
    });

    const textBlock = (response.content || []).find((c) => c.type === 'text');
    const rawText = '{' + (textBlock?.text || '');
    const parsed = tryParseJson(rawText);
    const validated = validate(parsed);

    if (!validated) {
      console.error('[coach-summary] parse_failed', { preview: (textBlock?.text || '').slice(0, 400) });
      return res.status(502).json({ error: { code: 'ai_parse_failed', message: 'AI summary returned invalid format' } });
    }

    res.json(validated);
  } catch (err) {
    next(err);
  }
}

module.exports = { coachSummary };
