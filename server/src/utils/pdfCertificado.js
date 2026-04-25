const PDFDocument = require('pdfkit');
const { uploadBuffer } = require('../config/s3');

/**
 * Genera el PDF de un certificado y lo sube a S3.
 * @param {object} opts
 * @param {number}  opts.certId   - ID del certificado (para el filename)
 * @param {string}  opts.nombre   - Nombre del colaborador
 * @param {string}  opts.curso    - Nombre del curso
 * @param {Date}    opts.fecha    - Fecha de emisión (default: hoy)
 * @param {string}  opts.estado   - 'pendiente' | 'aprobado'
 * @param {string}  [opts.qrUrl]  - URL de verificación (solo en aprobados)
 * @returns {Promise<string>}  URL pública del PDF
 */
async function generarCertificadoPDF({ certId, nombre, curso, fecha, estado = 'aprobado', qrUrl = null }) {
  const buffer = await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape' });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end',  () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = doc.page.width;
    const H = doc.page.height;

    // Fondo y borde
    doc.rect(0, 0, W, H).fill('#F4F5F7');
    doc.rect(20, 20, W - 40, H - 40).stroke('#2B4BA0');

    // Título
    doc.fillColor('#1E3A6E').fontSize(32).font('Helvetica-Bold')
       .text('CERTIFICADO DE CAPACITACIÓN', 0, 80, { align: 'center' });

    // Cuerpo
    doc.fillColor('#333333').fontSize(16).font('Helvetica')
       .text('Este certificado acredita que', 0, 160, { align: 'center' });
    doc.fillColor('#2B4BA0').fontSize(26).font('Helvetica-Bold')
       .text(nombre.toUpperCase(), 0, 195, { align: 'center' });
    doc.fillColor('#333333').fontSize(16).font('Helvetica')
       .text('ha completado exitosamente el curso', 0, 240, { align: 'center' });
    doc.fillColor('#2B4BA0').fontSize(22).font('Helvetica-Bold')
       .text(curso, 0, 270, { align: 'center' });

    const fechaStr = fecha
      ? new Date(fecha).toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' })
      : new Date().toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' });
    doc.fillColor('#555555').fontSize(12).font('Helvetica')
       .text(`Hualpén, ${fechaStr}`, 0, 350, { align: 'center' });

    doc.moveTo(250, 420).lineTo(550, 420).stroke('#333333');
    doc.fillColor('#333333').fontSize(11).text('ONG ALUMCO', 0, 430, { align: 'center' });
    doc.fontSize(10).fillColor('#888888').text('Plataforma de Capacitación Interna', 0, 448, { align: 'center' });

    if (qrUrl) {
      doc.fontSize(9).fillColor('#AAAAAA')
         .text(`Verificar en: ${qrUrl}`, 0, 468, { align: 'center' });
    }

    // Marca de agua diagonal para borradores pendientes
    if (estado === 'pendiente') {
      doc.save();
      doc.opacity(0.12);
      doc.fontSize(54).font('Helvetica-Bold').fillColor('#888888');
      doc.rotate(-40, { origin: [W / 2, H / 2] });
      doc.text('PENDIENTE DE VALIDACIÓN', 60, H / 2 - 27, { width: W - 120, align: 'center' });
      doc.restore();
    }

    doc.end();
  });

  const key = `certificados/cert_${certId}_${Date.now()}.pdf`;
  return uploadBuffer(buffer, key, 'application/pdf');
}

module.exports = { generarCertificadoPDF };
