const express = require('express');
const router = express.Router();
const multer = require('multer');
const multerS3 = require('multer-s3');
const path = require('path');
const fs = require('fs');
const pool = require('../config/db');
const { verificarToken, verificarRol } = require('../middleware/auth');
const { s3, BUCKET, fileLocation, generateSignedUrl, keyFromUrl } = require('../config/s3');
const { notificar } = require('../utils/notificar');

const storage = multerS3({
  s3, bucket: BUCKET, acl: 'public-read', contentType: multerS3.AUTO_CONTENT_TYPE,
  key: (req, file, cb) => cb(null, `modulos/modulo_${Date.now()}${path.extname(file.originalname)}`)
});
const fileFilter = (req, file, cb) => {
  const ok = ['application/pdf','video/mp4','video/webm',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'];
  ok.includes(file.mimetype) ? cb(null, true) : cb(new Error('Formato no válido. Solo PDF, video o PPT'), false);
};
const upload = multer({ storage, fileFilter, limits: { fileSize: 100 * 1024 * 1024 } });
const uploadVideo = multer({
  storage,
  fileFilter: (req, file, cb) => file.mimetype.startsWith('video/') ? cb(null, true) : cb(new Error('Solo videos'), false),
  limits: { fileSize: 500 * 1024 * 1024 }
});

// Resuelve nombre de area a area_id (inserta si no existe)
async function resolveAreaId(nombre) {
  if (!nombre) return null;
  const { rows } = await pool.query('SELECT id FROM areas WHERE nombre = ?', [nombre]);
  if (rows.length) return rows[0].id;
  const ins = await pool.query('INSERT INTO areas (nombre) VALUES (?)', [nombre]);
  return ins.lastID;
}

// Lee alternativas de un array de preguntas y las adjunta como .alternativas[]
async function adjuntarAlternativas(preguntas) {
  if (!preguntas.length) return preguntas;
  const ids = preguntas.map(p => p.id);
  const { rows: alts } = await pool.query(
    `SELECT id, pregunta_id, texto, correcta FROM alternativas WHERE pregunta_id IN (${ids.map(() => '?').join(',')}) ORDER BY id`,
    ids
  );
  const byPregunta = {};
  for (const a of alts) {
    if (!byPregunta[a.pregunta_id]) byPregunta[a.pregunta_id] = [];
    byPregunta[a.pregunta_id].push(a);
  }
  return preguntas.map(p => ({ ...p, alternativas: byPregunta[p.id] || [] }));
}

// Lee slides de un array de módulos y los adjunta como .contenido_presentacion
async function adjuntarSlides(modulos) {
  if (!modulos.length) return modulos;
  const ids = modulos.map(m => m.id);
  const { rows: slides } = await pool.query(
    `SELECT modulo_id, numero, datos FROM modulo_slides WHERE modulo_id IN (${ids.map(() => '?').join(',')}) ORDER BY modulo_id, numero`,
    ids
  );
  const byModulo = {};
  for (const s of slides) {
    if (!byModulo[s.modulo_id]) byModulo[s.modulo_id] = [];
    byModulo[s.modulo_id].push(typeof s.datos === 'string' ? JSON.parse(s.datos) : s.datos);
  }
  return modulos.map(m => ({
    ...m,
    contenido_presentacion: byModulo[m.id] ? { diapositivas: byModulo[m.id] } : null
  }));
}

// GET /api/cursos
router.get('/', verificarToken, async (req, res) => {
  const { rol, id } = req.usuario;
  try {
    let query, params = [];

    if (rol === 'colaborador') {
      query = `
        SELECT c.*, a.nombre AS area, u.nombre AS profesor_nombre,
               c.obligatorio, asig.fecha_limite,
               COALESCE(p.porcentaje, 0) AS progreso,
               (p.porcentaje >= 100) AS completado
        FROM cursos c
        LEFT JOIN areas         a    ON a.id          = c.area_id
        LEFT JOIN asignaciones  asig ON asig.curso_id  = c.id AND asig.usuario_id = ?
        LEFT JOIN usuarios      u    ON u.id           = c.profesor_id
        LEFT JOIN progreso      p    ON p.curso_id     = c.id AND p.usuario_id = ?
        JOIN  usuarios          me   ON me.id          = ?
        WHERE c.publicado = 1
          AND (c.sede_objetivo IS NULL OR c.sede_objetivo = COALESCE(me.sede_id, 0))
          AND (
            NOT EXISTS (SELECT 1 FROM curso_estamentos ce WHERE ce.curso_id = c.id)
            OR EXISTS (
              SELECT 1 FROM curso_estamentos ce
              WHERE ce.curso_id = c.id AND ce.estamento_id = me.estamento_id
            )
          )
        ORDER BY c.obligatorio DESC, c.nombre`;
      params = [id, id, id];

    } else if (rol === 'profesor') {
      query = `
        SELECT c.*, a.nombre AS area, COUNT(DISTINCT asig.usuario_id) AS inscritos
        FROM cursos c
        LEFT JOIN areas        a    ON a.id         = c.area_id
        LEFT JOIN asignaciones asig ON asig.curso_id = c.id
        WHERE c.profesor_id = ?
        GROUP BY c.id, a.nombre ORDER BY c.created_at DESC`;
      params = [id];

    } else {
      query = `
        SELECT c.*, a.nombre AS area, u.nombre AS profesor_nombre,
               COUNT(DISTINCT asig.usuario_id) AS inscritos
        FROM cursos c
        LEFT JOIN areas        a    ON a.id         = c.area_id
        LEFT JOIN usuarios     u    ON u.id         = c.profesor_id
        LEFT JOIN asignaciones asig ON asig.curso_id = c.id
        GROUP BY c.id, a.nombre, u.nombre ORDER BY c.nombre`;
    }

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener cursos' });
  }
});

// GET /api/cursos/mis-capacitaciones
router.get('/mis-capacitaciones', verificarToken, async (req, res) => {
  const { id } = req.usuario;
  try {
    const { rows } = await pool.query(
      `SELECT c.*, a.nombre AS area, u.nombre AS profesor_nombre,
              COALESCE(p.porcentaje, 0) AS progreso,
              (p.porcentaje >= 100) AS completado,
              COALESCE(p.intentos_fallidos, 0) AS intentos_fallidos,
              p.bloqueado_hasta
       FROM cursos c
       LEFT JOIN areas     a  ON a.id       = c.area_id
       LEFT JOIN usuarios  u  ON u.id       = c.profesor_id
       LEFT JOIN progreso  p  ON p.curso_id = c.id AND p.usuario_id = ?
       JOIN  usuarios      me ON me.id      = ?
       WHERE c.publicado = 1 AND c.obligatorio = 1
         AND (c.sede_objetivo IS NULL OR c.sede_objetivo = COALESCE(me.sede_id, 0))
         AND (
           NOT EXISTS (SELECT 1 FROM curso_estamentos ce WHERE ce.curso_id = c.id)
           OR EXISTS (
             SELECT 1 FROM curso_estamentos ce
             WHERE ce.curso_id = c.id AND ce.estamento_id = me.estamento_id
           )
         )
       ORDER BY c.nombre`,
      [id, id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener capacitaciones' });
  }
});

// GET /api/cursos/pendientes-ia
router.get('/pendientes-ia', verificarToken, verificarRol('profesor', 'admin_sede', 'jefatura'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.*, a.nombre AS area,
         (SELECT COUNT(*) FROM modulos  m WHERE m.curso_id = c.id) AS modulos_count,
         (SELECT COUNT(*) FROM preguntas p WHERE p.curso_id = c.id) AS preguntas_count
       FROM cursos c
       LEFT JOIN areas a ON a.id = c.area_id
       WHERE c.generado_por_ia = 1 AND c.publicado = 0
       ORDER BY c.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener borradores' });
  }
});

// GET /api/cursos/:id
router.get('/:id', verificarToken, async (req, res) => {
  try {
    const { rows: cursoRows } = await pool.query(
      `SELECT c.*, a.nombre AS area, u.nombre AS profesor_nombre
       FROM cursos c
       LEFT JOIN areas    a ON a.id = c.area_id
       LEFT JOIN usuarios u ON u.id = c.profesor_id
       WHERE c.id = ?`,
      [req.params.id]
    );
    if (!cursoRows.length) return res.status(404).json({ error: 'Curso no encontrado' });

    const { rows: modulosRaw } = await pool.query(
      'SELECT * FROM modulos WHERE curso_id = ? ORDER BY orden',
      [req.params.id]
    );
    const { rows: preguntasRaw } = await pool.query(
      'SELECT id, curso_id, texto, created_at FROM preguntas WHERE curso_id = ?',
      [req.params.id]
    );

    const [modulos, preguntas] = await Promise.all([
      adjuntarSlides(modulosRaw),
      adjuntarAlternativas(preguntasRaw),
    ]);

    // Estamentos objetivo del curso
    const { rows: ests } = await pool.query(
      `SELECT e.nombre FROM curso_estamentos ce
       JOIN estamentos e ON e.id = ce.estamento_id
       WHERE ce.curso_id = ?`,
      [req.params.id]
    );
    const estamento_objetivo = ests.map(e => e.nombre);

    let imagenes_protocolo = [];
    const _rawImagenes = cursoRows[0].imagenes_protocolo;
    const imagenesDB = typeof _rawImagenes === 'string' ? JSON.parse(_rawImagenes) : _rawImagenes;
    if (Array.isArray(imagenesDB) && imagenesDB.length > 0) {
      imagenes_protocolo = await Promise.all(
        imagenesDB.map(url => {
          const key = keyFromUrl(url);
          return key ? generateSignedUrl(key, 3600) : url;
        })
      );
    }

    res.json({ ...cursoRows[0], estamento_objetivo, modulos, preguntas, imagenes_protocolo });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener curso' });
  }
});

// POST /api/cursos
router.post('/', verificarToken, verificarRol('profesor', 'admin_sede', 'jefatura'), async (req, res) => {
  const { nombre, descripcion, area, requiere_practico } = req.body;
  if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' });
  try {
    const area_id = await resolveAreaId(area);
    const ins = await pool.query(
      'INSERT INTO cursos (nombre, descripcion, area_id, profesor_id, requiere_practico) VALUES (?, ?, ?, ?, ?)',
      [nombre, descripcion, area_id, req.usuario.id, requiere_practico ? 1 : 0]
    );
    const { rows } = await pool.query(
      'SELECT c.*, a.nombre AS area FROM cursos c LEFT JOIN areas a ON a.id = c.area_id WHERE c.id = ?',
      [ins.lastID]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al crear curso' });
  }
});

// PATCH /api/cursos/:id/publicar
router.patch('/:id/publicar', verificarToken, verificarRol('profesor', 'admin_sede', 'jefatura'), async (req, res) => {
  const { publicado } = req.body;
  try {
    await pool.query('UPDATE cursos SET publicado = ?, updated_at = NOW() WHERE id = ?', [publicado, req.params.id]);
    res.json({ id: req.params.id, publicado });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar estado del curso' });
  }
});

// POST /api/cursos/:id/modulos
router.post('/:id/modulos', verificarToken, verificarRol('profesor', 'admin_sede', 'jefatura'), upload.single('archivo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Archivo requerido' });
  const { titulo, descripcion, orden } = req.body;
  const tipo = req.file.mimetype.startsWith('video') ? 'video'
    : req.file.mimetype === 'application/pdf' ? 'pdf' : 'ppt';
  try {
    const ins = await pool.query(
      'INSERT INTO modulos (curso_id, titulo, descripcion, tipo, archivo_url, orden) VALUES (?, ?, ?, ?, ?, ?)',
      [req.params.id, titulo, descripcion, tipo, fileLocation(req.file), orden || 1]
    );
    const { rows } = await pool.query('SELECT * FROM modulos WHERE id = ?', [ins.lastID]);
    res.status(201).json({ ...rows[0], contenido_presentacion: null });
  } catch (err) {
    res.status(500).json({ error: 'Error al subir módulo' });
  }
});

// POST /api/cursos/:id/asignar
router.post('/:id/asignar', verificarToken, verificarRol('profesor', 'admin_sede', 'jefatura'), async (req, res) => {
  const { usuario_ids, obligatorio, fecha_limite } = req.body;
  if (!usuario_ids?.length) return res.status(400).json({ error: 'usuario_ids requerido' });
  try {
    await Promise.all(usuario_ids.map(uid =>
      pool.query(
        'INSERT IGNORE INTO asignaciones (usuario_id, curso_id, obligatorio, fecha_limite) VALUES (?, ?, ?, ?)',
        [uid, req.params.id, obligatorio || 0, fecha_limite || null]
      )
    ));
    res.json({ message: `Curso asignado a ${usuario_ids.length} usuario(s)` });
  } catch (err) {
    res.status(500).json({ error: 'Error al asignar curso' });
  }
});

// GET /api/cursos/:id/mi-progreso
router.get('/:id/mi-progreso', verificarToken, async (req, res) => {
  const uid = req.usuario.id;
  const cid = req.params.id;
  try {
    const [progresoRes, cursoRes, intentoSinCertRes] = await Promise.all([
      pool.query('SELECT porcentaje, intentos_fallidos, bloqueado_hasta FROM progreso WHERE usuario_id = ? AND curso_id = ?', [uid, cid]),
      pool.query('SELECT requiere_practico FROM cursos WHERE id = ?', [cid]),
      pool.query(
        `SELECT 1 FROM intentos it
         WHERE it.usuario_id = ? AND it.curso_id = ? AND it.aprobado = 1
           AND NOT EXISTS (SELECT 1 FROM certificados cert WHERE cert.intento_id = it.id)
         LIMIT 1`,
        [uid, cid]
      )
    ]);
    const r = progresoRes.rows[0];
    const requierePractico = parseInt(cursoRes.rows[0]?.requiere_practico || 0) === 1;
    const esperandoPractico = requierePractico && intentoSinCertRes.rows.length > 0;
    const base = { requiere_practico: requierePractico, esperando_practico: esperandoPractico };
    res.json(r
      ? { ...r, completado: r.porcentaje >= 100, ...base }
      : { porcentaje: 0, completado: false, intentos_fallidos: 0, bloqueado_hasta: null, ...base });
  } catch {
    res.json({ porcentaje: 0, completado: false, intentos_fallidos: 0, bloqueado_hasta: null, requiere_practico: false, esperando_practico: false });
  }
});

// PATCH /api/cursos/:id/progreso
router.patch('/:id/progreso', verificarToken, async (req, res) => {
  const { porcentaje, es_evaluacion } = req.body;
  const aprobado  = porcentaje >= 60;

  if (!es_evaluacion) {
    try {
      await pool.query(
        `INSERT INTO progreso (usuario_id, curso_id, porcentaje, ultimo_acceso)
         VALUES (?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE porcentaje = GREATEST(porcentaje, ?), ultimo_acceso = NOW()`,
        [req.usuario.id, req.params.id, porcentaje, porcentaje]
      );
    } catch (e) { console.error('[progreso] upsert falló:', e.message); }
    return res.json({ porcentaje, completado: porcentaje >= 100 });
  }

  const DIAS_BLOQUEO = 7;
  let prevFallidos = 0, bloqueadoActivo = false, bloqueadoHastaActual = null;
  try {
    const { rows } = await pool.query(
      'SELECT intentos_fallidos, bloqueado_hasta FROM progreso WHERE usuario_id = ? AND curso_id = ?',
      [req.usuario.id, req.params.id]
    );
    if (rows[0]) {
      prevFallidos        = parseInt(rows[0].intentos_fallidos || 0, 10);
      bloqueadoHastaActual = rows[0].bloqueado_hasta || null;
      bloqueadoActivo     = !!bloqueadoHastaActual && new Date(bloqueadoHastaActual) > new Date();
    }
  } catch { /* columnas pueden no existir */ }

  if (bloqueadoActivo)
    return res.status(403).json({ error: 'Curso bloqueado', bloqueado_hasta: bloqueadoHastaActual });

  const intentos_fallidos = aprobado ? 0 : prevFallidos + 1;
  const bloqueado_hasta   = aprobado ? null
    : intentos_fallidos >= 2 ? new Date(Date.now() + DIAS_BLOQUEO * 86400000)
    : bloqueadoHastaActual;

  try {
    await pool.query(
      `INSERT INTO progreso (usuario_id, curso_id, porcentaje, ultimo_acceso, intentos_fallidos, bloqueado_hasta)
       VALUES (?, ?, ?, NOW(), ?, ?)
       ON DUPLICATE KEY UPDATE
         porcentaje = GREATEST(porcentaje, ?), ultimo_acceso = NOW(),
         intentos_fallidos = ?, bloqueado_hasta = ?`,
      [req.usuario.id, req.params.id, porcentaje, intentos_fallidos, bloqueado_hasta,
       porcentaje, intentos_fallidos, bloqueado_hasta]
    );
  } catch {
    await pool.query(
      `INSERT INTO progreso (usuario_id, curso_id, porcentaje, ultimo_acceso)
       VALUES (?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE porcentaje = GREATEST(porcentaje, ?), ultimo_acceso = NOW()`,
      [req.usuario.id, req.params.id, porcentaje, porcentaje]
    );
  }

  if (intentos_fallidos >= 2 && !aprobado) {
    try {
      const { rows: uInfo } = await pool.query('SELECT sede_id, nombre FROM usuarios WHERE id = ?', [req.usuario.id]);
      const { sede_id, nombre: nombreColab } = uInfo[0] || {};
      const { rows: cInfo } = await pool.query('SELECT nombre FROM cursos WHERE id = ?', [req.params.id]);
      const nombreCurso = cInfo[0]?.nombre || 'Curso';
      if (sede_id) {
        const { rows: admins } = await pool.query("SELECT id FROM usuarios WHERE rol = 'admin_sede' AND sede_id = ?", [sede_id]);
        for (const admin of admins) {
          await notificar(admin.id, {
            tipo: 'evaluacion_bloqueo',
            entidad: 'curso',
            entidad_id: parseInt(req.params.id),
            titulo: 'Colaborador bloqueado en curso',
            mensaje: `${nombreColab} ha fallado 2 veces el curso "${nombreCurso}" y ha sido bloqueado por ${DIAS_BLOQUEO} días.`
          });
        }
      }
    } catch { /* notificación opcional */ }
  }

  res.json({ porcentaje, completado: porcentaje >= 100, intentos_fallidos, bloqueado_hasta });
});

// POST /api/cursos/:id/preguntas
router.post('/:id/preguntas', verificarToken, verificarRol('profesor', 'admin_sede', 'jefatura'), async (req, res) => {
  const { texto, alternativas } = req.body;
  if (!texto || !alternativas?.length)
    return res.status(400).json({ error: 'Texto y alternativas son requeridos' });
  try {
    const ins = await pool.query('INSERT INTO preguntas (curso_id, texto) VALUES (?, ?)', [req.params.id, texto]);
    const preguntaId = ins.lastID;
    const altIds = [];
    for (const alt of alternativas) {
      const r = await pool.query(
        'INSERT INTO alternativas (pregunta_id, texto, correcta) VALUES (?, ?, ?)',
        [preguntaId, alt.texto, alt.correcta ? 1 : 0]
      );
      altIds.push({ id: r.lastID, texto: alt.texto, correcta: alt.correcta });
    }
    res.status(201).json({ id: preguntaId, curso_id: req.params.id, texto, alternativas: altIds });
  } catch (err) {
    res.status(500).json({ error: 'Error al guardar pregunta' });
  }
});

// PATCH /api/cursos/:id/aprobar
router.patch('/:id/aprobar', verificarToken, verificarRol('profesor', 'admin_sede', 'jefatura'), async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id FROM cursos WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Curso no encontrado' });
    await pool.query('UPDATE cursos SET publicado = 1, profesor_id = ?, updated_at = NOW() WHERE id = ?', [req.usuario.id, req.params.id]);
    res.json({ id: req.params.id, publicado: 1 });
  } catch (err) {
    res.status(500).json({ error: 'Error al aprobar curso' });
  }
});

