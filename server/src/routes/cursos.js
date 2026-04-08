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

// GET /api/cursos — listar cursos
router.get('/', verificarToken, async (req, res) => {
  const { rol, id } = req.usuario;
  try {
    let query, params = [];
    if (rol === 'colaborador') {
      // Solo cursos asignados
      query = `SELECT c.*, u.nombre as profesor_nombre, a.obligatorio, a.fecha_limite,
               COALESCE(p.porcentaje, 0) as progreso, COALESCE(p.completado, false) as completado
               FROM cursos c
               JOIN asignaciones a ON a.curso_id = c.id AND a.usuario_id = $1
               LEFT JOIN usuarios u ON c.profesor_id = u.id
               LEFT JOIN progreso p ON p.curso_id = c.id AND p.usuario_id = $1
               WHERE c.publicado = true ORDER BY c.nombre`;
      params = [id];
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
      `SELECT c.*, COUNT(m.id) as modulos_count, COUNT(p.id) as preguntas_count
       FROM cursos c
       LEFT JOIN modulos m ON m.curso_id = c.id
       LEFT JOIN preguntas p ON p.curso_id = c.id
       WHERE c.generado_por_ia = 1 AND c.publicado = 0
       GROUP BY c.id
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
    const result = await pool.query(
      'INSERT INTO cursos (nombre, descripcion, area, profesor_id) VALUES ($1,$2,$3,$4) RETURNING *',
      [nombre, descripcion, area, req.usuario.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al crear curso' });
  }
});

// PATCH /api/cursos/:id/publicar — publicar/despublicar
router.patch('/:id/publicar', verificarToken, verificarRol('profesor', 'admin_sede', 'jefatura'), async (req, res) => {
  const { publicado } = req.body;
  try {
    const result = await pool.query(
      'UPDATE cursos SET publicado = $1, updated_at = NOW() WHERE id = $2 RETURNING id, nombre, publicado',
      [publicado, req.params.id]
    );
    res.json(result.rows[0]);
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
    const result = await pool.query(
      'INSERT INTO modulos (curso_id, titulo, descripcion, tipo, archivo_url, orden) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [req.params.id, titulo, descripcion, tipo, `/uploads/${req.file.filename}`, orden || 1]
    );
    res.status(201).json(result.rows[0]);
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
        'INSERT INTO asignaciones (usuario_id, curso_id, obligatorio, fecha_limite) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING',
        [uid, req.params.id, obligatorio || false, fecha_limite || null]
      )
    );
    await Promise.all(inserts);
    res.json({ message: `Curso asignado a ${usuario_ids.length} usuario(s)` });
  } catch (err) {
    res.status(500).json({ error: 'Error al asignar curso' });
  }
});

// PATCH /api/cursos/:id/progreso — actualizar progreso del colaborador
router.patch('/:id/progreso', verificarToken, verificarRol('colaborador'), async (req, res) => {
  const { porcentaje } = req.body;
  const completado = porcentaje >= 100;
  try {
    await pool.query(
      `INSERT INTO progreso (usuario_id, curso_id, porcentaje, completado, ultimo_acceso)
       VALUES ($1,$2,$3,$4,NOW())
       ON CONFLICT (usuario_id, curso_id) DO UPDATE SET porcentaje = GREATEST(progreso.porcentaje, $3), completado = $4, ultimo_acceso = NOW()`,
      [req.usuario.id, req.params.id, porcentaje, completado]
    );
    res.json({ porcentaje, completado });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar progreso' });
  }
});

// POST /api/cursos/:id/preguntas — agregar pregunta de evaluación
router.post('/:id/preguntas', verificarToken, verificarRol('profesor', 'admin_sede', 'jefatura'), async (req, res) => {
  const { texto, alternativas } = req.body;
  if (!texto || !alternativas?.length) return res.status(400).json({ error: 'Texto y alternativas son requeridos' });
  try {
    const result = await pool.query(
      'INSERT INTO preguntas (curso_id, texto, alternativas) VALUES ($1, $2, $3) RETURNING *',
      [req.params.id, texto, JSON.stringify(alternativas)]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al guardar pregunta' });
  }
});

// PATCH /api/cursos/:id/aprobar — profesor aprueba y publica el curso
router.patch('/:id/aprobar', verificarToken, verificarRol('profesor', 'admin_sede', 'jefatura'), async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE cursos SET publicado = 1, profesor_id = $1, updated_at = NOW() WHERE id = $2 RETURNING id, nombre, publicado',
      [req.usuario.id, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Curso no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al aprobar curso' });
  }
});

// DELETE /api/cursos/:id — elimina un curso borrador
router.delete('/:id', verificarToken, verificarRol('profesor', 'admin_sede', 'jefatura'), async (req, res) => {
  try {
    await pool.query('DELETE FROM cursos WHERE id = $1 AND publicado = 0', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar curso' });
  }
});

// PUT /api/cursos/:id — actualiza nombre, descripción, módulos, preguntas y PPT de un curso borrador
router.put('/:id', verificarToken, verificarRol('profesor', 'admin_sede', 'jefatura'), async (req, res) => {
  const { nombre, descripcion, modulos, preguntas } = req.body;
  try {
    await pool.query(
      'UPDATE cursos SET nombre = COALESCE($1, nombre), descripcion = COALESCE($2, descripcion), updated_at = NOW() WHERE id = $3',
      [nombre || null, descripcion !== undefined ? descripcion : null, req.params.id]
    );
    if (modulos?.length) {
      for (const mod of modulos) {
        if (mod.contenido_presentacion !== undefined) {
          await pool.query(
            'UPDATE modulos SET titulo = $1, descripcion = $2, contenido_presentacion = $3 WHERE id = $4',
            [mod.titulo, mod.descripcion, JSON.stringify(mod.contenido_presentacion), mod.id]
          );
        } else {
          await pool.query('UPDATE modulos SET titulo = $1, descripcion = $2 WHERE id = $3', [mod.titulo, mod.descripcion, mod.id]);
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

module.exports = router;
