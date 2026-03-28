const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { verificarToken, verificarRol, verificarSede } = require('../middleware/auth');

const SOLO_ADMIN = verificarRol('admin_sede', 'jefatura');

// GET /api/usuarios — listar colaboradores de la sede
router.get('/', verificarToken, SOLO_ADMIN, verificarSede, async (req, res) => {
  const { sede_id, rol } = req.usuario;
  const { sede_id: sedeQuery } = req.query;
  try {
    let query = 'SELECT u.id, u.nombre, u.identificador, u.rol, u.tipo_contrato, u.activo, u.sede_id, s.nombre as sede_nombre, u.created_at FROM usuarios u LEFT JOIN sedes s ON u.sede_id = s.id WHERE 1=1';
    const params = [];
    if (rol === 'admin_sede') {
      params.push(sede_id);
      query += ` AND u.sede_id = $${params.length}`;
    } else if (sedeQuery) {
      params.push(parseInt(sedeQuery));
      query += ` AND u.sede_id = $${params.length}`;
    }
    query += ' ORDER BY u.nombre';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// POST /api/usuarios — crear nuevo usuario
router.post('/', verificarToken, SOLO_ADMIN, async (req, res) => {
  const { nombre, identificador, password, rol, tipo_contrato, sede_id } = req.body;
  if (!nombre || !identificador || !password || !rol) {
    return res.status(400).json({ error: 'Nombre, identificador, contraseña y rol son requeridos' });
  }
  const rolesValidos = ['colaborador', 'profesor', 'admin_sede', 'jefatura'];
  if (!rolesValidos.includes(rol)) {
    return res.status(400).json({ error: 'Rol no válido' });
  }
  // admin_sede solo puede crear en su propia sede
  const sedeAsignada = req.usuario.rol === 'admin_sede' ? req.usuario.sede_id : sede_id;
  try {
    const existe = await pool.query('SELECT id FROM usuarios WHERE identificador = $1', [identificador]);
    if (existe.rows.length > 0) return res.status(409).json({ error: 'El identificador ya está en uso' });
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO usuarios (nombre, identificador, password_hash, rol, tipo_contrato, sede_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, nombre, identificador, rol, tipo_contrato, sede_id, activo, created_at',
      [nombre, identificador, hash, rol, tipo_contrato || null, sedeAsignada || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

// PATCH /api/usuarios/:id — editar usuario
router.patch('/:id', verificarToken, SOLO_ADMIN, async (req, res) => {
  const { id } = req.params;
  const { nombre, tipo_contrato, activo, sede_id } = req.body;
  try {
    const result = await pool.query(
      'UPDATE usuarios SET nombre = COALESCE($1, nombre), tipo_contrato = COALESCE($2, tipo_contrato), activo = COALESCE($3, activo), sede_id = COALESCE($4, sede_id), updated_at = NOW() WHERE id = $5 RETURNING id, nombre, tipo_contrato, activo, sede_id',
      [nombre, tipo_contrato, activo, sede_id, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

// DELETE /api/usuarios/:id — dar de baja (soft delete)
router.delete('/:id', verificarToken, SOLO_ADMIN, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('UPDATE usuarios SET activo = false, updated_at = NOW() WHERE id = $1', [id]);
    res.json({ message: 'Usuario dado de baja correctamente' });
  } catch (err) {
    res.status(500).json({ error: 'Error al dar de baja usuario' });
  }
});

module.exports = router;
