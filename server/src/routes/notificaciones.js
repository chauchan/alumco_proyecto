const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verificarToken } = require('../middleware/auth');

// GET /api/notificaciones — obtener notificaciones del usuario
router.get('/', verificarToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT n.*, p.fecha, p.hora_inicio, p.lugar
       FROM notificaciones n
       LEFT JOIN practicos p ON n.practico_id = p.id
       WHERE n.usuario_id = ?
       ORDER BY n.created_at DESC
       LIMIT 20`,
      [req.usuario.id]
    );
    const noLeidas = result.rows.filter(n => !n.leida).length;
    res.json({ notificaciones: result.rows, no_leidas: noLeidas });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener notificaciones' });
  }
});

// PATCH /api/notificaciones/leer-todas — marcar todas como leídas
router.patch('/leer-todas', verificarToken, async (req, res) => {
  try {
    await pool.query(
      'UPDATE notificaciones SET leida = 1 WHERE usuario_id = ?',
      [req.usuario.id]
    );
    res.json({ message: 'Notificaciones marcadas como leídas' });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar notificaciones' });
  }
});

// PATCH /api/notificaciones/:id/leer — marcar una como leída
router.patch('/:id/leer', verificarToken, async (req, res) => {
  try {
    await pool.query(
      'UPDATE notificaciones SET leida = 1 WHERE id = ? AND usuario_id = ?',
      [req.params.id, req.usuario.id]
    );
    res.json({ message: 'Notificación leída' });
  } catch (err) {
    res.status(500).json({ error: 'Error al marcar notificación' });
  }
});

module.exports = router;
