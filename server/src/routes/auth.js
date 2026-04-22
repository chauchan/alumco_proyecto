const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { verificarToken } = require('../middleware/auth');

const SELECT_USUARIO = `
  SELECT u.id, u.nombre, u.identificador, u.rol, u.tipo_contrato,
         e.nombre AS estamento, u.estamento_id, u.sede_id, u.email,
         u.telefono, u.rut, u.rango_etario, u.activo, u.ultimo_acceso,
         s.nombre AS sede_nombre
  FROM usuarios u
  LEFT JOIN sedes     s ON u.sede_id      = s.id
  LEFT JOIN estamentos e ON u.estamento_id = e.id
`;

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { identificador, password } = req.body;
  if (!identificador || !password)
    return res.status(400).json({ error: 'Identificador y contraseña son requeridos' });

  try {
    const { rows } = await pool.query(
      `${SELECT_USUARIO} WHERE u.identificador = ? AND u.activo = 1`,
      [identificador]
    );
    if (!rows.length) return res.status(401).json({ error: 'Credenciales incorrectas' });

    const usuario = rows[0];
    const ok = await bcrypt.compare(password, usuario.password_hash || '');

    // Releer password_hash si no vino en la proyección
    if (!ok) {
      const { rows: h } = await pool.query('SELECT password_hash FROM usuarios WHERE id = ?', [usuario.id]);
      const ok2 = await bcrypt.compare(password, h[0]?.password_hash || '');
      if (!ok2) return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    await pool.query('UPDATE usuarios SET ultimo_acceso = NOW() WHERE id = ?', [usuario.id]);

    const token = jwt.sign(
      {
        id:            usuario.id,
        nombre:        usuario.nombre,
        rol:           usuario.rol,
        sede_id:       usuario.sede_id,
        sede_nombre:   usuario.sede_nombre,
        identificador: usuario.identificador,
        tipo_contrato: usuario.tipo_contrato,
        estamento:     usuario.estamento,
        estamento_id:  usuario.estamento_id,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      token,
      usuario: {
        id:            usuario.id,
        nombre:        usuario.nombre,
        rol:           usuario.rol,
        sede_id:       usuario.sede_id,
        sede_nombre:   usuario.sede_nombre,
        identificador: usuario.identificador,
        tipo_contrato: usuario.tipo_contrato,
        estamento:     usuario.estamento,
        estamento_id:  usuario.estamento_id,
        email:         usuario.email,
        telefono:      usuario.telefono,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// GET /api/auth/me
router.get('/me', verificarToken, async (req, res) => {
  try {
    const { rows } = await pool.query(`${SELECT_USUARIO} WHERE u.id = ?`, [req.usuario.id]);
    if (!rows.length) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener perfil' });
  }
});

// POST /api/auth/cambiar-password
router.post('/cambiar-password', verificarToken, async (req, res) => {
  const { password_actual, password_nueva } = req.body;
  if (!password_actual || !password_nueva)
    return res.status(400).json({ error: 'Contraseña actual y nueva son requeridas' });
  if (password_nueva.length < 6)
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });

  try {
    const { rows } = await pool.query('SELECT password_hash FROM usuarios WHERE id = ?', [req.usuario.id]);
    if (!rows.length) return res.status(404).json({ error: 'Usuario no encontrado' });
    const ok = await bcrypt.compare(password_actual, rows[0].password_hash);
    if (!ok) return res.status(401).json({ error: 'La contraseña actual es incorrecta' });

    const hash = await bcrypt.hash(password_nueva, 10);
    await pool.query('UPDATE usuarios SET password_hash = ?, updated_at = NOW() WHERE id = ?', [hash, req.usuario.id]);
    res.json({ message: 'Contraseña actualizada correctamente' });
  } catch (err) {
    res.status(500).json({ error: 'Error al cambiar contraseña' });
  }
});

// PATCH /api/auth/mis-datos
router.patch('/mis-datos', verificarToken, async (req, res) => {
  const { email, telefono } = req.body;
  try {
    await pool.query(
      'UPDATE usuarios SET email = ?, telefono = ?, updated_at = NOW() WHERE id = ?',
      [email || null, telefono || null, req.usuario.id]
    );
    const { rows } = await pool.query(`${SELECT_USUARIO} WHERE u.id = ?`, [req.usuario.id]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar datos' });
  }
});

module.exports = router;
