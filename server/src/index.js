require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const pool = require('./config/db');
const { makeBucketPublic } = require('./config/s3');

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
const correosRoutes        = require('./routes/correos');

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
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
app.use('/api/correos',     correosRoutes);

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

  // Crear tabla notificaciones si no existe (puede faltar si no se corrió migrate_practicos)
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notificaciones (
        id INT PRIMARY KEY AUTO_INCREMENT,
        usuario_id INT NOT NULL,
        practico_id INT DEFAULT NULL,
        titulo VARCHAR(200) NOT NULL,
        mensaje TEXT NOT NULL,
        leida TINYINT(1) DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
      )
    `);
    console.log('✓ Tabla notificaciones lista');
  } catch (err) {
    console.warn('⚠ notificaciones table:', err.message);
  }

  // Agregar practico_id a notificaciones si no existe (tablas creadas antes de esta columna)
  await addColumnIfMissing('notificaciones', 'practico_id', 'INT DEFAULT NULL');

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

  // Tabla de asistencia a prácticos
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS asistencia_practicos (
        id INT PRIMARY KEY AUTO_INCREMENT,
        practico_id INT NOT NULL,
        usuario_id INT NOT NULL,
        registrado_por INT DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_practico_usuario (practico_id, usuario_id),
        FOREIGN KEY (practico_id) REFERENCES practicos(id) ON DELETE CASCADE,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
      )
    `);
    console.log('✓ Tabla asistencia_practicos lista');
  } catch (err) {
    console.warn('⚠ asistencia_practicos table:', err.message);
  }

  // Columna requiere_practico en cursos
  await addColumnIfMissing('cursos', 'requiere_practico', 'TINYINT(1) DEFAULT 0');
  console.log('✓ Schema de práctico requerido listo');

  const server = app.listen(PORT, () => console.log(`Servidor ALUMCO corriendo en puerto ${PORT}`));

  // Timeout amplio para peticiones largas (generación IA con múltiples módulos)
  // 15 min = margen sobre el peor caso de generación secuencial
  server.setTimeout(900000);       // 15 min socket timeout
  server.keepAliveTimeout = 905000; // mayor que socket timeout
  server.headersTimeout = 910000;
}

start();
