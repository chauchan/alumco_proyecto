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
    const result = await pool.query(
      'SELECT u.*, s.nombre as sede_nombre FROM usuarios u LEFT JOIN sedes s ON u.sede_id = s.id WHERE u.identificador = $1 AND u.activo = true',
      [identificador.trim()]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }
    const usuario = result.rows[0];
    const passwordValida = await bcrypt.compare(password, usuario.password_hash);
    if (!passwordValida) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }
    const token = jwt.sign(
      { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol, sede_id: usuario.sede_id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
    const { password_hash, ...usuarioSinPassword } = usuario;
    res.json({ token, usuario: usuarioSinPassword });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

// GET /api/auth/me — obtener perfil del usuario autenticado
router.get('/me', verificarToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT u.id, u.nombre, u.identificador, u.rol, u.tipo_contrato, u.sede_id, s.nombre as sede_nombre FROM usuarios u LEFT JOIN sedes s ON u.sede_id = s.id WHERE u.id = $1',
      [req.usuario.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener perfil' });
  }
});

// POST /api/auth/cambiar-password
router.post('/cambiar-password', verificarToken, async (req, res) => {
  const { password_actual, password_nueva } = req.body;
  if (!password_actual || !password_nueva) {
    return res.status(400).json({ error: 'Ambas contraseñas son requeridas' });
  }
  if (password_nueva.length < 6) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
  }
  try {
    const result = await pool.query('SELECT password_hash FROM usuarios WHERE id = $1', [req.usuario.id]);
    const valida = await bcrypt.compare(password_actual, result.rows[0].password_hash);
    if (!valida) return res.status(401).json({ error: 'Contraseña actual incorrecta' });
    const nuevo_hash = await bcrypt.hash(password_nueva, 10);
    await pool.query('UPDATE usuarios SET password_hash = $1, updated_at = NOW() WHERE id = $2', [nuevo_hash, req.usuario.id]);
    res.json({ message: 'Contraseña actualizada correctamente' });
  } catch (err) {
    res.status(500).json({ error: 'Error al cambiar contraseña' });
  }
});

module.exports = router;
