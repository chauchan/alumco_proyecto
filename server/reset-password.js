require('dotenv').config();
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

async function resetPassword() {
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT) || 3306,
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || 'alumco',
  });

  try {
    const nuevaPassword = 'admin123';
    const hash = bcrypt.hashSync(nuevaPassword, 10);

    const [result] = await conn.query(
      'UPDATE usuarios SET password_hash = ? WHERE rol = ?',
      [hash, 'jefatura']
    );

    console.log('✓ Contraseña actualizada. Filas afectadas:', result.affectedRows);
    console.log('  Usuario:    admin');
    console.log('  Contraseña: admin123');

    // Verificar que funciona
    const [rows] = await conn.query('SELECT password_hash FROM usuarios WHERE rol = ?', ['jefatura']);
    const ok = bcrypt.compareSync(nuevaPassword, rows[0].password_hash);
    console.log('✓ Verificación del hash:', ok ? 'CORRECTA' : 'FALLIDA');

  } catch (err) {
    console.error('✗ Error:', err.message);
  } finally {
    await conn.end();
  }
}

resetPassword();
