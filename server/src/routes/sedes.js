const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verificarToken, verificarRol } = require('../middleware/auth');
const { auditar } = require('../utils/audit');

const SOLO_JEFATURA = verificarRol('jefatura');

// GET /api/sedes — listar sedes con conteo de usuarios activos
router.get('/', verificarToken, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT s.id, s.nombre, s.ciudad, s.activa,
        COUNT(CASE WHEN u.activo = 1 THEN u.id END) AS usuarios_activos
      FROM sedes s
      LEFT JOIN usuarios u ON u.sede_id = s.id
      GROUP BY s.id, s.nombre, s.ciudad, s.activa
      ORDER BY s.nombre
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener sedes' });
  }
});

// POST /api/sedes
router.post('/', verificarToken, SOLO_JEFATURA, async (req, res) => {
  const { nombre, ciudad } = req.body;
  if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre es requerido' });
  try {
    const { rows: existe } = await pool.query(
      'SELECT id FROM sedes WHERE nombre = ?', [nombre.trim()]
    );
    if (existe.length) return res.status(409).json({ error: 'Ya existe una sede con ese nombre' });

    const { lastID } = await pool.query(
      'INSERT INTO sedes (nombre, ciudad) VALUES ($1, $2)',
      [nombre.trim(), ciudad?.trim() || null]
    );
    const { rows } = await pool.query(
      'SELECT id, nombre, ciudad, activa FROM sedes WHERE id = ?', [lastID]
    );
    await auditar(req, 'sede.crear', 'sedes', lastID, { nombre: nombre.trim(), ciudad: ciudad?.trim() || null });
    res.status(201).json({ ...rows[0], usuarios_activos: 0 });
  } catch (err) {
    console.error('[sedes/post]', err.message);
    res.status(500).json({ error: 'Error al crear sede' });
  }
});

// PATCH /api/sedes/:id — editar nombre/ciudad o reactivar (activa: true)
router.patch('/:id', verificarToken, SOLO_JEFATURA, async (req, res) => {
  const { id } = req.params;
  const { nombre, ciudad, activa } = req.body;
  try {
    const sets = [];
    const params = [];
    if (nombre !== undefined) { sets.push('nombre = ?'); params.push(nombre.trim()); }
    if (ciudad !== undefined) { sets.push('ciudad = ?'); params.push(ciudad?.trim() || null); }
    if (activa !== undefined) { sets.push('activa = ?'); params.push(activa ? 1 : 0); }
    if (!sets.length) return res.status(400).json({ error: 'Nada que actualizar' });

    params.push(id);
    await pool.query(`UPDATE sedes SET ${sets.join(', ')} WHERE id = ?`, params);

    const { rows } = await pool.query(
      `SELECT s.id, s.nombre, s.ciudad, s.activa,
         COUNT(CASE WHEN u.activo = 1 THEN u.id END) AS usuarios_activos
       FROM sedes s LEFT JOIN usuarios u ON u.sede_id = s.id
       WHERE s.id = ?
       GROUP BY s.id, s.nombre, s.ciudad, s.activa`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Sede no encontrada' });
    await auditar(req, 'sede.editar', 'sedes', parseInt(id), { nombre, ciudad, activa });
    res.json(rows[0]);
  } catch (err) {
    console.error('[sedes/patch]', err.message);
    res.status(500).json({ error: 'Error al actualizar sede' });
  }
});

// DELETE /api/sedes/:id — soft delete (activa = 0); bloquea si hay usuarios activos
router.delete('/:id', verificarToken, SOLO_JEFATURA, async (req, res) => {
  const { id } = req.params;
  try {
    const { rows: [{ total }] } = await pool.query(
      'SELECT COUNT(*) AS total FROM usuarios WHERE sede_id = ? AND activo = 1', [id]
    );
    const n = parseInt(total);
    if (n > 0) {
      return res.status(409).json({
        error: `No se puede desactivar: la sede tiene ${n} usuario${n !== 1 ? 's' : ''} activo${n !== 1 ? 's' : ''}. Desactivá los usuarios primero.`
      });
    }
    await pool.query('UPDATE sedes SET activa = 0 WHERE id = ?', [id]);
    await auditar(req, 'sede.desactivar', 'sedes', parseInt(id), null);
    res.json({ message: 'Sede desactivada' });
  } catch (err) {
    console.error('[sedes/delete]', err.message);
    res.status(500).json({ error: 'Error al desactivar sede' });
  }
});

module.exports = router;
