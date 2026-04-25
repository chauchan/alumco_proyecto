const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../config/db');
const { verificarToken } = require('../middleware/auth');
const { enviarResetPassword } = require('../config/mailer');
const { auditar } = require('../utils/audit');

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

// POST /api/auth/forgot-password — siempre 200, nunca revela si el email existe
router.post('/forgot-password', async (req, res) => {
  res.json({ message: 'Si el email está registrado, recibirás instrucciones en tu correo.' });

  const { email } = req.body || {};
  if (!email) return;

  try {
    const { rows } = await pool.query(
      'SELECT id, nombre, email FROM usuarios WHERE email = $1 AND activo = 1',
      [email.trim()]
    );
    if (!rows.length || !rows[0].email) return;

    const usuario = rows[0];
    const token = crypto.randomBytes(32).toString('hex');
    const expiraEn = new Date(Date.now() + 30 * 60 * 1000);

    await pool.query(
      'INSERT INTO password_resets (usuario_id, token, expira_en) VALUES ($1, $2, $3)',
      [usuario.id, token, expiraEn]
    );

    const link = `${process.env.CLIENT_URL || 'http://localhost:5173'}/reset-password/${token}`;
    await enviarResetPassword(usuario.email, link, usuario.nombre);
  } catch (err) {
    console.error('[forgot-password]', err.message);
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  const { token, nueva_password } = req.body || {};
  if (!token || !nueva_password)
    return res.status(400).json({ error: 'Token y nueva contraseña son requeridos' });
  if (nueva_password.length < 6)
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });

  try {
    const { rows } = await pool.query(
      `SELECT pr.id, pr.usuario_id
       FROM password_resets pr
       WHERE pr.token = $1 AND pr.usado = 0 AND pr.expira_en > NOW()`,
      [token]
    );
    if (!rows.length)
      return res.status(400).json({ error: 'El enlace es inválido o ha expirado' });

    const { id: resetId, usuario_id } = rows[0];
    const hash = await bcrypt.hash(nueva_password, 10);

    await pool.query(
      'UPDATE usuarios SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [hash, usuario_id]
    );
    await pool.query(
      'UPDATE password_resets SET usado = 1 WHERE id = $1',
      [resetId]
    );
    await auditar({ usuario: { id: usuario_id } }, 'auth.reset_password', 'usuario', usuario_id, {});

    res.json({ message: 'Contraseña actualizada correctamente' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al restablecer contraseña' });
  }
});

// POST /api/auth/renovar — renueva JWT vigente por 7 días más
router.post('/renovar', verificarToken, async (req, res) => {
  try {
    const { id, nombre, rol, sede_id, sede_nombre, identificador, tipo_contrato, estamento, estamento_id } = req.usuario;
    const token = jwt.sign(
      { id, nombre, rol, sede_id, sede_nombre, identificador, tipo_contrato, estamento, estamento_id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: 'Error al renovar sesión' });
  }
});

module.exports = router;
