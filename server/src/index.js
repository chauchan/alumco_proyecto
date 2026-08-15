require('dotenv').config();
require('dns').setDefaultResultOrder('ipv4first');

// --- Validaciones de startup (fail-fast antes de cualquier inicialización) ---
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET === 'reemplazar_con_clave_segura_larga' || JWT_SECRET.length < 16) {
  console.error(
    'ERROR: JWT_SECRET inválido.\n' +
    '  Debe tener al menos 16 caracteres y no puede ser el valor por defecto.\n' +
    '  Generá uno con: openssl rand -hex 32'
  );
  process.exit(1);
}
if (JWT_SECRET.length < 32) {
  console.warn(
    'WARNING: JWT_SECRET tiene menos de 32 caracteres. Se recomienda rotar a uno más largo.\n' +
    '  Generá uno con: openssl rand -hex 32'
  );
}
if (process.env.NODE_ENV === 'production' && !process.env.DB_PASSWORD) {
  console.error('ERROR: DB_PASSWORD está vacío en producción.');
  process.exit(1);
}

// --- Configuración de CORS ---
let corsOrigins;
if (process.env.NODE_ENV === 'production') {
  if (!process.env.CLIENT_URL) {
    console.error('ERROR: CLIENT_URL no está definido en producción.');
    process.exit(1);
  }
  corsOrigins = process.env.CLIENT_URL.split(',').map(o => o.trim());
} else {
  corsOrigins = (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map(o => o.trim());
}
const corsOptions = { origin: corsOrigins, credentials: true };

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const cron = require('node-cron');
const pool = require('./config/db');
const { makeBucketPublic } = require('./config/s3');
const { enviarRecordatorios } = require('./jobs/recordatoriosCertificados');

const authRoutes          = require('./routes/auth');
const usuariosRoutes      = require('./routes/usuarios');
const cursosRoutes        = require('./routes/cursos');
const evaluacionesRoutes  = require('./routes/evaluaciones');
const certificadosRoutes  = require('./routes/certificados');
const reportesRoutes      = require('./routes/reportes');
const iaRoutes            = require('./routes/ia');
const sedesRoutes         = require('./routes/sedes');
const practicosRoutes     = require('./routes/practicos');
const notificacionesRoutes = require('./routes/notificaciones');
const googleRoutes         = require('./routes/google');
const protocolosRoutes     = require('./routes/protocolos');
const modulosRoutes        = require('./routes/modulos');

const app = express();

// Confiar en el proxy de Railway/Heroku/etc para que req.ip sea la IP real del cliente
// (necesario para que express-rate-limit cuente por usuario, no globalmente)
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/auth',           authRoutes);
app.use('/api/usuarios',       usuariosRoutes);
app.use('/api/cursos',         cursosRoutes);
app.use('/api/evaluaciones',   evaluacionesRoutes);
app.use('/api/certificados',   certificadosRoutes);
app.use('/api/reportes',       reportesRoutes);
app.use('/api/ia',             iaRoutes);
app.use('/api/sedes',          sedesRoutes);
app.use('/api/practicos',      practicosRoutes);
app.use('/api/notificaciones', notificacionesRoutes);
app.use('/api/google',        googleRoutes);
app.use('/api/protocolos',   protocolosRoutes);
app.use('/api/modulos',      modulosRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Error interno del servidor' });
});

const PORT = process.env.PORT || 3001;

// Migrar columnas críticas ANTES de empezar a aceptar conexiones
// Usa information_schema para compatibilidad con MySQL 5.7 (sin IF NOT EXISTS en ALTER)
async function addColumnIfMissing(tabla, columna, definicion) {
  try {
    const r = await pool.query(
      `SELECT COUNT(*) as cnt FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = $1 AND column_name = $2`,
      [tabla, columna]
    );
    const existe = (r.rows[0]?.cnt || 0) > 0;
    if (!existe) {
      await pool.query(`ALTER TABLE ${tabla} ADD COLUMN ${columna} ${definicion}`);
      console.log(`✓ Columna ${tabla}.${columna} creada`);
    }
  } catch (err) {
    console.warn(`⚠ addColumnIfMissing ${tabla}.${columna}:`, err.message);
  }
}

