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
      `SELECT cert.*, u.nombre as usuario_nombre, u.rut as usuario_rut, u.estamento as usuario_estamento,
              c.nombre as curso_nombre, s.nombre as sede_nombre
       FROM certificados cert
       JOIN usuarios u ON cert.usuario_id = u.id
       JOIN cursos c ON cert.curso_id = c.id
       LEFT JOIN sedes s ON u.sede_id = s.id
       WHERE cert.id = $1`,
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
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margins: { top: 0, bottom: 0, left: 0, right: 0 } });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = doc.page.width;
    const H = doc.page.height;

    // Fondo azul oscuro lateral izquierdo
    doc.rect(0, 0, 180, H).fill('#1E3A6E');

    // Fondo principal blanco hueso
    doc.rect(180, 0, W - 180, H).fill('#FAFAFA');

    // Borde derecho decorativo
    doc.rect(W - 8, 0, 8, H).fill('#2B4BA0');

    // Logo ALUMCO (texto como logo)
    doc.fillColor('#FFFFFF').fontSize(22).font('Helvetica-Bold')
       .text('ALUMCO', 0, 60, { width: 180, align: 'center' });
    doc.fillColor('#93AEDE').fontSize(9).font('Helvetica')
       .text('ONG', 0, 86, { width: 180, align: 'center' });

    // Línea divisoria decorativa en el lateral
    doc.moveTo(40, 115).lineTo(140, 115).lineWidth(0.5).strokeColor('#2B4BA0').stroke();

    // Datos del colaborador en el lateral
    doc.fillColor('#93AEDE').fontSize(8).font('Helvetica')
       .text('COLABORADOR', 0, 130, { width: 180, align: 'center' });
    doc.fillColor('#FFFFFF').fontSize(10).font('Helvetica-Bold')
       .text(cert.usuario_nombre || '', 10, 148, { width: 160, align: 'center' });

    if (cert.usuario_rut) {
      doc.fillColor('#93AEDE').fontSize(7).font('Helvetica')
         .text('RUT', 0, 175, { width: 180, align: 'center' });
      doc.fillColor('#FFFFFF').fontSize(9)
         .text(cert.usuario_rut, 0, 187, { width: 180, align: 'center' });
    }

    if (cert.usuario_estamento) {
      doc.fillColor('#93AEDE').fontSize(7).font('Helvetica')
         .text('CARGO', 0, 212, { width: 180, align: 'center' });
      const estamento = cert.usuario_estamento.length > 22
        ? cert.usuario_estamento.substring(0, 20) + '...'
        : cert.usuario_estamento;
      doc.fillColor('#FFFFFF').fontSize(8)
         .text(estamento, 10, 224, { width: 160, align: 'center' });
    }

    if (cert.sede_nombre) {
      doc.fillColor('#93AEDE').fontSize(7).font('Helvetica')
         .text('SEDE', 0, 255, { width: 180, align: 'center' });
      doc.fillColor('#FFFFFF').fontSize(9)
         .text(cert.sede_nombre, 0, 267, { width: 180, align: 'center' });
    }

    // Fecha en el lateral inferior
    const fecha = new Date().toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });
    doc.moveTo(40, H - 100).lineTo(140, H - 100).lineWidth(0.5).strokeColor('#2B4BA0').stroke();
    doc.fillColor('#93AEDE').fontSize(7).font('Helvetica')
       .text('FECHA DE EMISIÓN', 0, H - 90, { width: 180, align: 'center' });
    doc.fillColor('#FFFFFF').fontSize(8)
       .text(fecha, 0, H - 78, { width: 180, align: 'center' });

    // ─── Contenido principal ───────────────────────────────────────────────────
    const contentX = 210;
    const contentW = W - contentX - 40;

    // Título CERTIFICADO
    doc.fillColor('#2B4BA0').fontSize(11).font('Helvetica')
       .text('C E R T I F I C A D O', contentX, 60, { width: contentW, align: 'left', characterSpacing: 4 });

    doc.fillColor('#1E3A6E').fontSize(28).font('Helvetica-Bold')
       .text('DE CAPACITACIÓN', contentX, 80, { width: contentW, align: 'left' });

    // Línea decorativa bajo el título
    doc.moveTo(contentX, 125).lineTo(contentX + 80, 125).lineWidth(3).strokeColor('#2B4BA0').stroke();
    doc.moveTo(contentX + 85, 125).lineTo(contentX + contentW, 125).lineWidth(0.5).strokeColor('#E0E0E0').stroke();

    // Texto "Se otorga a"
    doc.fillColor('#666666').fontSize(12).font('Helvetica')
       .text('Se otorga a quien corresponda que:', contentX, 148, { width: contentW });

    // Nombre del colaborador
    doc.fillColor('#1E3A6E').fontSize(24).font('Helvetica-Bold')
       .text(cert.usuario_nombre?.toUpperCase() || '', contentX, 172, { width: contentW });

    // Texto "ha completado"
    doc.fillColor('#555555').fontSize(12).font('Helvetica')
       .text('ha completado exitosamente el curso de capacitación:', contentX, 218, { width: contentW });

    // Nombre del curso — resaltado
    doc.rect(contentX, 240, contentW, 52).fill('#EEF2FF');
    doc.fillColor('#1E3A6E').fontSize(16).font('Helvetica-Bold')
       .text(cert.curso_nombre || '', contentX + 16, 252, { width: contentW - 32, align: 'left' });

    // Texto cumplimiento
    doc.fillColor('#555555').fontSize(11).font('Helvetica')
       .text(
         'Certificamos que el participante ha demostrado los conocimientos y competencias requeridas por el programa de capacitación institucional de ONG ALUMCO.',
         contentX, 310, { width: contentW, lineGap: 3 }
       );

    // ─── Sección de firmas ────────────────────────────────────────────────────
    const firmaY = H - 110;
    const col1X = contentX;
    const col2X = contentX + (contentW / 2) + 20;
    const firmaW = contentW / 2 - 30;

    // Líneas de firma
    doc.moveTo(col1X, firmaY).lineTo(col1X + firmaW, firmaY).lineWidth(0.8).strokeColor('#333333').stroke();
    doc.moveTo(col2X, firmaY).lineTo(col2X + firmaW, firmaY).lineWidth(0.8).strokeColor('#333333').stroke();

    doc.fillColor('#333333').fontSize(10).font('Helvetica-Bold')
       .text('Dirección ONG ALUMCO', col1X, firmaY + 6, { width: firmaW });
    doc.fillColor('#888888').fontSize(9).font('Helvetica')
       .text('Firma y timbre', col1X, firmaY + 20, { width: firmaW });

    doc.fillColor('#333333').fontSize(10).font('Helvetica-Bold')
       .text('Responsable de Capacitación', col2X, firmaY + 6, { width: firmaW });
    doc.fillColor('#888888').fontSize(9).font('Helvetica')
       .text('Firma y timbre', col2X, firmaY + 20, { width: firmaW });

    doc.end();
  });

  const key = `certificados/cert_${cert.id}_${Date.now()}.pdf`;
  return uploadBuffer(buffer, key, 'application/pdf');
}

module.exports = router;
