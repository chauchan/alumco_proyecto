const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../config/db');
const { verificarToken, verificarRol } = require('../middleware/auth');

// Configuración de subida de archivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../../uploads')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `modulo_${Date.now()}${ext}`);
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
      // Cursos visibles: dirigidos a su estamento O dirigidos a todos (NULL)
      query = `SELECT c.*, u.nombre as profesor_nombre, c.obligatorio as obligatorio, a.fecha_limite,
               COALESCE(p.porcentaje, 0) as progreso, COALESCE(p.completado, false) as completado
               FROM cursos c
               LEFT JOIN asignaciones a ON a.curso_id = c.id AND a.usuario_id = $1
               LEFT JOIN usuarios u ON c.profesor_id = u.id
               LEFT JOIN progreso p ON p.curso_id = c.id AND p.usuario_id = $1
               WHERE c.publicado = 1
                 AND (c.estamento_objetivo IS NULL OR c.estamento_objetivo = $2)
               ORDER BY c.obligatorio DESC, c.nombre`;
      params = [id, estamento || ''];
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
    // Imágenes del protocolo asociadas al curso
    const imagenesDir = path.join(__dirname, '../../uploads/imagenes', String(req.params.id));
    let imagenes_protocolo = [];
    if (fs.existsSync(imagenesDir)) {
      imagenes_protocolo = fs.readdirSync(imagenesDir)
        .filter(f => f.endsWith('.png') || f.endsWith('.jpg'))
        .sort()
        .map(f => `/uploads/imagenes/${req.params.id}/${f}`);
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
      [req.params.id, titulo, descripcion, tipo, `/uploads/${req.file.filename}`, orden || 1]
    );
    const nuevo = await pool.query('SELECT * FROM modulos WHERE id = $1', [ins.lastID]);
    res.status(201).json(nuevo.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al subir módulo' });
  }
});

