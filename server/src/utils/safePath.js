const path = require('path');

const UPLOADS_DIR = path.resolve(__dirname, '../../..', 'uploads');

function safeUploadPath(rel) {
  if (!rel || typeof rel !== 'string') return null;
  if (rel.includes('..') || /[\x00-\x1f]/.test(rel)) return null;
  if (!rel.startsWith('/uploads/')) return null;
  const abs = path.resolve(UPLOADS_DIR, rel.slice('/uploads/'.length));
  if (!abs.startsWith(UPLOADS_DIR + path.sep) && abs !== UPLOADS_DIR) return null;
  return abs;
}

module.exports = { safeUploadPath, UPLOADS_DIR };
