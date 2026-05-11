const { generateCoachSummary } = require('../services/ai/coachSummary');

async function coachSummary(req, res, next) {
  try {
    const summary = await generateCoachSummary({ userId: req.user.uid });
    res.json(summary);
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({
        error: { code: err.code || 'ai_error', message: err.message },
      });
    }
    next(err);
  }
}

module.exports = { coachSummary };
