function parseIdParam(req, name) {
  const raw = req.params[name];
  const n = parseInt(raw, 10);
  if (!Number.isInteger(n) || n <= 0 || String(n) !== raw) return null;
  return n;
}

module.exports = { parseIdParam };
