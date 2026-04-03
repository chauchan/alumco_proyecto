require('dotenv').config();
const mysql = require('mysql2/promise');

async function migrate() {
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST || 'localhost',
    port:     parseInt(process.env.DB_PORT) || 3306,
    user:     process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'alumco',
  });

  try {
    // Verificar si columna estamento existe en usuarios
    const [colUsuarios] = await conn.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'usuarios' AND COLUMN_NAME = 'estamento'
    `, [process.env.DB_NAME || 'alumco']);

    if (colUsuarios.length === 0) {
      await conn.query(`ALTER TABLE usuarios ADD COLUMN estamento VARCHAR(100) DEFAULT NULL`);
      console.log('✓ Columna estamento agregada a usuarios');
    } else {
      console.log('↷ Columna estamento ya existe en usuarios');
    }

    // Verificar si columna estamento existe en asignaciones
    const [colAsignaciones] = await conn.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'asignaciones' AND COLUMN_NAME = 'estamento'
    `, [process.env.DB_NAME || 'alumco']);

    if (colAsignaciones.length === 0) {
      await conn.query(`ALTER TABLE asignaciones ADD COLUMN estamento VARCHAR(100) DEFAULT NULL`);
      console.log('✓ Columna estamento agregada a asignaciones');
    } else {
      console.log('↷ Columna estamento ya existe en asignaciones');
    }

    console.log('\n✓ Migración de estamentos completada');
    await conn.end();
    process.exit(0);
  } catch (err) {
    console.error('✗ Error:', err.message);
    await conn.end();
    process.exit(1);
  }
}

migrate();
