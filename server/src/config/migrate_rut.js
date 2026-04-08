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
    const db = process.env.DB_NAME || 'alumco';

    const [colRut] = await conn.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'usuarios' AND COLUMN_NAME = 'rut'`,
      [db]
    );
    if (colRut.length === 0) {
      await conn.query(`ALTER TABLE usuarios ADD COLUMN rut VARCHAR(20) DEFAULT NULL`);
      console.log('✓ Columna rut agregada');
    } else {
      console.log('↷ Columna rut ya existe');
    }

    const [colEmail] = await conn.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'usuarios' AND COLUMN_NAME = 'email'`,
      [db]
    );
    if (colEmail.length === 0) {
      await conn.query(`ALTER TABLE usuarios ADD COLUMN email VARCHAR(150) DEFAULT NULL`);
      console.log('✓ Columna email agregada');
    } else {
      console.log('↷ Columna email ya existe');
    }

    console.log('✓ Migración rut completada');
    await conn.end();
    process.exit(0);
  } catch (err) {
    console.error('✗ Error:', err.message);
    await conn.end();
    process.exit(1);
  }
}

migrate();
