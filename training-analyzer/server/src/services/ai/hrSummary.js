const HR_SERIES_BUCKETS = 12;

function downsampleSeries(series, buckets = HR_SERIES_BUCKETS) {
  if (!Array.isArray(series) || series.length <= buckets) return series || [];
  const step = series.length / buckets;
  const out = [];
  for (let i = 0; i < buckets; i++) {
    const start = Math.floor(i * step);
    const end = Math.floor((i + 1) * step);
    const slice = series.slice(start, end);
    if (!slice.length) continue;
    const hrAvg = slice.reduce((s, p) => s + (p.hr || 0), 0) / slice.length;
    out.push({ t: slice[Math.floor(slice.length / 2)].t, hr: Math.round(hrAvg) });
  }
  return out;
}

// Returns null when there's not enough data to compute drift (need at least 4 valid samples).
function summariseHrSeries(series) {
  if (!Array.isArray(series) || series.length < 4) return null;
  const hrs = series.map((p) => p.hr || 0).filter((v) => v > 0);
  if (hrs.length < 4) return null;
  const half = Math.floor(hrs.length / 2);
  const avg1 = hrs.slice(0, half).reduce((a, b) => a + b, 0) / half;
  const avg2 = hrs.slice(half).reduce((a, b) => a + b, 0) / (hrs.length - half);
  const driftPct = avg1 > 0 ? Math.round(((avg2 - avg1) / avg1) * 1000) / 10 : 0;
  return {
    samples: hrs.length,
    firstHalfAvg: Math.round(avg1),
    secondHalfAvg: Math.round(avg2),
    driftPct,
  };
}

module.exports = { downsampleSeries, summariseHrSeries, HR_SERIES_BUCKETS };
