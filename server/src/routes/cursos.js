const express = require('express');
const router = express.Router();
const multer = require('multer');
const multerS3 = require('multer-s3');
const path = require('path');
const fs = require('fs');
const pool = require('../config/db');
const { verificarToken, verificarRol } = require('../middleware/auth');
const { s3, BUCKET, fileLocation, generateSignedUrl, keyFromUrl } = require('../config/s3');

// Configuración de subida de archivos → Railway Object Storage (S3)
const storage = multerS3({
  s3,
  bucket: BUCKET,
  acl: 'public-read',
  contentType: multerS3.AUTO_CONTENT_TYPE,
  key: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `modulos/modulo_${Date.now()}${ext}`);
  }
});
const fileFilter = (req, file, cb) => {
  const tiposValidos = ['application/pdf', 'video/mp4', 'video/webm', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'];
  if (tiposValidos.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Formato no válido. Solo PDF, video o PPT'), false);
};
const upload = multer({ storage, fileFilter, limits: { fileSize: 100 * 1024 * 1024 } }); // 100MB

const videoFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('video/')) cb(null, true);
  else cb(new Error('Solo se aceptan archivos de video'), false);
};
const uploadVideo = multer({ storage, fileFilter: videoFilter, limits: { fileSize: 500 * 1024 * 1024 } }); // 500MB

// GET /api/cursos — listar cursos
router.get('/', verificarToken, async (req, res) => {
  const { rol, id, estamento } = req.usuario;
  try {
    let query, params = [];
    if (rol === 'colaborador') {
      // Leer estamento y sede_id desde la BD (no del JWT, que puede estar desactualizado)
      query = `SELECT c.*, u.nombre as profesor_nombre, c.obligatorio as obligatorio, a.fecha_limite,
               COALESCE(p.porcentaje, 0) as progreso, COALESCE(p.completado, false) as completado
               FROM cursos c
               LEFT JOIN asignaciones a ON a.curso_id = c.id AND a.usuario_id = $1
               LEFT JOIN usuarios u ON c.profesor_id = u.id
               LEFT JOIN progreso p ON p.curso_id = c.id AND p.usuario_id = $2
               JOIN usuarios me ON me.id = $3
               WHERE c.publicado = 1
               AND (c.estamento_objetivo IS NULL OR JSON_CONTAINS(c.estamento_objetivo, JSON_QUOTE(COALESCE(me.estamento, ''))))
               AND (c.sede_objetivo IS NULL OR c.sede_objetivo = COALESCE(me.sede_id, 0))
               ORDER BY c.obligatorio DESC, c.nombre`;
      params = [id, id, id];
    } else if (rol === 'profesor') {
      query = `SELECT c.*, COUNT(DISTINCT a.usuario_id) as inscritos
               FROM cursos c LEFT JOIN asignaciones a ON a.curso_id = c.id
               WHERE c.profesor_id = $1 GROUP BY c.id ORDER BY c.created_at DESC`;
      params = [id];
    } else {
      query = `SELECT c.*, u.nombre as profesor_nombre, COUNT(DISTINCT a.usuario_id) as inscritos
               FROM cursos c LEFT JOIN usuarios u ON c.profesor_id = u.id
               LEFT JOIN asignaciones a ON a.curso_id = c.id
               GROUP BY c.id, u.nombre ORDER BY c.nombre`;
    }
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener cursos' });
  }
});

