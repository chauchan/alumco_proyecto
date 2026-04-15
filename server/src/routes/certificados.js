const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const pool = require('../config/db');
const { verificarToken, verificarRol } = require('../middleware/auth');
const { uploadBuffer } = require('../config/s3');

// GET /api/certificados — listar certificados del usuario o pendientes para profesor
router.get('/', verificarToken, async (req, res) => {
  const { rol, id, sede_id } = req.usuario;
  try {
    let query, params = [];
    if (rol === 'colaborador') {
      query = `SELECT cert.*, c.nombre as curso_nombre, u.nombre as validado_por_nombre
               FROM certificados cert
               JOIN cursos c ON cert.curso_id = c.id
               LEFT JOIN usuarios u ON cert.validado_por = u.id
               WHERE cert.usuario_id = $1 ORDER BY cert.created_at DESC`;
      params = [id];
    } else if (rol === 'profesor') {
      query = `SELECT cert.*, u.nombre as usuario_nombre, c.nombre as curso_nombre
               FROM certificados cert
               JOIN cursos c ON cert.curso_id = c.id AND c.profesor_id = $1
               JOIN usuarios u ON cert.usuario_id = u.id
               WHERE cert.estado = 'pendiente' ORDER BY cert.created_at ASC`;
      params = [id];
    } else {
      query = `SELECT cert.*, u.nombre as usuario_nombre, c.nombre as curso_nombre, s.nombre as sede_nombre
               FROM certificados cert
               JOIN usuarios u ON cert.usuario_id = u.id
               JOIN cursos c ON cert.curso_id = c.id
               LEFT JOIN sedes s ON u.sede_id = s.id
               ${rol === 'admin_sede' ? 'WHERE u.sede_id = $1' : ''}
               ORDER BY cert.created_at DESC`;
      if (rol === 'admin_sede') params = [sede_id];
    }
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener certificados' });
  }
});

// PATCH /api/certificados/:id/validar — aprobar o rechazar certificado
router.patch('/:id/validar', verificarToken, verificarRol('profesor', 'admin_sede', 'jefatura'), async (req, res) => {
  const { estado } = req.body; // 'aprobado' o 'rechazado'
  if (!['aprobado', 'rechazado'].includes(estado)) {
    return res.status(400).json({ error: 'Estado debe ser aprobado o rechazado' });
  }
  try {
    const certResult = await pool.query(
      'SELECT cert.*, u.nombre as usuario_nombre, c.nombre as curso_nombre FROM certificados cert JOIN usuarios u ON cert.usuario_id = u.id JOIN cursos c ON cert.curso_id = c.id WHERE cert.id = $1',
      [req.params.id]
    );
    if (certResult.rows.length === 0) return res.status(404).json({ error: 'Certificado no encontrado' });
    const cert = certResult.rows[0];

    let archivo_url = null;
    let fecha_emision = null;

    if (estado === 'aprobado') {
      // Generar PDF del certificado
      archivo_url = await generarCertificadoPDF(cert);
      fecha_emision = new Date();
    }

    const result = await pool.query(
      'UPDATE certificados SET estado = $1, validado_por = $2, archivo_url = $3, fecha_emision = $4 WHERE id = $5 RETURNING *',
      [estado, req.usuario.id, archivo_url, fecha_emision, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al validar certificado' });
  }
});


// GET /api/certificados/todos — para jefatura y admin_sede con filtros
router.get('/todos', verificarToken, verificarRol('admin_sede', 'jefatura', 'profesor'), async (req, res) => {
  const { rol, sede_id } = req.usuario;
  try {
    let query = `
      SELECT cert.*, 
             u.nombre as usuario_nombre, u.identificador as usuario_rut,
             u.estamento, u.sede_id,
             c.nombre as curso_nombre, c.area,
             s.nombre as sede_nombre,
             v.nombre as validado_por_nombre
      FROM certificados cert
      JOIN usuarios u ON cert.usuario_id = u.id
      JOIN cursos c ON cert.curso_id = c.id
      LEFT JOIN sedes s ON u.sede_id = s.id
      LEFT JOIN usuarios v ON cert.validado_por = v.id
      WHERE 1=1
    `;
    const params = [];
    if (rol === 'admin_sede') {
      query += ' AND u.sede_id = ?'; params.push(sede_id);
    }
    query += ' ORDER BY cert.created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener certificados' });
  }
});

// GET /api/certificados/:id/descargar — descargar PDF
router.get('/:id/descargar', verificarToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT cert.*, u.nombre as usuario_nombre FROM certificados cert JOIN usuarios u ON cert.usuario_id = u.id WHERE cert.id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Certificado no encontrado' });
    const cert = result.rows[0];
    // Solo el dueño o roles superiores pueden descargar
    if (req.usuario.rol === 'colaborador' && cert.usuario_id !== req.usuario.id) {
      return res.status(403).json({ error: 'No tienes acceso a este certificado' });
    }
    if (cert.estado !== 'aprobado' || !cert.archivo_url) {
      return res.status(400).json({ error: 'El certificado aún no está disponible' });
    }
    res.redirect(cert.archivo_url);
  } catch (err) {
    res.status(500).json({ error: 'Error al descargar certificado' });
  }
});

// Función auxiliar: generar PDF del certificado y subirlo a S3
async function generarCertificadoPDF(cert) {
  const buffer = await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape' });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Fondo y bordes
    doc.rect(0, 0, doc.page.width, doc.page.height).fill('#F4F5F7');
    doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40).stroke('#2B4BA0');

    // Título
    doc.fillColor('#1E3A6E').fontSize(32).font('Helvetica-Bold')
       .text('CERTIFICADO DE CAPACITACIÓN', 0, 80, { align: 'center' });

    // Texto principal
    doc.fillColor('#333333').fontSize(16).font('Helvetica')
       .text('Este certificado acredita que', 0, 160, { align: 'center' });
    doc.fillColor('#2B4BA0').fontSize(26).font('Helvetica-Bold')
       .text(cert.usuario_nombre.toUpperCase(), 0, 195, { align: 'center' });
    doc.fillColor('#333333').fontSize(16).font('Helvetica')
       .text('ha completado exitosamente el curso', 0, 240, { align: 'center' });
    doc.fillColor('#2B4BA0').fontSize(22).font('Helvetica-Bold')
       .text(cert.curso_nombre, 0, 270, { align: 'center' });

    // Fecha y organización
    const fecha = new Date().toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' });
    doc.fillColor('#555555').fontSize(12).font('Helvetica')
       .text(`Hualpén, ${fecha}`, 0, 350, { align: 'center' });

    // Firma
    doc.moveTo(250, 420).lineTo(550, 420).stroke('#333333');
    doc.fillColor('#333333').fontSize(11).text('ONG ALUMCO', 0, 430, { align: 'center' });
    doc.fontSize(10).fillColor('#888888').text('Plataforma de Capacitación Interna', 0, 448, { align: 'center' });

    doc.end();
  });

  const key = `certificados/cert_${cert.id}_${Date.now()}.pdf`;
  return uploadBuffer(buffer, key, 'application/pdf');
}

module.exports = router;
