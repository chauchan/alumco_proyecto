// Migración: agrega estamento_objetivo y obligatorio a cursos
require('dotenv').config();
const pool = require('./db');

async function migrate() {
  const conn = await pool.getConnection ? pool.getConnection() : null;
  try {
    // estamento_objetivo: NULL = todos, string = estamento específico
    const r1 = await pool.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'cursos' AND COLUMN_NAME = 'estamento_objetivo'`,
      [process.env.DB_NAME || 'railway']
    );
    if (!r1.rows.length) {
      await pool.query(`ALTER TABLE cursos ADD COLUMN estamento_objetivo VARCHAR(150) DEFAULT NULL`);
      console.log('✓ Columna estamento_objetivo agregada a cursos');
    } else {
      console.log('↷ estamento_objetivo ya existe');
    }

    const r2 = await pool.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'cursos' AND COLUMN_NAME = 'obligatorio'`,
      [process.env.DB_NAME || 'railway']
    );
    if (!r2.rows.length) {
      await pool.query(`ALTER TABLE cursos ADD COLUMN obligatorio TINYINT(1) DEFAULT 0`);
      console.log('✓ Columna obligatorio agregada a cursos');
    } else {
      console.log('↷ obligatorio ya existe');
    }

    console.log('\n✓ Migración completada');
    process.exit(0);
  } catch (err) {
    console.error('Error en migración:', err.message);
    process.exit(1);
  }
}

migrate();
