// Migración: agrega video_intro_url a cursos
require('dotenv').config();
const pool = require('./db');

async function migrate() {
  try {
    const r = await pool.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'cursos' AND COLUMN_NAME = 'video_intro_url'`,
      [process.env.DB_NAME || 'railway']
    );
    if (!r.rows.length) {
      await pool.query(`ALTER TABLE cursos ADD COLUMN video_intro_url VARCHAR(500) DEFAULT NULL`);
      console.log('✓ Columna video_intro_url agregada a cursos');
    } else {
      console.log('↷ video_intro_url ya existe');
    }
    console.log('\n✓ Migración completada');
    process.exit(0);
  } catch (err) {
    console.error('Error en migración:', err.message);
    process.exit(1);
  }
}

migrate();
