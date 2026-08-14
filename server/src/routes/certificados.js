const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verificarToken, verificarRol } = require('../middleware/auth');
const { generarCertificadoPDF, buildCertificadoPDF } = require('../utils/pdfCertificado');
const { parseIdParam } = require('../utils/validate');
const { auditar } = require('../utils/audit');
const { porcentajeANotaChilena } = require('../utils/notaChilena');

// GET /api/certificados — listar certificados del usuario o pendientes para profesor
router.get('/', verificarToken, async (req, res) => {
  const { rol, id, sede_id } = req.usuario;
  try {
    let query, params = [];
    if (rol === 'colaborador') {
      query = `SELECT cert.id, cert.estado, cert.archivo_url, cert.fecha_emision, cert.created_at,
                      c.nombre as curso_nombre, v.nombre as validado_por_nombre
               FROM certificados cert
               JOIN intentos it ON cert.intento_id = it.id
               JOIN cursos c ON it.curso_id = c.id
               LEFT JOIN usuarios v ON cert.validado_por = v.id
               WHERE it.usuario_id = ? ORDER BY cert.created_at DESC`;
      params = [id];
    } else if (rol === 'profesor') {
      query = `SELECT cert.id, cert.estado, cert.created_at,
                      u.nombre as usuario_nombre, c.nombre as curso_nombre
               FROM certificados cert
               JOIN intentos it ON cert.intento_id = it.id
               JOIN cursos c ON it.curso_id = c.id AND c.profesor_id = ?
               JOIN usuarios u ON it.usuario_id = u.id
               WHERE cert.estado = 'pendiente' ORDER BY cert.created_at ASC`;
      params = [id];
    } else {
      query = `SELECT cert.id, cert.estado, cert.archivo_url, cert.fecha_emision, cert.created_at,
                      u.nombre as usuario_nombre, c.nombre as curso_nombre, s.nombre as sede_nombre
               FROM certificados cert
               JOIN intentos it ON cert.intento_id = it.id
               JOIN usuarios u ON it.usuario_id = u.id
               JOIN cursos c ON it.curso_id = c.id
               LEFT JOIN sedes s ON u.sede_id = s.id
               ${rol === 'admin_sede' ? 'WHERE u.sede_id = ?' : ''}
               ORDER BY cert.created_at DESC`;
      if (rol === 'admin_sede') params = [sede_id];
    }
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener certificados' });
  }
});

