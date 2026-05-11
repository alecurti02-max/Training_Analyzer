// Parses an uploaded workout file (JSON or CSV) into Workout records ready for bulkCreate.
// Returns { records, ext } on success; throws an Error with .status=400 on unsupported format.

function parseJsonFile(text, userId) {
  const parsed = JSON.parse(text);
  const items = Array.isArray(parsed) ? parsed : parsed.workouts || [parsed];
  return items.map((w) => ({
    userId,
    type: w.type || 'gym',
    date: w.date,
    score: w.scores?.overall ?? w.score ?? null,
    data: w,
  }));
}

function parseCsvFile(text, userId) {
  const lines = text.trim().split('\n').slice(1); // skip header
  const grouped = {};
  for (const line of lines) {
    const [date, exercise, sets, reps, weight, rpe] = line.split(',').map((s) => s.trim());
    if (!grouped[date]) grouped[date] = { exercises: [], rpe: 0 };
    grouped[date].exercises.push({
      name: exercise,
      sets: [{ reps: parseInt(reps, 10), weight: parseFloat(weight), rpe: parseInt(rpe, 10) || 6 }],
    });
    grouped[date].rpe = Math.max(grouped[date].rpe, parseInt(rpe, 10) || 6);
  }
  return Object.entries(grouped).map(([date, d]) => ({
    userId,
    type: 'gym',
    date,
    score: null,
    data: { exercises: d.exercises, rpe: d.rpe },
  }));
}

function parseWorkoutFile({ originalname, buffer }, userId) {
  const ext = originalname.split('.').pop().toLowerCase();
  const text = buffer.toString('utf-8');
  if (ext === 'json') return { records: parseJsonFile(text, userId), ext };
  if (ext === 'csv') return { records: parseCsvFile(text, userId), ext };
  const err = new Error(`Unsupported file format: .${ext}. Use JSON or CSV.`);
  err.status = 400;
  throw err;
}

module.exports = { parseWorkoutFile };
