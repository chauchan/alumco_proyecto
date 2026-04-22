const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { verificarToken, verificarRol } = require('../middleware/auth');

const SOLO_ADMIN = verificarRol('admin_sede', 'jefatura');

// Resuelve el nombre de estamento a su id (inserta si no existe)
async function resolveEstamentoId(nombre) {
  if (!nombre) return null;
  const { rows } = await pool.query('SELECT id FROM estamentos WHERE nombre = ?', [nombre]);
  if (rows.length) return rows[0].id;
  const ins = await pool.query('INSERT INTO estamentos (nombre) VALUES (?)', [nombre]);
  return ins.lastID;
}

// GET /api/usuarios
router.get('/', verificarToken, SOLO_ADMIN, async (req, res) => {
  const { rol, sede_id } = req.usuario;
  const { sede_id: sedeQuery } = req.query;
  try {
    let query = `
      SELECT u.id, u.nombre, u.identificador, u.rol, u.tipo_contrato,
             e.nombre AS estamento, u.estamento_id, u.activo,
             u.sede_id, s.nombre AS sede_nombre, u.created_at
      FROM usuarios u
      LEFT JOIN sedes      s ON u.sede_id      = s.id
      LEFT JOIN estamentos e ON u.estamento_id = e.id
      WHERE 1=1
    `;
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

// POST /api/usuarios
router.post('/', verificarToken, SOLO_ADMIN, async (req, res) => {
  const { nombre, rut, correo, password, rol, tipo_contrato, sede_id, estamento } = req.body;
  if (!nombre || !rut || !password || !rol)
    return res.status(400).json({ error: 'Nombre, RUT, contraseña y rol son requeridos' });

  const rolesValidos = ['colaborador', 'profesor', 'admin_sede', 'jefatura'];
  if (!rolesValidos.includes(rol))
    return res.status(400).json({ error: 'Rol no válido' });

  const identificador = rut.replace(/\./g, '').replace(/-/g, '');
  const sedeAsignada = req.usuario.rol === 'admin_sede' ? req.usuario.sede_id : (sede_id || null);

  try {
    const { rows: existe } = await pool.query('SELECT id FROM usuarios WHERE identificador = ?', [identificador]);
    if (existe.length) return res.status(409).json({ error: 'El RUT ya está registrado' });

    const estamento_id = await resolveEstamentoId(estamento);
    const hash = await bcrypt.hash(password, 10);

    await pool.query(
      `INSERT INTO usuarios (nombre, identificador, rut, email, password_hash, rol, tipo_contrato, sede_id, estamento_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [nombre, identificador, rut, correo || null, hash, rol, tipo_contrato || null, sedeAsignada, estamento_id]
    );

    const { rows } = await pool.query(
      `SELECT u.id, u.nombre, u.identificador, u.rut, u.email, u.rol,
              u.tipo_contrato, u.sede_id, e.nombre AS estamento, u.activo, u.created_at
       FROM usuarios u
       LEFT JOIN estamentos e ON u.estamento_id = e.id
       WHERE u.identificador = ?`,
      [identificador]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

// PATCH /api/usuarios/:id
router.patch('/:id', verificarToken, SOLO_ADMIN, async (req, res) => {
  const { id } = req.params;
  const { nombre, tipo_contrato, sede_id, activo, estamento } = req.body;
  try {
    const sets = [];
    const params = [];

    if (nombre !== undefined)        { sets.push('nombre = ?');        params.push(nombre); }
    if (tipo_contrato !== undefined) { sets.push('tipo_contrato = ?'); params.push(tipo_contrato); }
    if (sede_id !== undefined)       { sets.push('sede_id = ?');       params.push(sede_id); }
    if (activo !== undefined)        { sets.push('activo = ?');        params.push(activo ? 1 : 0); }
    if (estamento !== undefined) {
      const estamento_id = await resolveEstamentoId(estamento);
      sets.push('estamento_id = ?');
      params.push(estamento_id);
    }

    if (!sets.length) return res.status(400).json({ error: 'Nada que actualizar' });

    sets.push('updated_at = NOW()');
    params.push(id);
    await pool.query(`UPDATE usuarios SET ${sets.join(', ')} WHERE id = ?`, params);

    const { rows } = await pool.query(
      `SELECT u.id, u.nombre, u.identificador, u.rol, u.tipo_contrato,
              e.nombre AS estamento, u.estamento_id, u.sede_id, u.activo
       FROM usuarios u
       LEFT JOIN estamentos e ON u.estamento_id = e.id
       WHERE u.id = ?`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

// DELETE /api/usuarios/:id
router.delete('/:id', verificarToken, verificarRol('jefatura'), async (req, res) => {
  try {
    await pool.query('UPDATE usuarios SET activo = 0 WHERE id = ?', [req.params.id]);
    res.json({ message: 'Usuario desactivado' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
});

module.exports = router;