// PATCH /api/certificados/:id/validar — aprobar o rechazar certificado
router.patch('/:id/validar', verificarToken, verificarRol('profesor', 'admin_sede', 'jefatura'), async (req, res) => {
  const id = parseIdParam(req, 'id');
  if (id === null) return res.status(400).json({ error: 'id inválido' });
  const { estado } = req.body;
  if (!['aprobado', 'rechazado', 'pendiente'].includes(estado))
    return res.status(400).json({ error: 'Estado debe ser aprobado, rechazado o pendiente' });

  try {
    const { rows } = await pool.query(
      `SELECT cert.id, cert.intento_id, it.nota AS intento_nota,
              u.nombre as usuario_nombre, c.nombre as curso_nombre
       FROM certificados cert
       JOIN intentos it ON cert.intento_id = it.id
       JOIN usuarios u ON it.usuario_id = u.id
       JOIN cursos c ON it.curso_id = c.id
       WHERE cert.id = ?`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Certificado no encontrado' });
    const cert = rows[0];

    let archivo_url = null;
    let fecha_emision = null;
    if (estado === 'aprobado') {
      const qrUrl = `${process.env.CLIENT_URL || 'https://alumcoproyecto-production.up.railway.app'}/verificar/${req.params.id}`;
      archivo_url = await generarCertificadoPDF({
        certId: cert.id,
        nombre: cert.usuario_nombre,
        curso: cert.curso_nombre,
        fecha: new Date(),
        estado: 'aprobado',
        qrUrl,
        nota: porcentajeANotaChilena(cert.intento_nota)
      });
      fecha_emision = new Date();
    }

    const validado_por = estado === 'pendiente' ? null : req.usuario.id;
    await pool.query(
      'UPDATE certificados SET estado = ?, validado_por = ?, archivo_url = ?, fecha_emision = ? WHERE id = ?',
      [estado, validado_por, archivo_url, fecha_emision, req.params.id]
    );
    const { rows: updated } = await pool.query('SELECT * FROM certificados WHERE id = ?', [req.params.id]);
    await auditar(req, 'certificado.validar', 'certificado', parseInt(req.params.id), { estado, usuario: cert.usuario_nombre, curso: cert.curso_nombre });
    res.json(updated[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al validar certificado' });
  }
});

// GET /api/certificados/todos — para jefatura y admin_sede con filtros
// Con ?page&limit → devuelve { rows, total, page, limit }
// Sin ?page       → devuelve array plano (compatible hacia atrás)
router.get('/todos', verificarToken, verificarRol('admin_sede', 'jefatura', 'profesor'), async (req, res) => {
  const { rol, sede_id } = req.usuario;
  const { q, sede_id: sedeQuery, estado, estamento, page, limit } = req.query;
  try {
    let where = 'WHERE 1=1';
    const params = [];

    if (rol === 'admin_sede') {
      where += ' AND u.sede_id = ?'; params.push(sede_id);
    } else if (rol === 'profesor') {
      where += ' AND c.profesor_id = ?'; params.push(req.usuario.id);
    } else if (sedeQuery) {
      where += ' AND u.sede_id = ?'; params.push(parseInt(sedeQuery));
    }
    if (estado) {
      where += ' AND cert.estado = ?'; params.push(estado);
    }
    if (estamento) {
      where += ' AND e.nombre = ?'; params.push(estamento);
    }
    if (q) {
      where += ' AND (u.nombre LIKE ? OR u.identificador LIKE ? OR c.nombre LIKE ?)';
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }

    const selectSQL = `
      SELECT cert.id, cert.estado, cert.archivo_url, cert.fecha_emision, cert.created_at,
             u.nombre as usuario_nombre, u.identificador as usuario_rut,
             e.nombre AS estamento, u.sede_id,
             c.nombre as curso_nombre, ar.nombre as area,
             s.nombre as sede_nombre,
             v.nombre as validado_por_nombre
      FROM certificados cert
      JOIN intentos it ON cert.intento_id = it.id
      JOIN usuarios u ON it.usuario_id = u.id
      JOIN cursos c ON it.curso_id = c.id
      LEFT JOIN estamentos e ON u.estamento_id = e.id
      LEFT JOIN areas ar ON c.area_id = ar.id
      LEFT JOIN sedes s ON u.sede_id = s.id
      LEFT JOIN usuarios v ON cert.validado_por = v.id
    `;

    if (page !== undefined) {
      const pageNum = Math.max(1, parseInt(page) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
      const offset = (pageNum - 1) * limitNum;

      const countSQL = `
        SELECT COUNT(*) AS total
        FROM certificados cert
        JOIN intentos it ON cert.intento_id = it.id
        JOIN usuarios u ON it.usuario_id = u.id
        JOIN cursos c ON it.curso_id = c.id
        LEFT JOIN estamentos e ON u.estamento_id = e.id
        ${where}
      `;
      const { rows: countRows } = await pool.query(countSQL, params);
      const total = countRows[0].total;

      const { rows } = await pool.query(
        `${selectSQL} ${where} ORDER BY cert.created_at DESC LIMIT ? OFFSET ?`,
        [...params, limitNum, offset]
      );
      return res.json({ rows, total, page: pageNum, limit: limitNum });
    }

    const { rows } = await pool.query(
      `${selectSQL} ${where} ORDER BY cert.created_at DESC`, params
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener certificados' });
  }
});

// GET /api/certificados/:id/descargar — genera y sirve el PDF al vuelo
router.get('/:id/descargar', verificarToken, async (req, res) => {
  const id = parseIdParam(req, 'id');
  if (id === null) return res.status(400).json({ error: 'id inválido' });
  try {
    const { rows } = await pool.query(
      `SELECT cert.id, cert.estado, cert.fecha_emision, cert.created_at,
              it.usuario_id, it.nota AS intento_nota, u.nombre as usuario_nombre,
              c.nombre as curso_nombre
       FROM certificados cert
       JOIN intentos it ON cert.intento_id = it.id
       JOIN usuarios u ON it.usuario_id = u.id
       JOIN cursos c ON it.curso_id = c.id
       WHERE cert.id = ?`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Certificado no encontrado' });
    const cert = rows[0];
    if (req.usuario.rol === 'colaborador' && cert.usuario_id !== req.usuario.id)
      return res.status(403).json({ error: 'No tienes acceso a este certificado' });
    if (cert.estado !== 'aprobado')
      return res.status(400).json({ error: 'El certificado aún no está disponible' });

    const qrUrl = `${process.env.CLIENT_URL || 'https://alumcoproyecto-production.up.railway.app'}/verificar/${cert.id}`;
    const buffer = await buildCertificadoPDF({
      nombre: cert.usuario_nombre,
      curso: cert.curso_nombre,
      fecha: cert.fecha_emision || cert.created_at,
      estado: 'aprobado',
      qrUrl,
      nota: porcentajeANotaChilena(cert.intento_nota)
    });

    const safeName = (cert.usuario_nombre || 'certificado')
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .slice(0, 60);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="certificado_${safeName}_${cert.id}.pdf"`);
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  } catch (err) {
    console.error('Error al generar certificado:', err);
    res.status(500).json({ error: 'Error al descargar certificado' });
  }
});

module.exports = router;
