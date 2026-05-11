// Parses a JSON object out of LLM text output. Handles common cases:
// - clean JSON
// - JSON wrapped in ```json fences
// - JSON preceded by preamble (matches first { ... })
function tryParseJson(text) {
  if (!text) return null;
  let trimmed = String(text).trim();
  if (trimmed.startsWith('```')) {
    trimmed = trimmed.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  }
  try { return JSON.parse(trimmed); } catch (_) { /* fallthrough */ }
  const m = trimmed.match(/\{[\s\S]*\}/);
  if (m) {
    try { return JSON.parse(m[0]); } catch (_) { /* fallthrough */ }
  }
  return null;
}

module.exports = { tryParseJson };