// DELETE /api/cursos/:id
router.delete('/:id', verificarToken, verificarRol('profesor', 'admin_sede', 'jefatura'), async (req, res) => {
  try {
    await pool.query('DELETE FROM cursos WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[cursos] DELETE error:', err.message);
    res.status(500).json({ error: 'Error al eliminar curso' });
  }
});

// PATCH /api/cursos/:id/targeting
router.patch('/:id/targeting', verificarToken, verificarRol('profesor', 'admin_sede', 'jefatura'), async (req, res) => {
  const { estamento_objetivo, sede_objetivo, obligatorio } = req.body;
  const cursoId = req.params.id;
  try {
    // Actualizar sede_objetivo y obligatorio en cursos
    await pool.query(
      'UPDATE cursos SET sede_objetivo = ?, obligatorio = ?, updated_at = NOW() WHERE id = ?',
      [sede_objetivo ? parseInt(sede_objetivo) : null, obligatorio ? 1 : 0, cursoId]
    );

    // Reemplazar curso_estamentos
    await pool.query('DELETE FROM curso_estamentos WHERE curso_id = ?', [cursoId]);
    if (Array.isArray(estamento_objetivo) && estamento_objetivo.length) {
      for (const nombre of estamento_objetivo) {
        const { rows } = await pool.query('SELECT id FROM estamentos WHERE nombre = ?', [nombre]);
        if (!rows.length) continue;
        await pool.query('INSERT IGNORE INTO curso_estamentos (curso_id, estamento_id) VALUES (?, ?)', [cursoId, rows[0].id]);
      }
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('[targeting] Error:', err.message);
    res.status(500).json({ error: 'Error al actualizar targeting', detalle: err.message });
  }
});

// PUT /api/cursos/:id
router.put('/:id', verificarToken, verificarRol('profesor', 'admin_sede', 'jefatura'), async (req, res) => {
  const { nombre, descripcion, modulos, preguntas, estamento_objetivo, sede_objetivo, obligatorio } = req.body;
  const cursoId = req.params.id;
  try {
    // Actualizar campos escalares del curso
    const sets = ['updated_at = NOW()'];
    const vals = [];
    if (nombre       !== undefined) { sets.unshift('nombre = ?');       vals.push(nombre ?? null); }
    if (descripcion  !== undefined) { sets.unshift('descripcion = ?');  vals.push(descripcion ?? null); }
    if (sede_objetivo !== undefined) { sets.unshift('sede_objetivo = ?'); vals.push(sede_objetivo ? parseInt(sede_objetivo) : null); }
    if (obligatorio  !== undefined) { sets.unshift('obligatorio = ?');  vals.push(obligatorio ? 1 : 0); }
    vals.push(cursoId);
    await pool.query(`UPDATE cursos SET ${sets.join(', ')} WHERE id = ?`, vals);

    // Actualizar estamentos objetivo
    if (estamento_objetivo !== undefined) {
      await pool.query('DELETE FROM curso_estamentos WHERE curso_id = ?', [cursoId]);
      if (Array.isArray(estamento_objetivo) && estamento_objetivo.length) {
        for (const nombre of estamento_objetivo) {
          const { rows } = await pool.query('SELECT id FROM estamentos WHERE nombre = ?', [nombre]);
          if (!rows.length) continue;
          await pool.query('INSERT IGNORE INTO curso_estamentos (curso_id, estamento_id) VALUES (?, ?)', [cursoId, rows[0].id]);
        }
      }
    }

    // Actualizar módulos
    if (modulos?.length) {
      for (const mod of modulos) {
        const tieneTitulo = mod.titulo !== undefined && mod.titulo !== null;
        const tieneSlides = mod.contenido_presentacion !== undefined;

        if (tieneTitulo) {
          await pool.query('UPDATE modulos SET titulo = ?, descripcion = ? WHERE id = ?',
            [mod.titulo, mod.descripcion ?? null, mod.id]);
        }
        if (tieneSlides && mod.contenido_presentacion) {
          // Reemplazar slides del módulo
          await pool.query('DELETE FROM modulo_slides WHERE modulo_id = ?', [mod.id]);
          const diaps = mod.contenido_presentacion?.diapositivas || mod.contenido_presentacion;
          if (Array.isArray(diaps)) {
            for (let i = 0; i < diaps.length; i++) {
              await pool.query('INSERT INTO modulo_slides (modulo_id, numero, datos) VALUES (?, ?, ?)',
                [mod.id, i + 1, JSON.stringify(diaps[i])]);
            }
          }
        }
      }
    }

    // Actualizar preguntas y sus alternativas
    if (preguntas?.length) {
      for (const preg of preguntas) {
        await pool.query('UPDATE preguntas SET texto = ? WHERE id = ?', [preg.texto, preg.id]);
        if (Array.isArray(preg.alternativas)) {
          await pool.query('DELETE FROM alternativas WHERE pregunta_id = ?', [preg.id]);
          for (const alt of preg.alternativas) {
            await pool.query(
              'INSERT INTO alternativas (pregunta_id, texto, correcta) VALUES (?, ?, ?)',
              [preg.id, alt.texto, alt.correcta ? 1 : 0]
            );
          }
        }
      }
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar curso' });
  }
});

// POST /api/cursos/:id/video-intro
router.post('/:id/video-intro', verificarToken, verificarRol('profesor', 'admin_sede', 'jefatura'), (req, res, next) => {
  uploadVideo.single('video')(req, res, err => {
    if (err) return res.status(400).json({ error: err.message || 'Error al procesar el archivo' });
    next();
  });
}, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Video requerido' });
  try {
    const url = fileLocation(req.file);
    await pool.query('UPDATE cursos SET video_intro_url = ?, updated_at = NOW() WHERE id = ?', [url, req.params.id]);
    res.json({ video_intro_url: url });
  } catch (err) {
    res.status(500).json({ error: 'Error al guardar video: ' + err.message });
  }
});

// DELETE /api/cursos/:id/video-intro
router.delete('/:id/video-intro', verificarToken, verificarRol('profesor', 'admin_sede', 'jefatura'), async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT video_intro_url FROM cursos WHERE id = ?', [req.params.id]);
    if (rows[0]?.video_intro_url) {
      const fp = path.join(__dirname, '../../', rows[0].video_intro_url);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
    await pool.query('UPDATE cursos SET video_intro_url = NULL, updated_at = NOW() WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar video' });
  }
});

// GET /api/cursos/:id/modulos/:moduloId/signed-url
router.get('/:id/modulos/:moduloId/signed-url', verificarToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT archivo_url FROM modulos WHERE id = ? AND curso_id = ?',
      [req.params.moduloId, req.params.id]
    );
    if (!rows[0]?.archivo_url) return res.status(404).json({ error: 'Módulo no encontrado' });
    const key = keyFromUrl(rows[0].archivo_url);
    if (!key) return res.status(400).json({ error: 'URL de archivo inválida' });
    const url = await generateSignedUrl(key, 3600);
    res.json({ url });
  } catch (err) {
    console.error('[signed-url]', err.message);
    res.status(500).json({ error: 'Error al generar URL' });
  }
});

module.exports = router;
