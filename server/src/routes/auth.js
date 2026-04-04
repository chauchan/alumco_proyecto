const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { verificarToken } = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { identificador, password } = req.body;
  if (!identificador || !password) {
    return res.status(400).json({ error: 'Identificador y contraseña son requeridos' });
  }
  try {
    const { rows } = await pool.query(
      `SELECT u.*, s.nombre as sede_nombre
       FROM usuarios u
       LEFT JOIN sedes s ON u.sede_id = s.id
       WHERE u.identificador = ? AND u.activo = 1`,
      [identificador]
    );
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }
    const usuario = rows[0];
    const ok = await bcrypt.compare(password, usuario.password_hash);
    if (!ok) return res.status(401).json({ error: 'Credenciales incorrectas' });

    const token = jwt.sign(
      {
        id: usuario.id,
        nombre: usuario.nombre,
        rol: usuario.rol,
        sede_id: usuario.sede_id,
        sede_nombre: usuario.sede_nombre,
        identificador: usuario.identificador,
        tipo_contrato: usuario.tipo_contrato,
        estamento: usuario.estamento,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
    res.json({ token, usuario: {
      id: usuario.id,
      nombre: usuario.nombre,
      rol: usuario.rol,
      sede_id: usuario.sede_id,
      sede_nombre: usuario.sede_nombre,
      identificador: usuario.identificador,
      tipo_contrato: usuario.tipo_contrato,
      estamento: usuario.estamento,
      email: usuario.email,
      telefono: usuario.telefono,
    }});
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// GET /api/auth/me — perfil del usuario actual
router.get('/me', verificarToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.nombre, u.identificador, u.rol, u.tipo_contrato,
              u.estamento, u.sede_id, u.email, u.telefono, u.activo,
              s.nombre as sede_nombre
       FROM usuarios u
       LEFT JOIN sedes s ON u.sede_id = s.id
       WHERE u.id = ?`,
      [req.usuario.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener perfil' });
  }
});

// POST /api/auth/cambiar-password
router.post('/cambiar-password', verificarToken, async (req, res) => {
  const { password_actual, password_nueva } = req.body;
  if (!password_actual || !password_nueva) {
    return res.status(400).json({ error: 'Contraseña actual y nueva son requeridas' });
  }
  if (password_nueva.length < 6) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
  }
  try {
    const { rows } = await pool.query(
      'SELECT password_hash FROM usuarios WHERE id = ?',
      [req.usuario.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });

    const ok = await bcrypt.compare(password_actual, rows[0].password_hash);
    if (!ok) return res.status(401).json({ error: 'La contraseña actual es incorrecta' });

    const hash = await bcrypt.hash(password_nueva, 10);
    await pool.query(
      'UPDATE usuarios SET password_hash = ?, updated_at = NOW() WHERE id = ?',
      [hash, req.usuario.id]
    );
    res.json({ message: 'Contraseña actualizada correctamente' });
  } catch (err) {
    res.status(500).json({ error: 'Error al cambiar contraseña' });
  }
});

// PATCH /api/auth/mis-datos — actualizar email y teléfono
router.patch('/mis-datos', verificarToken, async (req, res) => {
  const { email, telefono } = req.body;
  try {
    await pool.query(
      'UPDATE usuarios SET email = ?, telefono = ?, updated_at = NOW() WHERE id = ?',
      [email || null, telefono || null, req.usuario.id]
    );
    const { rows } = await pool.query(
      'SELECT id, nombre, identificador, rol, email, telefono, sede_id FROM usuarios WHERE id = ?',
      [req.usuario.id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar datos' });
  }
});

module.exports = router;