// GET /api/cursos/mis-capacitaciones — cursos publicados con progreso personal (cualquier rol)
router.get('/mis-capacitaciones', verificarToken, async (req, res) => {
  const { id } = req.usuario;
  try {
    const result = await pool.query(
      `SELECT c.*, u.nombre as profesor_nombre,
              COALESCE(p.porcentaje, 0) as progreso,
              COALESCE(p.completado, 0) as completado,
              COALESCE(p.intentos_fallidos, 0) as intentos_fallidos,
              p.bloqueado_hasta
       FROM cursos c
       LEFT JOIN usuarios u ON c.profesor_id = u.id
       LEFT JOIN progreso p ON p.curso_id = c.id AND p.usuario_id = $1
       JOIN usuarios me ON me.id = $2
       WHERE c.publicado = 1 AND c.obligatorio = 1
       AND (c.estamento_objetivo IS NULL OR JSON_CONTAINS(c.estamento_objetivo, JSON_QUOTE(COALESCE(me.estamento, ''))))
       AND (c.sede_objetivo IS NULL OR c.sede_objetivo = COALESCE(me.sede_id, 0))
       ORDER BY c.nombre`,
      [id, id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener capacitaciones' });
  }
});

// GET /api/cursos/pendientes-ia — cursos generados por IA pendientes de validación
router.get('/pendientes-ia', verificarToken, verificarRol('profesor', 'admin_sede', 'jefatura'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.*,
         (SELECT COUNT(*) FROM modulos m WHERE m.curso_id = c.id) as modulos_count,
         (SELECT COUNT(*) FROM preguntas p WHERE p.curso_id = c.id) as preguntas_count
       FROM cursos c
       WHERE c.generado_por_ia = 1 AND c.publicado = 0
       ORDER BY c.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener borradores' });
  }
});

// GET /api/cursos/:id — detalle de curso con módulos
router.get('/:id', verificarToken, async (req, res) => {
  try {
    const curso = await pool.query('SELECT c.*, u.nombre as profesor_nombre FROM cursos c LEFT JOIN usuarios u ON c.profesor_id = u.id WHERE c.id = $1', [req.params.id]);
    if (curso.rows.length === 0) return res.status(404).json({ error: 'Curso no encontrado' });
    const modulos = await pool.query('SELECT * FROM modulos WHERE curso_id = $1 ORDER BY orden', [req.params.id]);
    const preguntas = await pool.query('SELECT * FROM preguntas WHERE curso_id = $1', [req.params.id]);
    // Imágenes del protocolo: leer desde S3 (URLs firmadas) o BD
    let imagenes_protocolo = [];
    const imagenesDB = curso.rows[0].imagenes_protocolo;
    if (Array.isArray(imagenesDB) && imagenesDB.length > 0) {
      imagenes_protocolo = await Promise.all(
        imagenesDB.map(url => {
          const key = keyFromUrl(url);
          return key ? generateSignedUrl(key, 3600) : url;
        })
      );
    }
    res.json({ ...curso.rows[0], modulos: modulos.rows, preguntas: preguntas.rows, imagenes_protocolo });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener curso' });
  }
});

// POST /api/cursos — crear curso
router.post('/', verificarToken, verificarRol('profesor', 'admin_sede', 'jefatura'), async (req, res) => {
  const { nombre, descripcion, area } = req.body;
  if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' });
  try {
    const ins = await pool.query(
      'INSERT INTO cursos (nombre, descripcion, area, profesor_id) VALUES ($1,$2,$3,$4)',
      [nombre, descripcion, area, req.usuario.id]
    );
    const nuevo = await pool.query('SELECT * FROM cursos WHERE id = $1', [ins.lastID]);
    res.status(201).json(nuevo.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al crear curso' });
  }
});

// PATCH /api/cursos/:id/publicar — publicar/despublicar
router.patch('/:id/publicar', verificarToken, verificarRol('profesor', 'admin_sede', 'jefatura'), async (req, res) => {
  const { publicado } = req.body;
  try {
    await pool.query('UPDATE cursos SET publicado = $1, updated_at = NOW() WHERE id = $2', [publicado, req.params.id]);
    res.json({ id: req.params.id, publicado });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar estado del curso' });
  }
});

// POST /api/cursos/:id/modulos — subir módulo
router.post('/:id/modulos', verificarToken, verificarRol('profesor', 'admin_sede', 'jefatura'), upload.single('archivo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Archivo requerido' });
  const { titulo, descripcion, orden } = req.body;
  const tipo = req.file.mimetype.startsWith('video') ? 'video'
    : req.file.mimetype === 'application/pdf' ? 'pdf' : 'ppt';
  try {
    const ins = await pool.query(
      'INSERT INTO modulos (curso_id, titulo, descripcion, tipo, archivo_url, orden) VALUES ($1,$2,$3,$4,$5,$6)',
      [req.params.id, titulo, descripcion, tipo, fileLocation(req.file), orden || 1]
    );
    const nuevo = await pool.query('SELECT * FROM modulos WHERE id = $1', [ins.lastID]);
    res.status(201).json(nuevo.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al subir módulo' });
  }
});

// POST /api/cursos/:id/asignar — asignar curso a usuario(s)
router.post('/:id/asignar', verificarToken, verificarRol('profesor', 'admin_sede', 'jefatura'), async (req, res) => {
  const { usuario_ids, obligatorio, fecha_limite } = req.body;
  if (!usuario_ids?.length) return res.status(400).json({ error: 'usuario_ids requerido' });
  try {
    const inserts = usuario_ids.map((uid) =>
      pool.query(
        'INSERT IGNORE INTO asignaciones (usuario_id, curso_id, obligatorio, fecha_limite) VALUES ($1,$2,$3,$4)',
        [uid, req.params.id, obligatorio || false, fecha_limite || null]
      )
    );
    await Promise.all(inserts);
    res.json({ message: `Curso asignado a ${usuario_ids.length} usuario(s)` });
  } catch (err) {
    res.status(500).json({ error: 'Error al asignar curso' });
  }
});

// GET /api/cursos/:id/mi-progreso — estado de progreso del colaborador (incluye bloqueo)
router.get('/:id/mi-progreso', verificarToken, async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT porcentaje, completado, intentos_fallidos, bloqueado_hasta FROM progreso WHERE usuario_id = $1 AND curso_id = $2',
      [req.usuario.id, req.params.id]
    );
    res.json(r.rows[0] || { porcentaje: 0, completado: false, intentos_fallidos: 0, bloqueado_hasta: null });
  } catch {
    // Si las columnas de bloqueo no existen aún, rescatar al menos porcentaje/completado
    try {
      const r2 = await pool.query(
        'SELECT porcentaje, completado FROM progreso WHERE usuario_id = $1 AND curso_id = $2',
        [req.usuario.id, req.params.id]
      );
      res.json({ ...(r2.rows[0] || {}), intentos_fallidos: 0, bloqueado_hasta: null });
    } catch {
      res.json({ porcentaje: 0, completado: false, intentos_fallidos: 0, bloqueado_hasta: null });
    }
  }
});

