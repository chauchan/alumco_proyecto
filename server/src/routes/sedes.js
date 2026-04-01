const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verificarToken } = require('../middleware/auth');

// GET /api/sedes — listar todas las sedes
router.get('/', verificarToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, nombre, ciudad, activa FROM sedes ORDER BY nombre');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener sedes' });
  }
});

module.exports = router;