// POST /api/cursos/:id/asignar — asignar curso a usuario(s)
router.post('/:id/asignar', verificarToken, verificarRol('admin_sede', 'jefatura'), async (req, res) => {
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
    // Si las columnas no existen aún, devolver sin bloqueo
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

// PATCH /api/cursos/:id/progreso — actualizar progreso del colaborador
router.patch('/:id/progreso', verificarToken, verificarRol('colaborador'), async (req, res) => {
  const { porcentaje, es_evaluacion } = req.body;
  const aprobado = porcentaje >= 60;
  const completado = porcentaje >= 100;

  // Si no es evaluación (ej: progreso de módulos), hacer upsert simple sin contar fallos
  if (!es_evaluacion) {
    const comp = completado ? 1 : 0;
    try {
      // $5,$6 repiten $3,$4 para evitar VALUES() deprecated en MySQL 8.0.20+
      await pool.query(
        `INSERT INTO progreso (usuario_id, curso_id, porcentaje, completado, ultimo_acceso)
         VALUES ($1,$2,$3,$4,NOW())
         ON DUPLICATE KEY UPDATE porcentaje = GREATEST(porcentaje, $5), completado = $6, ultimo_acceso = NOW()`,
        [req.usuario.id, req.params.id, porcentaje, comp, porcentaje, comp]
      );
      console.log(`[progreso] guardado uid=${req.usuario.id} curso=${req.params.id} pct=${porcentaje}`);
    } catch (e) { console.error('[progreso] upsert módulos falló:', e.message); }
    return res.json({ porcentaje, completado });
  }

  try {
    // Obtener estado actual — las columnas son garantizadas por addColumnIfMissing en startup
    const actual = await pool.query(
      'SELECT intentos_fallidos, bloqueado_hasta FROM progreso WHERE usuario_id = $1 AND curso_id = $2',
      [req.usuario.id, req.params.id]
    );
    let row = actual.rows[0];

    let intentos_fallidos, bloqueado_hasta;
    const DIAS_BLOQUEO = 7;

    const comp = completado ? 1 : 0;
    console.log(`[bloqueo] uid=${req.usuario.id} curso=${req.params.id} pct=${porcentaje} aprobado=${aprobado} row=`, row);
    if (!row) {
      // Primera vez — no hay fila previa (ni siquiera módulos)
      intentos_fallidos = aprobado ? 0 : 1;
      bloqueado_hasta = null; // 1 fallo no bloquea
      await pool.query(
        `INSERT INTO progreso (usuario_id, curso_id, porcentaje, completado, ultimo_acceso, intentos_fallidos, bloqueado_hasta)
         VALUES ($1,$2,$3,$4,NOW(),$5,$6)`,
        [req.usuario.id, req.params.id, porcentaje, comp, intentos_fallidos, bloqueado_hasta]
      );
    } else {
      const prevFallidos = parseInt(row.intentos_fallidos || 0, 10);
      intentos_fallidos = aprobado ? 0 : prevFallidos + 1;
      const yaEstabaBlockeado = row.bloqueado_hasta && new Date(row.bloqueado_hasta) > new Date();
      bloqueado_hasta = aprobado ? null
        : intentos_fallidos >= 2 ? new Date(Date.now() + DIAS_BLOQUEO * 24 * 60 * 60 * 1000)
        : row.bloqueado_hasta;
      console.log(`[bloqueo] prevFallidos=${prevFallidos} → intentos=${intentos_fallidos} bloqueado_hasta=${bloqueado_hasta}`);
      await pool.query(
        `UPDATE progreso SET porcentaje = GREATEST(porcentaje, $1), completado = $2,
         ultimo_acceso = NOW(), intentos_fallidos = $3, bloqueado_hasta = $4
         WHERE usuario_id = $5 AND curso_id = $6`,
        [porcentaje, comp, intentos_fallidos, bloqueado_hasta, req.usuario.id, req.params.id]
      );

      // Notificar admin_sede solo cuando se activa el bloqueo por primera vez
      if (!yaEstabaBlockeado && intentos_fallidos >= 2 && !aprobado) {
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
        } catch { /* notificación opcional, no bloquear la respuesta */ }
      }
    }

    res.json({ porcentaje, completado, intentos_fallidos, bloqueado_hasta });
  } catch (err) {
    console.error('[progreso] Error al actualizar progreso:', err.message);
    res.status(500).json({ error: 'Error al actualizar progreso' });
  }
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

// PATCH /api/cursos/:id/targeting — actualiza estamento_objetivo y obligatorio
router.patch('/:id/targeting', verificarToken, verificarRol('profesor', 'admin_sede', 'jefatura'), async (req, res) => {
  const { estamento_objetivo, obligatorio } = req.body;
  try {
    await pool.query(
      'UPDATE cursos SET estamento_objetivo = $1, obligatorio = $2, updated_at = NOW() WHERE id = $3',
      [estamento_objetivo || null, obligatorio ? 1 : 0, req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar targeting' });
  }
});

// PUT /api/cursos/:id — actualiza nombre, descripción, módulos, preguntas y PPT de un curso borrador
router.put('/:id', verificarToken, verificarRol('profesor', 'admin_sede', 'jefatura'), async (req, res) => {
  const { nombre, descripcion, modulos, preguntas, estamento_objetivo, obligatorio } = req.body;
  try {
    // Construcción dinámica del SET para evitar repetir parámetros posicionales en MySQL
    const sets = ['updated_at = NOW()'];
    const vals = [];
    if (nombre !== undefined) { sets.unshift('nombre = ?'); vals.push(nombre || null); }
    if (descripcion !== undefined) { sets.unshift('descripcion = ?'); vals.push(descripcion ?? null); }
    if (estamento_objetivo !== undefined) { sets.unshift('estamento_objetivo = ?'); vals.push(estamento_objetivo || null); }
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
    const url = `/uploads/${req.file.filename}`;
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

module.exports = router;
