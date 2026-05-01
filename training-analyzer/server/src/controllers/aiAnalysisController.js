const { analyzeWorkout, clearAnalysis } = require('../services/aiAnalyzer');

async function analyze(req, res, next) {
  try {
    const { force } = req.body || {};
    const result = await analyzeWorkout({
      userId: req.user.uid,
      workoutId: req.params.id,
      force: !!force,
    });
    res.json(result);
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({
        error: { message: err.message, code: err.code || 'ai_error', details: err.details || null },
      });
    }
    if (err.status === undefined && err.message && /Anthropic|API key|rate/i.test(err.message)) {
      return res.status(502).json({ error: { message: 'AI provider error', code: 'ai_provider_error' } });
    }
    next(err);
  }
}

async function clear(req, res, next) {
  try {
    const result = await clearAnalysis({
      userId: req.user.uid,
      workoutId: req.params.id,
    });
    res.json(result);
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: { message: err.message, code: err.code || 'ai_error' } });
    }
    next(err);
  }
}

module.exports = { analyze, clear };