// PATCH /api/cursos/:id/progreso — actualizar progreso del usuario
router.patch('/:id/progreso', verificarToken, async (req, res) => {
  const { porcentaje, es_evaluacion } = req.body;
  const aprobado = porcentaje >= 60;
  const completado = porcentaje >= 100;

  // Si no es evaluación (ej: progreso de módulos), hacer upsert simple sin contar fallos
  if (!es_evaluacion) {
    const comp = completado ? 1 : 0;
    try {
      // $5,$6 repiten $3,$4 para evitar VALUES() deprecated en MySQL 8.0.20+
      const r = await pool.query(
        `INSERT INTO progreso (usuario_id, curso_id, porcentaje, completado, ultimo_acceso)
         VALUES ($1,$2,$3,$4,NOW())
         ON DUPLICATE KEY UPDATE porcentaje = GREATEST(porcentaje, $5), completado = $6, ultimo_acceso = NOW()`,
        [req.usuario.id, req.params.id, porcentaje, comp, porcentaje, comp]
      );
      const affected = r.rows[0]?.affectedRows ?? r.rows[0]?.changedRows ?? '?';
      console.log(`[progreso] upsert uid=${req.usuario.id} curso=${req.params.id} pct=${porcentaje} affected=${affected}`);
    } catch (e) { console.error('[progreso] upsert módulos falló:', e.message); }
    return res.json({ porcentaje, completado });
  }

  const DIAS_BLOQUEO = 7;
  const comp = completado ? 1 : 0;

  // Intentar leer el estado de bloqueo (columnas pueden no existir en BDs antiguas)
  let prevFallidos = 0;
  let bloqueadoActivo = false;
  let bloqueadoHastaActual = null;
  try {
    const actual = await pool.query(
      'SELECT intentos_fallidos, bloqueado_hasta FROM progreso WHERE usuario_id = $1 AND curso_id = $2',
      [req.usuario.id, req.params.id]
    );
    const row = actual.rows[0];
    if (row) {
      prevFallidos = parseInt(row.intentos_fallidos || 0, 10);
      bloqueadoHastaActual = row.bloqueado_hasta || null;
      bloqueadoActivo = !!bloqueadoHastaActual && new Date(bloqueadoHastaActual) > new Date();
    }
  } catch {
    // Columnas de bloqueo no existen aún — continuar sin bloqueo
  }

  // Si el usuario ya está bloqueado, rechazar sin contar un nuevo intento
  if (bloqueadoActivo) {
    return res.status(403).json({ error: 'Curso bloqueado', bloqueado_hasta: bloqueadoHastaActual });
  }

  const intentos_fallidos = aprobado ? 0 : prevFallidos + 1;
  const bloqueado_hasta = aprobado ? null
    : intentos_fallidos >= 2 ? new Date(Date.now() + DIAS_BLOQUEO * 24 * 60 * 60 * 1000)
    : bloqueadoHastaActual;

  console.log(`[bloqueo] uid=${req.usuario.id} curso=${req.params.id} pct=${porcentaje} aprobado=${aprobado} prevFallidos=${prevFallidos} → intentos=${intentos_fallidos} bloqueado_hasta=${bloqueado_hasta}`);

  try {
    // Upsert con columnas de bloqueo
    await pool.query(
      `INSERT INTO progreso (usuario_id, curso_id, porcentaje, completado, ultimo_acceso, intentos_fallidos, bloqueado_hasta)
       VALUES ($1,$2,$3,$4,NOW(),$5,$6)
       ON DUPLICATE KEY UPDATE
         porcentaje = GREATEST(porcentaje, $7),
         completado = $8,
         ultimo_acceso = NOW(),
         intentos_fallidos = $9,
         bloqueado_hasta = $10`,
      [req.usuario.id, req.params.id, porcentaje, comp, intentos_fallidos, bloqueado_hasta,
       porcentaje, comp, intentos_fallidos, bloqueado_hasta]
    );
  } catch {
    // Fallback: guardar solo porcentaje/completado si las columnas de bloqueo faltan
    await pool.query(
      `INSERT INTO progreso (usuario_id, curso_id, porcentaje, completado, ultimo_acceso)
       VALUES ($1,$2,$3,$4,NOW())
       ON DUPLICATE KEY UPDATE porcentaje = GREATEST(porcentaje, $5), completado = $6, ultimo_acceso = NOW()`,
      [req.usuario.id, req.params.id, porcentaje, comp, porcentaje, comp]
    );
  }

  // Notificar admin_sede cuando se activa el bloqueo
  if (intentos_fallidos >= 2 && !aprobado) {
    try {
      const userInfo = await pool.query('SELECT sede_id, nombre FROM usuarios WHERE id = $1', [req.usuario.id]);
      const { sede_id, nombre: nombreColab } = userInfo.rows[0] || {};
      const cursoInfo = await pool.query('SELECT nombre FROM cursos WHERE id = $1', [req.params.id]);
      const nombreCurso = cursoInfo.rows[0]?.nombre || 'Curso';
      if (sede_id) {
        const admins = await pool.query(
          "SELECT id FROM usuarios WHERE rol = 'admin_sede' AND sede_id = $1", [sede_id]
        );
        for (const admin of admins.rows) {
          await pool.query(
            'INSERT INTO notificaciones (usuario_id, titulo, mensaje) VALUES ($1,$2,$3)',
            [admin.id,
             'Colaborador bloqueado en curso',
             `${nombreColab} ha fallado 2 veces el curso "${nombreCurso}" y ha sido bloqueado por ${DIAS_BLOQUEO} días.`]
          );
        }
      }
    } catch { /* notificación opcional */ }
  }

  res.json({ porcentaje, completado, intentos_fallidos, bloqueado_hasta });
});

