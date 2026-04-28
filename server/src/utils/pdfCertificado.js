const PDFDocument = require('pdfkit');
const { uploadBuffer } = require('../config/s3');
const path = require('path');
const fs = require('fs');

// ──────────────────────────────────────────────────
// Firma / número de serie (reemplazar cuando se tenga la firma real de Valentina)
// ──────────────────────────────────────────────────
const FIRMA_PLACEHOLDER = 'AL-FIRMA-VALENTINA-PENDIENTE';

// Carga el logo ALUMCO desde los assets del cliente (base64 PNG)
function cargarLogoBuffer() {
  try {
    const logoFile = path.join(__dirname, '../../../client/src/assets/logo.js');
    const content = fs.readFileSync(logoFile, 'utf8');
    const idx = content.indexOf("export const LOGO_SIMBOLO = '");
    if (idx === -1) return null;
    const start = idx + "export const LOGO_SIMBOLO = '".length;
    const end = content.indexOf("'", start);
    const dataUrl = content.slice(start, end);
    const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
    return Buffer.from(base64, 'base64');
  } catch {
    return null;
  }
}

const LOGO_BUFFER = cargarLogoBuffer();

/**
 * Genera el PDF de un certificado al estilo Santander X y lo sube a S3.
 * @param {object} opts
 * @param {number}  opts.certId  - ID del certificado (para el filename)
 * @param {string}  opts.nombre  - Nombre del colaborador
 * @param {string}  opts.curso   - Nombre del curso
 * @param {Date}    opts.fecha   - Fecha de emisión (default: hoy)
 * @param {string}  opts.estado  - 'pendiente' | 'aprobado'
 * @returns {Promise<string>} URL pública del PDF
 */
async function generarCertificadoPDF({ certId, nombre, curso, fecha, estado = 'aprobado' }) {
  const buffer = await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape' });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end',  () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = doc.page.width;  // 841.89
    const H = doc.page.height; // 595.28

    // ── Fondo claro ──────────────────────────────────────────────────────────
    doc.rect(0, 0, W, H).fill('#EEF2F7');

    // ── Patrón decorativo diagonal (zona derecha, como el mesh del ejemplo) ──
    doc.save();
    doc.opacity(0.06);
    doc.strokeColor('#2B4BA0').lineWidth(0.5);
    const meshStart = W * 0.44;
    const spacing = 16;
    for (let offset = -H; offset < W - meshStart + H; offset += spacing) {
      doc.moveTo(meshStart + offset, 0).lineTo(meshStart + offset + H, H).stroke();
    }
    doc.restore();

    // ── Logo ALUMCO (parte superior izquierda) ───────────────────────────────
    if (LOGO_BUFFER) {
      doc.image(LOGO_BUFFER, 44, 36, { width: 120 });
    } else {
      doc.fillColor('#2B4BA0').fontSize(20).font('Helvetica-Bold')
         .text('ONG ALUMCO', 44, 50);
    }

    // ── Bloque de contenido (centro-derecha) ─────────────────────────────────
    const cX  = W * 0.36;      // x de inicio del bloque de texto
    const cW  = W - cX - 55;  // ancho disponible
    let   y   = 72;

    // "Certificado de finalización de"
    doc.fillColor('#444444').fontSize(13).font('Helvetica')
       .text('Certificado de finalización de', cX, y, { width: cW });
    y = doc.y + 10;

    // Nombre del colaborador (bold, destacado)
    doc.fillColor('#111111').fontSize(22).font('Helvetica-Bold')
       .text(nombre, cX, y, { width: cW });
    y = doc.y + 14;

    // Línea separadora
    doc.moveTo(cX, y).lineTo(cX + cW * 0.65, y)
       .strokeColor('#BBBBBB').lineWidth(0.8).stroke();
    y += 20;

    // Nombre del curso (el título principal, grande y bold)
    doc.fillColor('#111111').fontSize(24).font('Helvetica-Bold')
       .text(curso, cX, y, { width: cW });
    y = doc.y + 16;

    // "Curso terminado el [fecha]"
    const fechaStr = fecha
      ? new Date(fecha).toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' })
      : new Date().toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' });

    doc.fillColor('#555555').fontSize(11).font('Helvetica')
       .text(`Curso terminado el ${fechaStr}`, cX, y, { width: cW });

    // ── Número de serie / firma (parte inferior izquierda) ───────────────────
    doc.fillColor('#888888').fontSize(9).font('Helvetica')
       .text(`Número de serie: ${FIRMA_PLACEHOLDER}`, 44, H - 36);

    // ── Marca de agua para certificados pendientes ───────────────────────────
    if (estado === 'pendiente') {
      doc.save();
      doc.opacity(0.10);
      doc.fontSize(52).font('Helvetica-Bold').fillColor('#888888');
      doc.rotate(-38, { origin: [W / 2, H / 2] });
      doc.text('PENDIENTE DE VALIDACIÓN', 60, H / 2 - 26, { width: W - 120, align: 'center' });
      doc.restore();
    }

    doc.end();
  });

  const key = `certificados/cert_${certId}_${Date.now()}.pdf`;
  return uploadBuffer(buffer, key, 'application/pdf');
}

module.exports = { generarCertificadoPDF };
