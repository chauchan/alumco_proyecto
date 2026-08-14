const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts, rgb, degrees } = require('pdf-lib');
const { uploadBuffer } = require('../config/s3');

const FIRMA_PATH = path.join(__dirname, '..', 'assets', 'firma.pdf');

let firmaBytesCache = null;
function getFirmaBytes() {
  if (firmaBytesCache) return firmaBytesCache;
  try {
    firmaBytesCache = fs.readFileSync(FIRMA_PATH);
  } catch {
    firmaBytesCache = null;
  }
  return firmaBytesCache;
}

const COLOR_AZUL = rgb(0x2B / 255, 0x4B / 255, 0xA0 / 255);
const COLOR_AZUL_OSCURO = rgb(0x1E / 255, 0x3A / 255, 0x6E / 255);
const COLOR_TEXTO = rgb(0x33 / 255, 0x33 / 255, 0x33 / 255);
const COLOR_GRIS = rgb(0x55 / 255, 0x55 / 255, 0x55 / 255);
const COLOR_GRIS_CLARO = rgb(0x88 / 255, 0x88 / 255, 0x88 / 255);
const COLOR_FONDO = rgb(0xF4 / 255, 0xF5 / 255, 0xF7 / 255);

// Helvetica (StandardFont) usa WinAnsi: normalizamos caracteres comunes
// fuera de ese encoding (smart quotes, guiones largos, etc.) para que no
// reviente en nombres/cursos copiados desde Word.
function sanitize(text) {
  if (!text) return '';
  return String(text)
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[–—−]/g, '-')
    .replace(/…/g, '...')
    .replace(/ /g, ' ');
}

function drawCenteredText(page, text, { y, size, font, color }) {
  const safe = sanitize(text);
  const width = font.widthOfTextAtSize(safe, size);
  const x = (page.getWidth() - width) / 2;
  page.drawText(safe, { x, y, size, font, color });
}

/**
 * Construye el PDF del certificado y devuelve un Buffer.
 * No depende de S3; ideal para servir al vuelo.
 */
async function buildCertificadoPDF({ nombre, curso, fecha, estado = 'aprobado', qrUrl = null, nota = null }) {
  const pdfDoc = await PDFDocument.create();
  // A4 landscape: 842 x 595 pt
  const page = pdfDoc.addPage([842, 595]);
  const W = page.getWidth();
  const H = page.getHeight();

  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Fondo
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: COLOR_FONDO });
  // Borde
  page.drawRectangle({
    x: 20, y: 20, width: W - 40, height: H - 40,
    borderColor: COLOR_AZUL, borderWidth: 1
  });

  // Título
  drawCenteredText(page, 'CERTIFICADO DE CAPACITACIÓN', {
    y: H - 100, size: 32, font: helveticaBold, color: COLOR_AZUL_OSCURO
  });

  drawCenteredText(page, 'Este certificado acredita que', {
    y: H - 180, size: 16, font: helvetica, color: COLOR_TEXTO
  });
  drawCenteredText(page, (nombre || '').toUpperCase(), {
    y: H - 220, size: 26, font: helveticaBold, color: COLOR_AZUL
  });
  drawCenteredText(page, 'ha completado exitosamente el curso', {
    y: H - 265, size: 16, font: helvetica, color: COLOR_TEXTO
  });
  drawCenteredText(page, curso || '', {
    y: H - 300, size: 22, font: helveticaBold, color: COLOR_AZUL
  });

  const fechaDate = fecha ? new Date(fecha) : new Date();
  const fechaStr = fechaDate.toLocaleDateString('es-CL', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
  const notaStr = (nota !== null && nota !== undefined && !Number.isNaN(Number(nota))) ? ` · Nota: ${Number(nota).toFixed(1)}` : '';
  drawCenteredText(page, `Hualpén, ${fechaStr}${notaStr}`, {
    y: H - 360, size: 12, font: helvetica, color: COLOR_GRIS
  });

  // Firma — embed first page of firma.pdf, justo encima de la linea
  const lineY = 130;
  const firmaBytes = getFirmaBytes();
  if (firmaBytes) {
    try {
      const [embedded] = await pdfDoc.embedPdf(firmaBytes, [0]);
      const firmaH = 110;
      const firmaW = embedded.width * (firmaH / embedded.height);
      page.drawPage(embedded, {
        x: (W - firmaW) / 2,
        y: lineY + 5,
        width: firmaW,
        height: firmaH
      });
    } catch (err) {
      console.warn('No se pudo embeber firma.pdf:', err.message);
    }
  }

  // Linea + nombre debajo de la firma
  page.drawLine({
    start: { x: (W / 2) - 150, y: lineY },
    end: { x: (W / 2) + 150, y: lineY },
    thickness: 1, color: COLOR_TEXTO
  });
  drawCenteredText(page, 'Mandante ONG ALUMCO', {
    y: lineY - 18, size: 11, font: helvetica, color: COLOR_TEXTO
  });
  drawCenteredText(page, 'Plataforma de Capacitación Interna', {
    y: lineY - 35, size: 10, font: helvetica, color: COLOR_GRIS_CLARO
  });

  if (qrUrl) {
    drawCenteredText(page, `Verificar en: ${qrUrl}`, {
      y: lineY - 55, size: 9, font: helvetica, color: COLOR_GRIS_CLARO
    });
  }

  if (estado === 'pendiente') {
    const wm = 'PENDIENTE DE VALIDACIÓN';
    const size = 54;
    const wmWidth = helveticaBold.widthOfTextAtSize(wm, size);
    page.drawText(wm, {
      x: (W - wmWidth) / 2,
      y: H / 2,
      size,
      font: helveticaBold,
      color: COLOR_GRIS_CLARO,
      opacity: 0.12,
      rotate: degrees(-30)
    });
  }

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}

/**
 * Genera el PDF y lo sube a S3. Devuelve la URL pública.
 * Si la subida falla, devuelve null (la descarga al vuelo igualmente funcionará).
 */
async function generarCertificadoPDF({ certId, nombre, curso, fecha, estado = 'aprobado', qrUrl = null, nota = null }) {
  const buffer = await buildCertificadoPDF({ nombre, curso, fecha, estado, qrUrl, nota });
  try {
    const key = `certificados/cert_${certId}_${Date.now()}.pdf`;
    return await uploadBuffer(buffer, key, 'application/pdf');
  } catch (err) {
    console.warn('No se pudo subir certificado a S3:', err.message);
    return null;
  }
}

module.exports = { generarCertificadoPDF, buildCertificadoPDF };
