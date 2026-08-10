/**
 * Crea (o restablece) un usuario con rol `jefatura`, que es el de mayor
 * alcance en ALUMCO: ve la organización completa, todas las sedes y todos
 * los reportes.
 *
 * La contraseña NO se guarda en el repositorio: se pasa por argumento o por
 * la variable de entorno SUPERUSER_PASS. El script se niega a correr sin ella.
 *
 *   node src/config/crear-superusuario.js "MiClaveSegura123"
 *   node src/config/crear-superusuario.js "MiClaveSegura123" mi.usuario "Mi Nombre"
 *
 * Es idempotente: si el identificador ya existe, actualiza la contraseña y
 * reactiva la cuenta en vez de fallar. Sirve tanto para crear como para
 * recuperar el acceso.
 */
require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const password = process.argv[2] || process.env.SUPERUSER_PASS;
const identificador = process.argv[3] || 'superadmin';
const nombre = process.argv[4] || 'Super Administrador';

if (!password) {
  console.error('✗ Falta la contraseña.');
  console.error('  Uso: node src/config/crear-superusuario.js "<contraseña>" [identificador] [nombre]');
  process.exit(1);
}
if (password.length < 8) {
  console.error('✗ La contraseña debe tener al menos 8 caracteres.');
  process.exit(1);
}

(async () => {
  let conn;
  try {
    conn = await mysql.createConnection({
      host:     process.env.DB_HOST     || 'localhost',
      port:     parseInt(process.env.DB_PORT) || 3306,
      user:     process.env.DB_USER     || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME     || 'alumco',
    });
  } catch (err) {
    console.error('✗ No se pudo conectar a la base de datos:', err.message);
    console.error('  Revisa DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME en server/.env');
    process.exit(1);
  }

  try {
    // La tabla tiene que existir: si no, falta correr las migraciones.
    const [tablas] = await conn.query("SHOW TABLES LIKE 'usuarios'");
    if (tablas.length === 0) {
      console.error('✗ No existe la tabla `usuarios`. Corre primero: npm run db:migrate');
      process.exit(1);
    }

    const hash = bcrypt.hashSync(password, 10);
    const [existe] = await conn.query(
      'SELECT id FROM usuarios WHERE identificador = ?', [identificador]
    );

    if (existe.length) {
      await conn.query(
        'UPDATE usuarios SET password_hash = ?, rol = ?, activo = 1 WHERE identificador = ?',
        [hash, 'jefatura', identificador]
      );
      console.log(`✓ Usuario "${identificador}" ya existía: contraseña actualizada y cuenta reactivada.`);
    } else {
      await conn.query(
        `INSERT INTO usuarios (nombre, identificador, password_hash, rol, activo)
         VALUES (?, ?, ?, 'jefatura', 1)`,
        [nombre, identificador, hash]
      );
      console.log(`✓ Usuario "${identificador}" creado con rol jefatura.`);
    }

    const [total] = await conn.query('SELECT COUNT(*) AS n FROM usuarios');
    console.log(`\n  Ingresa en /login con:`);
    console.log(`    usuario:    ${identificador}`);
    console.log(`    contraseña: la que acabas de pasar por argumento`);
    console.log(`\n  Usuarios en la base: ${total[0].n}`);
    console.log('  Nota: jefatura no necesita sede. Para probar las vistas de');
    console.log('  colaborador, profesor o admin_sede hacen falta cursos, sedes y');
    console.log('  datos asociados — para eso está `npm run db:seed`.');
  } catch (err) {
    console.error('✗ Error:', err.message);
    process.exitCode = 1;
  } finally {
    await conn.end();
  }
})();
