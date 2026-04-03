const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { verificarToken, verificarRol } = require('../middleware/auth');

const SOLO_ADMIN = verificarRol('admin_sede', 'jefatura');

// GET /api/usuarios — listar usuarios
router.get('/', verificarToken, SOLO_ADMIN, async (req, res) => {
  const { rol, sede_id } = req.usuario;
  const { sede_id: sedeQuery } = req.query;
  try {
    let query = `SELECT u.id, u.nombre, u.identificador, u.rol, u.tipo_contrato,
      u.activo, u.sede_id, s.nombre as sede_nombre, u.created_at
      FROM usuarios u LEFT JOIN sedes s ON u.sede_id = s.id WHERE 1=1`;
    const params = [];
    if (rol === 'admin_sede') {
      query += ' AND u.sede_id = ?'; params.push(sede_id);
    } else if (sedeQuery) {
      query += ' AND u.sede_id = ?'; params.push(parseInt(sedeQuery));
    }
    query += ' ORDER BY u.nombre';
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// POST /api/usuarios — crear usuario (jefatura define la contraseña)
router.post('/', verificarToken, SOLO_ADMIN, async (req, res) => {
  const { nombre, identificador, password, rol, tipo_contrato, sede_id } = req.body;
  if (!nombre || !identificador || !password || !rol) {
    return res.status(400).json({ error: 'Nombre, identificador, contraseña y rol son requeridos' });
  }
  const rolesValidos = ['colaborador', 'profesor', 'admin_sede', 'jefatura'];
  if (!rolesValidos.includes(rol)) {
    return res.status(400).json({ error: 'Rol no válido' });
  }
  const sedeAsignada = req.usuario.rol === 'admin_sede' ? req.usuario.sede_id : (sede_id || null);
  try {
    const { rows: existe } = await pool.query('SELECT id FROM usuarios WHERE identificador = ?', [identificador]);
    if (existe.length > 0) return res.status(409).json({ error: 'El identificador ya está en uso' });
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      'INSERT INTO usuarios (nombre, identificador, password_hash, rol, tipo_contrato, sede_id) VALUES (?, ?, ?, ?, ?, ?)',
      [nombre, identificador, hash, rol, tipo_contrato || null, sedeAsignada]
    );
    // Recuperar usuario creado
    const { rows: nuevo } = await pool.query(
      'SELECT id, nombre, identificador, rol, tipo_contrato, sede_id, activo, created_at FROM usuarios WHERE identificador = ?',
      [identificador]
    );
    res.status(201).json(nuevo[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

// PATCH /api/usuarios/:id — editar usuario
router.patch('/:id', verificarToken, SOLO_ADMIN, async (req, res) => {
  const { id } = req.params;
  const { nombre, tipo_contrato, sede_id } = req.body;
  try {
    await pool.query(
      'UPDATE usuarios SET nombre = COALESCE(?, nombre), tipo_contrato = COALESCE(?, tipo_contrato), sede_id = COALESCE(?, sede_id), updated_at = NOW() WHERE id = ?',
      [nombre || null, tipo_contrato || null, sede_id || null, id]
    );
    const { rows } = await pool.query('SELECT id, nombre, identificador, rol, tipo_contrato, sede_id, activo FROM usuarios WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

// DELETE /api/usuarios/:id — soft delete (solo jefatura, sin contraseña)
router.delete('/:id', verificarToken, verificarRol('jefatura'), async (req, res) => {
  const { id } = req.params;
  if (parseInt(id) === req.usuario.id) {
    return res.status(400).json({ error: 'No puedes desactivar tu propia cuenta' });
  }
  try {
    const { rows } = await pool.query('SELECT id, nombre FROM usuarios WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    await pool.query('UPDATE usuarios SET activo = 0, updated_at = NOW() WHERE id = ?', [id]);
    res.json({ message: `Usuario ${rows[0].nombre} desactivado correctamente. Su historial se mantiene.` });
  } catch (err) {
    res.status(500).json({ error: 'Error al desactivar usuario' });
  }
});

// PATCH /api/usuarios/:id/reactivar — reactivar usuario (solo jefatura)
router.patch('/:id/reactivar', verificarToken, verificarRol('jefatura'), async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('UPDATE usuarios SET activo = 1, updated_at = NOW() WHERE id = ?', [id]);
    res.json({ message: 'Usuario reactivado correctamente' });
  } catch (err) {
    res.status(500).json({ error: 'Error al reactivar usuario' });
  }
});

// GET /api/usuarios/sedes — listar sedes (para el formulario de creación)
router.get('/sedes', verificarToken, SOLO_ADMIN, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, nombre, ciudad FROM sedes WHERE activa = 1 ORDER BY nombre');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener sedes' });
  }
});

module.exports = router;
