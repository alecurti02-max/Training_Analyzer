function safeNum(n, decimals = 2) {
  if (n == null || Number.isNaN(n)) return null;
  const f = parseFloat(n);
  if (!Number.isFinite(f)) return null;
  return Math.round(f * 10 ** decimals) / 10 ** decimals;
}

function safeNumber(n, digits = 1) {
  if (n == null || !isFinite(Number(n))) return null;
  return +Number(n).toFixed(digits);
}

module.exports = { safeNum, safeNumber };
