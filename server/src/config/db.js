const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_DIR = path.join(__dirname, '../../data');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const DB_PATH = path.join(DB_DIR, 'alumco.db');
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) console.error('Error abriendo BD:', err.message);
  else console.log('✓ Conectado a SQLite (alumco.db)');
});

db.run('PRAGMA foreign_keys = ON');
db.run('PRAGMA journal_mode = WAL');

// Wrapper con promesas que simula la interfaz de pg { rows }
// Convierte $1,$2... (postgres) a ? (sqlite)
const pool = {
  query: (text, params = []) => {
    return new Promise((resolve, reject) => {
      const sql = text.replace(/\$\d+/g, '?');
      const upper = sql.trim().toUpperCase();
      const isSelect = upper.startsWith('SELECT') || upper.startsWith('WITH') || upper.startsWith('PRAGMA');

      if (isSelect) {
        db.all(sql, params, (err, rows) => {
          if (err) reject(err);
          else resolve({ rows: rows || [], rowCount: (rows || []).length });
        });
      } else {
        db.run(sql, params, function(err) {
          if (err) { reject(err); return; }
          // Si tiene RETURNING, recuperamos la fila recién insertada/actualizada
          if (/RETURNING/i.test(sql)) {
            const table = sql.match(/(?:INTO|UPDATE)\s+(\w+)/i)?.[1];
            if (table && this.lastID) {
              db.get(`SELECT * FROM ${table} WHERE id = ?`, [this.lastID], (err2, row) => {
                if (err2) reject(err2);
                else resolve({ rows: row ? [row] : [], rowCount: this.changes });
              });
            } else {
              resolve({ rows: [], rowCount: this.changes });
            }
          } else {
            resolve({ rows: [], rowCount: this.changes, lastID: this.lastID });
          }
        });
      }
    });
  },
  _db: db
};

module.exports = pool;