async function start() {
  await makeBucketPublic();

  await addColumnIfMissing('progreso', 'intentos_fallidos', 'INT DEFAULT 0');
  await addColumnIfMissing('progreso', 'bloqueado_hasta', 'DATETIME DEFAULT NULL');
  console.log('✓ Schema de bloqueo listo');

  // Columnas de targeting en cursos
  await addColumnIfMissing('cursos', 'sede_objetivo', 'INT DEFAULT NULL');
  await addColumnIfMissing('cursos', 'estamento_objetivo', 'TEXT DEFAULT NULL');
  await addColumnIfMissing('cursos', 'obligatorio', 'TINYINT(1) DEFAULT 0');
  await addColumnIfMissing('cursos', 'video_intro_url', 'VARCHAR(500) DEFAULT NULL');
  console.log('✓ Schema de targeting listo');

  // Garantizar UNIQUE KEY en progreso(usuario_id, curso_id) — requisito para ON DUPLICATE KEY UPDATE
  try {
    const idxCheck = await pool.query(
      `SELECT COUNT(*) as cnt FROM information_schema.statistics
       WHERE table_schema = DATABASE() AND table_name = 'progreso' AND index_name = 'uniq_usuario_curso'`
    );
    const yaExiste = Number(idxCheck.rows[0]?.cnt ?? 0) > 0;
    if (!yaExiste) {
      // Eliminar filas duplicadas (conservar la de id más alto por par usuario/curso)
      await pool.query(`
        DELETE p1 FROM progreso p1
        INNER JOIN progreso p2
          ON p1.usuario_id = p2.usuario_id AND p1.curso_id = p2.curso_id
        WHERE p1.id < p2.id
      `);
      await pool.query(`ALTER TABLE progreso ADD UNIQUE KEY uniq_usuario_curso (usuario_id, curso_id)`);
      console.log('✓ UNIQUE KEY uniq_usuario_curso creado en progreso');
    }
  } catch (err) {
    console.warn('⚠ UNIQUE KEY progreso:', err.message);
  }

  // Agregar columna ultimo_acceso a usuarios si no existe
  try {
    await pool.query(`ALTER TABLE usuarios ADD COLUMN ultimo_acceso DATETIME DEFAULT NULL`);
    console.log('✓ Columna ultimo_acceso agregada a usuarios');
  } catch (err) {
    if (!err.message?.includes('Duplicate column')) {
      console.warn('⚠ ultimo_acceso column:', err.message);
    }
  }

  try {
    await pool.query(`ALTER TABLE cursos ADD COLUMN imagenes_protocolo JSON DEFAULT NULL`);
    console.log('✓ Columna imagenes_protocolo agregada a cursos');
  } catch (err) {
    if (!err.message?.includes('Duplicate column')) {
      console.warn('⚠ imagenes_protocolo column:', err.message);
    }
  }

  // Recordatorios diarios a las 09:00 para todos los colaboradores con cursos pendientes
  cron.schedule('0 9 * * *', () => {
    enviarRecordatorios(null, null)
      .then(r => console.log(`[cron] Recordatorios enviados: ${r.enviados}/${r.total} (${r.errores} errores)`))
      .catch(e => console.error('[cron] Error recordatorios:', e.message));
  });

  const server = app.listen(PORT, () => console.log(`Servidor ALUMCO corriendo en puerto ${PORT}`));

  // Sin esto, dejar un servidor anterior corriendo termina en un volcado de
  // pila de 'Unhandled error event' que no dice qué hacer. Es el caso más
  // común al reiniciar en desarrollo, así que merece un mensaje propio.
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n✗ El puerto ${PORT} ya está en uso: hay otro servidor corriendo.`);
      console.error(`  Windows:  netstat -ano | findstr :${PORT}   →   taskkill /PID <pid> /F`);
      console.error(`  Linux/Mac: lsof -ti:${PORT} | xargs kill -9\n`);
      process.exit(1);
    }
    throw err;
  });

  // Timeout amplio para peticiones largas (generación IA con múltiples módulos)
  // 15 min = margen sobre el peor caso de generación secuencial
  server.setTimeout(900000);       // 15 min socket timeout
  server.keepAliveTimeout = 905000; // mayor que socket timeout
  server.headersTimeout = 910000;
}

start();
