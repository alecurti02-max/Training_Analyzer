// Summarises lap/split paces: count, average, std dev, CV%, first-third vs last-third
// for detecting negative/positive splits.
function summariseSplits(splits) {
  if (!Array.isArray(splits) || !splits.length) return null;
  const paces = splits.map((s) => s.pace).filter((v) => v > 0);
  if (paces.length < 2) return { count: splits.length };
  const avg = paces.reduce((a, b) => a + b, 0) / paces.length;
  const variance = paces.reduce((a, b) => a + (b - avg) ** 2, 0) / paces.length;
  const stdDev = Math.sqrt(variance);
  const cv = avg > 0 ? Math.round((stdDev / avg) * 1000) / 10 : 0;
  const firstThird = paces.slice(0, Math.ceil(paces.length / 3));
  const lastThird = paces.slice(-Math.ceil(paces.length / 3));
  const firstAvg = firstThird.reduce((a, b) => a + b, 0) / firstThird.length;
  const lastAvg = lastThird.reduce((a, b) => a + b, 0) / lastThird.length;
  return {
    count: splits.length,
    avgPaceSec: Math.round(avg),
    stdDevSec: Math.round(stdDev),
    cvPct: cv,
    firstThirdAvgSec: Math.round(firstAvg),
    lastThirdAvgSec: Math.round(lastAvg),
    pacingShift: lastAvg < firstAvg ? 'negative_split' : lastAvg > firstAvg ? 'positive_split' : 'even',
  };
}

module.exports = { summariseSplits };
