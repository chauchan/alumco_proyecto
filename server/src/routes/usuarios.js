const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { verificarToken, verificarRol } = require('../middleware/auth');
const { auditar } = require('../utils/audit');

const SOLO_ADMIN = verificarRol('admin_sede', 'jefatura');

async function resolveEstamentoId(nombre) {
  if (!nombre) return null;
  const { rows } = await pool.query('SELECT id FROM estamentos WHERE nombre = ?', [nombre]);
  if (rows.length) return rows[0].id;
  const ins = await pool.query('INSERT INTO estamentos (nombre) VALUES (?)', [nombre]);
  return ins.lastID;
}

// GET /api/usuarios/estamentos
router.get('/estamentos', verificarToken, SOLO_ADMIN, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, nombre FROM estamentos ORDER BY nombre');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener estamentos' });
  }
});

// GET /api/usuarios
// Con ?page&limit → devuelve { rows, total, page, limit } (paginado)
// Sin ?page       → devuelve array plano (compatible con consumidores existentes)
router.get('/', verificarToken, SOLO_ADMIN, async (req, res) => {
  const { rol, sede_id } = req.usuario;
  const { sede_id: sedeQuery, tipo_contrato, q, rol: rolQuery, page, limit } = req.query;
  try {
    let where = 'WHERE 1=1';
    const params = [];

    if (rol === 'admin_sede') {
      where += ' AND u.sede_id = ?'; params.push(sede_id);
    } else if (sedeQuery) {
      where += ' AND u.sede_id = ?'; params.push(parseInt(sedeQuery));
    }
    if (tipo_contrato) {
      where += ' AND u.tipo_contrato = ?'; params.push(tipo_contrato);
    }
    if (q) {
      where += ' AND (u.nombre LIKE ? OR u.identificador LIKE ?)';
      params.push(`%${q}%`, `%${q}%`);
    }
    if (rolQuery) {
      where += ' AND u.rol = ?'; params.push(rolQuery);
    }

    const selectCols = `
      SELECT u.id, u.nombre, u.identificador, u.rol, u.tipo_contrato,
             e.nombre AS estamento, u.estamento_id, u.activo,
             u.sede_id, s.nombre AS sede_nombre, u.created_at
      FROM usuarios u
      LEFT JOIN sedes      s ON u.sede_id      = s.id
      LEFT JOIN estamentos e ON u.estamento_id = e.id
    `;

    if (page !== undefined) {
      const pageNum = Math.max(1, parseInt(page) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
      const offset = (pageNum - 1) * limitNum;

      const { rows: countRows } = await pool.query(
        `SELECT COUNT(*) AS total FROM usuarios u ${where}`, params
      );
      const total = countRows[0].total;

      const { rows } = await pool.query(
        `${selectCols} ${where} ORDER BY u.nombre LIMIT ? OFFSET ?`,
        [...params, limitNum, offset]
      );
      return res.json({ rows, total, page: pageNum, limit: limitNum });
    }

    const { rows } = await pool.query(`${selectCols} ${where} ORDER BY u.nombre`, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// POST /api/usuarios/desactivar-bulk
router.post('/desactivar-bulk', verificarToken, SOLO_ADMIN, async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || !ids.length)
    return res.status(400).json({ error: 'ids requerido' });

  const { rol, sede_id } = req.usuario;
  try {
    let idsPermitidos = ids;
    if (rol === 'admin_sede') {
      const ph = ids.map((_, i) => `$${i + 1}`).join(',');
      const { rows } = await pool.query(
        `SELECT id FROM usuarios WHERE id IN (${ph}) AND sede_id = $${ids.length + 1}`,
        [...ids, sede_id]
      );
      idsPermitidos = rows.map(r => r.id);
    }
    if (!idsPermitidos.length) return res.json({ desactivados: 0, ignorados: ids.length });

    const ph2 = idsPermitidos.map((_, i) => `$${i + 1}`).join(',');
    const { rowCount } = await pool.query(
      `UPDATE usuarios SET activo = 0, updated_at = NOW() WHERE id IN (${ph2}) AND activo = 1`,
      idsPermitidos
    );
    await auditar(req, 'usuario.desactivacion_bulk', 'usuarios', null, { ids: idsPermitidos, desactivados: rowCount });
    res.json({ desactivados: rowCount, ignorados: ids.length - idsPermitidos.length });
  } catch (err) {
    console.error('[desactivar-bulk]', err.message);
    res.status(500).json({ error: 'Error al desactivar usuarios' });
  }
});

// POST /api/usuarios/reactivar-bulk
router.post('/reactivar-bulk', verificarToken, SOLO_ADMIN, async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || !ids.length)
    return res.status(400).json({ error: 'ids requerido' });

  const { rol, sede_id } = req.usuario;
  try {
    let idsPermitidos = ids;
    if (rol === 'admin_sede') {
      const ph = ids.map((_, i) => `$${i + 1}`).join(',');
      const { rows } = await pool.query(
        `SELECT id FROM usuarios WHERE id IN (${ph}) AND sede_id = $${ids.length + 1}`,
        [...ids, sede_id]
      );
      idsPermitidos = rows.map(r => r.id);
    }
    if (!idsPermitidos.length) return res.json({ reactivados: 0, ignorados: ids.length });

    const ph2 = idsPermitidos.map((_, i) => `$${i + 1}`).join(',');
    const { rowCount } = await pool.query(
      `UPDATE usuarios SET activo = 1, updated_at = NOW() WHERE id IN (${ph2}) AND activo = 0`,
      idsPermitidos
    );
    await auditar(req, 'usuario.reactivacion_bulk', 'usuarios', null, { ids: idsPermitidos, reactivados: rowCount });
    res.json({ reactivados: rowCount, ignorados: ids.length - idsPermitidos.length });
  } catch (err) {
    console.error('[reactivar-bulk]', err.message);
    res.status(500).json({ error: 'Error al reactivar usuarios' });
  }
});

// POST /api/usuarios/bulk — importación masiva desde XLSX
router.post('/bulk', verificarToken, SOLO_ADMIN, async (req, res) => {
  const filas = req.body.rows;
  if (!Array.isArray(filas) || !filas.length)
    return res.status(400).json({ error: 'Sin filas para importar' });

  const { rol: rolAdmin, sede_id: sedeAdmin } = req.usuario;
  const rolesValidos = ['colaborador', 'profesor', 'admin_sede', 'jefatura'];
  const creados = [];
  const errores = [];

  const { rows: sedesDB } = await pool.query('SELECT id, nombre FROM sedes');
  const sedeMap = {};
  for (const s of sedesDB) sedeMap[s.nombre.trim().toLowerCase()] = s.id;

  for (let i = 0; i < filas.length; i++) {
    const fila = filas[i];
    const numFila = i + 2;

    if (!fila.nombre?.toString().trim()) { errores.push({ fila: numFila, motivo: 'Nombre requerido' }); continue; }
    if (!fila.rut?.toString().trim())    { errores.push({ fila: numFila, motivo: 'RUT requerido' }); continue; }

    const identificador = String(fila.rut).replace(/\./g, '').replace(/-/g, '');
    const rolFila = fila.rol?.toString().trim() || 'colaborador';
    if (!rolesValidos.includes(rolFila)) { errores.push({ fila: numFila, motivo: `Rol inválido: ${rolFila}` }); continue; }

    let sedeId = null;
    if (rolAdmin === 'admin_sede') {
      sedeId = sedeAdmin;
    } else if (fila.sede?.toString().trim()) {
      sedeId = sedeMap[fila.sede.toString().trim().toLowerCase()] ?? null;
      if (!sedeId) { errores.push({ fila: numFila, motivo: `Sede no encontrada: ${fila.sede}` }); continue; }
    }

    try {
      const { rows: existe } = await pool.query('SELECT id FROM usuarios WHERE identificador = ?', [identificador]);
      if (existe.length) { errores.push({ fila: numFila, motivo: `RUT ya registrado: ${fila.rut}` }); continue; }

      const estamento_id = await resolveEstamentoId(fila.estamento?.toString().trim() || null);
      const hash = await bcrypt.hash('alumco2026', 10);

      await pool.query(
        `INSERT INTO usuarios (nombre, identificador, rut, email, password_hash, rol, tipo_contrato, sede_id, estamento_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          fila.nombre.toString().trim(), identificador, fila.rut.toString().trim(),
          fila.correo?.toString().trim() || null, hash, rolFila,
          fila.tipo_contrato?.toString().trim() || null, sedeId, estamento_id
        ]
      );
      creados.push(identificador);
    } catch (err) {
      errores.push({ fila: numFila, motivo: err.message });
    }
  }

  await auditar(req, 'usuario.bulk_import', 'usuarios', null, { creados: creados.length, errores: errores.length });
  res.json({ creados: creados.length, errores });
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