// POST /api/cursos/:id/preguntas — agregar pregunta de evaluación
router.post('/:id/preguntas', verificarToken, verificarRol('profesor', 'admin_sede', 'jefatura'), async (req, res) => {
  const { texto, alternativas } = req.body;
  if (!texto || !alternativas?.length) return res.status(400).json({ error: 'Texto y alternativas son requeridos' });
  try {
    const ins = await pool.query(
      'INSERT INTO preguntas (curso_id, texto, alternativas) VALUES ($1, $2, $3)',
      [req.params.id, texto, JSON.stringify(alternativas)]
    );
    const nueva = await pool.query('SELECT * FROM preguntas WHERE id = $1', [ins.lastID]);
    res.status(201).json(nueva.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al guardar pregunta' });
  }
});

// PATCH /api/cursos/:id/aprobar — profesor aprueba y publica el curso
router.patch('/:id/aprobar', verificarToken, verificarRol('profesor', 'admin_sede', 'jefatura'), async (req, res) => {
  try {
    const existe = await pool.query('SELECT id FROM cursos WHERE id = $1', [req.params.id]);
    if (!existe.rows.length) return res.status(404).json({ error: 'Curso no encontrado' });
    await pool.query('UPDATE cursos SET publicado = 1, profesor_id = $1, updated_at = NOW() WHERE id = $2', [req.usuario.id, req.params.id]);
    res.json({ id: req.params.id, publicado: 1 });
  } catch (err) {
    res.status(500).json({ error: 'Error al aprobar curso' });
  }
});

// DELETE /api/cursos/:id — elimina un curso (borrador o publicado)
router.delete('/:id', verificarToken, verificarRol('profesor', 'admin_sede', 'jefatura'), async (req, res) => {
  try {
    await pool.query('DELETE FROM cursos WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[cursos] DELETE error:', err.message);
    res.status(500).json({ error: 'Error al eliminar curso' });
  }
});

// PATCH /api/cursos/:id/targeting — actualiza estamento_objetivo (array), sede_objetivo y obligatorio
router.patch('/:id/targeting', verificarToken, verificarRol('profesor', 'admin_sede', 'jefatura'), async (req, res) => {
  const { estamento_objetivo, sede_objetivo, obligatorio } = req.body;
  const estStr = Array.isArray(estamento_objetivo) && estamento_objetivo.length > 0
    ? JSON.stringify(estamento_objetivo)
    : null;
  const sedeVal = sede_objetivo ? parseInt(sede_objetivo) : null;
  try {
    await pool.query(
      'UPDATE cursos SET estamento_objetivo = ?, sede_objetivo = ?, obligatorio = ? WHERE id = ?',
      [estStr, sedeVal, obligatorio ? 1 : 0, req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[targeting] Error al guardar:', err.message, '| body:', JSON.stringify(req.body));
    res.status(500).json({ error: 'Error al actualizar targeting', detalle: err.message });
  }
});

// PUT /api/cursos/:id — actualiza nombre, descripción, módulos, preguntas y PPT de un curso borrador
router.put('/:id', verificarToken, verificarRol('profesor', 'admin_sede', 'jefatura'), async (req, res) => {
  const { nombre, descripcion, modulos, preguntas, estamento_objetivo, sede_objetivo, obligatorio } = req.body;
  try {
    // Construcción dinámica del SET para evitar repetir parámetros posicionales en MySQL
    const sets = ['updated_at = NOW()'];
    const vals = [];
    if (nombre !== undefined) { sets.unshift('nombre = ?'); vals.push(nombre || null); }
    if (descripcion !== undefined) { sets.unshift('descripcion = ?'); vals.push(descripcion ?? null); }
    if (estamento_objetivo !== undefined) {
      const estStr = Array.isArray(estamento_objetivo) && estamento_objetivo.length > 0
        ? JSON.stringify(estamento_objetivo)
        : null;
      sets.unshift('estamento_objetivo = ?'); vals.push(estStr);
    }
    if (sede_objetivo !== undefined) { sets.unshift('sede_objetivo = ?'); vals.push(sede_objetivo ? parseInt(sede_objetivo) : null); }
    if (obligatorio !== undefined) { sets.unshift('obligatorio = ?'); vals.push(obligatorio ? 1 : 0); }
    vals.push(req.params.id);
    await pool.query(`UPDATE cursos SET ${sets.join(', ')} WHERE id = ?`, vals);
    if (modulos?.length) {
      for (const mod of modulos) {
        const tieneTitulo = mod.titulo !== undefined && mod.titulo !== null;
        const tienePPT = mod.contenido_presentacion !== undefined;
        if (tieneTitulo && tienePPT) {
          await pool.query(
            'UPDATE modulos SET titulo = $1, descripcion = $2, contenido_presentacion = $3 WHERE id = $4',
            [mod.titulo, mod.descripcion ?? null, JSON.stringify(mod.contenido_presentacion), mod.id]
          );
        } else if (tieneTitulo) {
          await pool.query('UPDATE modulos SET titulo = $1, descripcion = $2 WHERE id = $3', [mod.titulo, mod.descripcion ?? null, mod.id]);
        } else if (tienePPT) {
          // Solo actualizar contenido_presentacion (el profesor puede guardar sin tocar título)
          await pool.query(
            'UPDATE modulos SET contenido_presentacion = $1 WHERE id = $2',
            [JSON.stringify(mod.contenido_presentacion), mod.id]
          );
        }
      }
    }
    if (preguntas?.length) {
      for (const preg of preguntas) {
        await pool.query(
          'UPDATE preguntas SET texto = $1, alternativas = $2 WHERE id = $3',
          [preg.texto, JSON.stringify(preg.alternativas), preg.id]
        );
      }
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar curso' });
  }
});

// POST /api/cursos/:id/video-intro — sube video introductorio del curso
router.post('/:id/video-intro', verificarToken, verificarRol('profesor', 'admin_sede', 'jefatura'), (req, res, next) => {
  uploadVideo.single('video')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Error al procesar el archivo' });
    next();
  });
}, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Video requerido' });
  try {
    const url = fileLocation(req.file);
    await pool.query('UPDATE cursos SET video_intro_url = $1, updated_at = NOW() WHERE id = $2', [url, req.params.id]);
    res.json({ video_intro_url: url });
  } catch (err) {
    console.error('Error video-intro:', err.message);
    res.status(500).json({ error: 'Error al guardar video: ' + err.message });
  }
});

// DELETE /api/cursos/:id/video-intro — elimina video introductorio
router.delete('/:id/video-intro', verificarToken, verificarRol('profesor', 'admin_sede', 'jefatura'), async (req, res) => {
  try {
    const cur = await pool.query('SELECT video_intro_url FROM cursos WHERE id = $1', [req.params.id]);
    if (cur.rows[0]?.video_intro_url) {
      const filePath = path.join(__dirname, '../../', cur.rows[0].video_intro_url);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    await pool.query('UPDATE cursos SET video_intro_url = NULL, updated_at = NOW() WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar video' });
  }
});

// GET /api/cursos/:id/modulos/:moduloId/signed-url — URL firmada temporal para acceder al archivo
router.get('/:id/modulos/:moduloId/signed-url', verificarToken, async (req, res) => {
  try {
    const mod = await pool.query(
      'SELECT archivo_url FROM modulos WHERE id = $1 AND curso_id = $2',
      [req.params.moduloId, req.params.id]
    );
    if (!mod.rows[0]?.archivo_url) return res.status(404).json({ error: 'Módulo no encontrado' });
    const key = keyFromUrl(mod.rows[0].archivo_url);
    if (!key) return res.status(400).json({ error: 'URL de archivo inválida' });
    const url = await generateSignedUrl(key, 3600);
    res.json({ url });
  } catch (err) {
    console.error('[signed-url]', err.message);
    res.status(500).json({ error: 'Error al generar URL' });
  }
});

module.exports = router;
