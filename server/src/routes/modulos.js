const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verificarToken } = require('../middleware/auth');
const { notificar } = require('../utils/notificar');

// GET /api/modulos/:id/comentarios
// Devuelve todos los comentarios del módulo con nombre de autor.
// El cliente arma el threading por parent_id.
router.get('/:id/comentarios', verificarToken, async (req, res) => {
  const moduloId = parseInt(req.params.id);
  try {
    const { rows } = await pool.query(
      `SELECT c.id, c.modulo_id, c.usuario_id, c.parent_id, c.texto, c.creado_en,
              u.nombre AS autor_nombre
       FROM   comentarios_modulo c
       JOIN   usuarios u ON u.id = c.usuario_id
       WHERE  c.modulo_id = $1
       ORDER  BY c.creado_en ASC`,
      [moduloId]
    );
    res.json(rows);
  } catch (err) {
    console.error('[GET comentarios]', err.message);
    res.status(500).json({ error: 'Error al obtener comentarios' });
  }
});

// POST /api/modulos/:id/comentarios
// Body: { texto, parent_id? }
// Si es comentario raíz (sin parent_id), notifica al profesor del curso.
router.post('/:id/comentarios', verificarToken, async (req, res) => {
  const moduloId = parseInt(req.params.id);
  const { texto, parent_id = null } = req.body;
  const usuarioId = req.usuario.id;

  if (!texto || !texto.trim()) {
    return res.status(400).json({ error: 'El texto no puede estar vacío' });
  }

  try {
    // Verificar que el módulo existe y obtener profesor del curso
    const { rows: modRows } = await pool.query(
      `SELECT m.id, m.titulo, c.id AS curso_id, c.nombre AS curso_nombre,
              c.profesor_id, u.nombre AS profesor_nombre
       FROM   modulos m
       JOIN   cursos  c ON c.id = m.curso_id
       LEFT   JOIN usuarios u ON u.id = c.profesor_id
       WHERE  m.id = $1`,
      [moduloId]
    );
    if (!modRows.length) return res.status(404).json({ error: 'Módulo no encontrado' });
    const modulo = modRows[0];

    const ins = await pool.query(
      `INSERT INTO comentarios_modulo (modulo_id, usuario_id, parent_id, texto)
       VALUES ($1, $2, $3, $4)`,
      [moduloId, usuarioId, parent_id ?? null, texto.trim()]
    );
    const nuevoId = ins.lastID;

    // Notificar al profesor solo en comentarios raíz
    if (!parent_id && modulo.profesor_id && modulo.profesor_id !== usuarioId) {
      const { rows: autorRows } = await pool.query(
        'SELECT nombre FROM usuarios WHERE id = $1',
        [usuarioId]
      );
      const autorNombre = autorRows[0]?.nombre || 'Un colaborador';
      await notificar(modulo.profesor_id, {
        tipo: 'comentario_modulo',
        entidad: 'modulo',
        entidad_id: moduloId,
        titulo: `Nuevo comentario en "${modulo.titulo}"`,
        mensaje: `${autorNombre} dejó un comentario en el módulo "${modulo.titulo}" del curso "${modulo.curso_nombre}".`
      });
    }

    // Devolver el comentario recién insertado con nombre del autor
    const { rows: nuevo } = await pool.query(
      `SELECT c.id, c.modulo_id, c.usuario_id, c.parent_id, c.texto, c.creado_en,
              u.nombre AS autor_nombre
       FROM   comentarios_modulo c
       JOIN   usuarios u ON u.id = c.usuario_id
       WHERE  c.id = $1`,
      [nuevoId]
    );
    res.status(201).json(nuevo[0]);
  } catch (err) {
    console.error('[POST comentario]', err.message);
    res.status(500).json({ error: 'Error al guardar comentario' });
  }
});

module.exports = router;
