const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts, rgb, degrees } = require('pdf-lib');
const { uploadBuffer } = require('../config/s3');

const FIRMA_PATH = path.join(__dirname, '..', 'assets', 'firma.pdf');
const LOGO_PATH = path.join(__dirname, '..', 'assets', 'logo.png');

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

let logoBytesCache = null;
function getLogoBytes() {
  if (logoBytesCache) return logoBytesCache;
  try {
    logoBytesCache = fs.readFileSync(LOGO_PATH);
  } catch {
    logoBytesCache = null;
  }
  return logoBytesCache;
}

const COLOR_AZUL = rgb(0x2B / 255, 0x4B / 255, 0xA0 / 255);
const COLOR_AZUL_OSCURO = rgb(0x1E / 255, 0x3A / 255, 0x6E / 255);
const COLOR_TEXTO = rgb(0x33 / 255, 0x33 / 255, 0x33 / 255);
const COLOR_GRIS = rgb(0x55 / 255, 0x55 / 255, 0x55 / 255);
const COLOR_GRIS_CLARO = rgb(0x88 / 255, 0x88 / 255, 0x88 / 255);
const COLOR_AZUL_SUAVE = rgb(0xA8 / 255, 0xB8 / 255, 0xD8 / 255);

// El papel va en blanco puro a propósito. `firma.pdf` es un escaneo con fondo
// blanco opaco, así que sobre el gris claro anterior (#F4F5F7) se recortaba un
// rectángulo visible alrededor de la firma. Igualar el papel al fondo de la
// firma es lo que hace que el recuadro desaparezca; el marco doble sustituye al
// gris como recurso para que la hoja no quede desnuda. Si algún día se cambia
// este color, hay que recortarle el fondo a firma.pdf en la misma pasada.
const COLOR_PAPEL = rgb(1, 1, 1);

// Marco interior: todo el contenido vive acá adentro, con PAD a cada lado.
const MARCO = { x0: 32, x1: 810, y0: 32, y1: 563 };
const PAD = 30;
const ANCHO_UTIL = (MARCO.x1 - MARCO.x0) - PAD * 2;   // 718pt

// Filigrana: el isotipo de fondo. Tamaño y opacidad van juntos —subir sólo la
// opacidad ensucia el texto, subir sólo el tamaño no lo hace más visible—, por
// eso se tocan como un bloque. Subir de ~0.20 empieza a competir con la lectura
// y a comerse tóner al imprimir.
const FILIGRANA = { alto: 340, ancho: 380, opacidad: 0.11 };

// Membrete de la cabecera.
const MEMBRETE = { x: 62, logoAlto: 46, gap: 14, reglaY: 482, reglaHasta: 780 };

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

function drawCenteredText(page, text, { y, size, font, color, opacity }) {
  const safe = sanitize(text);
  const width = font.widthOfTextAtSize(safe, size);
  const x = (page.getWidth() - width) / 2;
  page.drawText(safe, { x, y, size, font, color, opacity });
}

/**
 * Ajusta un texto al ancho disponible: primero reduce el cuerpo hasta `minSize`
 * y, si aún no entra, lo parte en dos líneas por palabras.
 *
 * Hace falta porque ni el nombre ni el curso tienen tope de largo: los nombres
 * compuestos chilenos son largos y los cursos generados por IA más todavía.
 * Antes se dibujaban centrados al tamaño fijo, así que un curso largo se salía
 * de la hoja por los dos lados sin que nada lo avisara.
 */
function ajustarTexto(text, { font, maxSize, minSize, maxWidth }) {
  const safe = sanitize(text) || '';
  const cabe = (lineas, size) => lineas.every(l => font.widthOfTextAtSize(l, size) <= maxWidth);

  // Por debajo de este cuerpo, una sola línea queda tan chica que desentona con
  // el resto del bloque: a partir de ahí conviene más partir en dos.
  const sizeComodo = maxSize * 0.75;

  const buscar = (lineas, desde, hasta) => {
    for (let size = desde; size >= hasta; size -= 0.5) {
      if (cabe(lineas, size)) return { lineas, size };
    }
    return null;
  };

  // Dos mitades lo más parejas posible, cortando por espacios.
  const palabras = safe.split(' ');
  let dos = null;
  if (palabras.length > 1) {
    let mejor = null;
    for (let i = 1; i < palabras.length; i++) {
      const a = palabras.slice(0, i).join(' ');
      const b = palabras.slice(i).join(' ');
      const dif = Math.abs(a.length - b.length);
      if (!mejor || dif < mejor.dif) mejor = { a, b, dif };
    }
    dos = [mejor.a, mejor.b];
  }

  return buscar([safe], maxSize, sizeComodo)      // una línea, cuerpo digno
      || (dos && buscar(dos, maxSize, minSize))   // antes que achicar de más, partir
      || buscar([safe], sizeComodo, minSize)      // una línea achicada
      || { lineas: dos || [safe], size: minSize }; // último recurso
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

  // Papel blanco + marco doble. El marco exterior lleva el peso; el interior es
  // una filigrana que da profundidad sin competir con el texto.
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: COLOR_PAPEL });
  page.drawRectangle({
    x: 24, y: 24, width: W - 48, height: H - 48,
    borderColor: COLOR_AZUL, borderWidth: 1.5
  });
  page.drawRectangle({
    x: MARCO.x0, y: MARCO.y0, width: MARCO.x1 - MARCO.x0, height: MARCO.y1 - MARCO.y0,
    borderColor: COLOR_AZUL_SUAVE, borderWidth: 0.5
  });

  // Filigrana: el isotipo grande y muy tenue detrás de todo. Va primero para
  // que el texto quede siempre por encima.
  const logoBytes = getLogoBytes();
  let logoImg = null;
  if (logoBytes) {
    try {
      logoImg = await pdfDoc.embedPng(logoBytes);
    } catch (err) {
      console.warn('No se pudo embeber logo.png:', err.message);
    }
  }
  // En los pendientes se omite la filigrana: la marca de agua de "PENDIENTE DE
  // VALIDACIÓN" ya ocupa ese plano, y las dos juntas cargaban la hoja y le
  // quitaban legibilidad justo al aviso que importa.
  const esPendiente = estado === 'pendiente';

  if (logoImg && !esPendiente) {
    const escala = Math.min(FILIGRANA.alto / logoImg.height, FILIGRANA.ancho / logoImg.width);
    const fw = logoImg.width * escala;
    const fh = logoImg.height * escala;
    page.drawImage(logoImg, {
      x: (W - fw) / 2, y: (H - fh) / 2, width: fw, height: fh, opacity: FILIGRANA.opacidad
    });
  }

  // Va antes que el texto para quedar por debajo y no ensuciar la lectura.
  if (esPendiente) {
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

  // Membrete: isotipo arriba a la izquierda con el nombre de la organización al
  // lado. El logo es un isotipo sin texto, así que solo no dice quién emite el
  // documento — y este certificado lo lee gente de fuera (SENAMA, entre otros).
  if (logoImg) {
    const logoH = MEMBRETE.logoAlto;
    const logoW = logoImg.width * (logoH / logoImg.height);
    const textoX = MEMBRETE.x + logoW + MEMBRETE.gap;
    page.drawImage(logoImg, { x: MEMBRETE.x, y: 496, width: logoW, height: logoH });
    page.drawText('ONG ALUMCO', {
      x: textoX, y: 522, size: 13, font: helveticaBold, color: COLOR_AZUL_OSCURO
    });
    page.drawText(sanitize('Plataforma de Capacitación Interna'), {
      x: textoX, y: 506, size: 9, font: helvetica, color: COLOR_GRIS_CLARO
    });
  }
  page.drawLine({
    start: { x: MEMBRETE.x, y: MEMBRETE.reglaY },
    end: { x: MEMBRETE.reglaHasta, y: MEMBRETE.reglaY },
    thickness: 0.75, color: COLOR_AZUL_SUAVE
  });

  // Título
  drawCenteredText(page, 'CERTIFICADO DE CAPACITACIÓN', {
    y: 440, size: 27, font: helveticaBold, color: COLOR_AZUL_OSCURO
  });

  drawCenteredText(page, 'Este certificado acredita que', {
    y: 400, size: 12.5, font: helvetica, color: COLOR_TEXTO
  });

  const fitNombre = ajustarTexto((nombre || '').toUpperCase(), {
    font: helveticaBold, maxSize: 24, minSize: 15, maxWidth: ANCHO_UTIL
  });
  fitNombre.lineas.forEach((linea, i) => {
    drawCenteredText(page, linea, {
      y: 364 - i * (fitNombre.size + 4), size: fitNombre.size, font: helveticaBold, color: COLOR_AZUL
    });
  });

  drawCenteredText(page, 'ha completado exitosamente el curso', {
    y: 328, size: 12.5, font: helvetica, color: COLOR_TEXTO
  });

  // El bloque del curso reserva siempre el alto de dos líneas, así lo de abajo
  // no se mueve según lo largo que sea el nombre del curso.
  const fitCurso = ajustarTexto(curso || '', {
    font: helveticaBold, maxSize: 19, minSize: 12, maxWidth: ANCHO_UTIL
  });
  fitCurso.lineas.forEach((linea, i) => {
    drawCenteredText(page, linea, {
      y: 296 - i * (fitCurso.size + 4), size: fitCurso.size, font: helveticaBold, color: COLOR_AZUL
    });
  });

  // Nota en su propia línea y etiquetada. Es un requisito de SENAMA, no un dato
  // secundario: antes iba pegada a la ciudad detrás de un "·" y se leía como
  // parte de la fecha.
  if (nota !== null && nota !== undefined && !Number.isNaN(Number(nota))) {
    drawCenteredText(page, `Calificación obtenida: ${Number(nota).toFixed(1)}`, {
      y: 244, size: 12.5, font: helveticaBold, color: COLOR_TEXTO
    });
  }

  const fechaDate = fecha ? new Date(fecha) : new Date();
  const fechaStr = fechaDate.toLocaleDateString('es-CL', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
  drawCenteredText(page, `Hualpén, ${fechaStr}`, {
    y: 222, size: 11, font: helvetica, color: COLOR_GRIS
  });

  // Firma sobre la línea. Se acota por alto y por ancho: firma.pdf es un
  // escaneo y escalar sólo por alto la dejaba invadiendo la fecha.
  const lineY = 128;
  const firmaBytes = getFirmaBytes();
  if (firmaBytes) {
    try {
      const [embedded] = await pdfDoc.embedPdf(firmaBytes, [0]);
      const escala = Math.min(66 / embedded.height, 250 / embedded.width);
      const firmaH = embedded.height * escala;
      const firmaW = embedded.width * escala;
      page.drawPage(embedded, {
        x: (W - firmaW) / 2,
        y: lineY + 6,
        width: firmaW,
        height: firmaH
      });
    } catch (err) {
      console.warn('No se pudo embeber firma.pdf:', err.message);
    }
  }

  // Linea + nombre debajo de la firma
  page.drawLine({
    start: { x: (W / 2) - 140, y: lineY },
    end: { x: (W / 2) + 140, y: lineY },
    thickness: 1, color: COLOR_TEXTO
  });
  // "Plataforma de Capacitación Interna" ya va en el membrete: repetirla acá
  // sonaba a relleno. Abajo queda solo quién firma y dónde verificar.
  drawCenteredText(page, 'Mandante ONG ALUMCO', {
    y: 111, size: 11, font: helvetica, color: COLOR_TEXTO
  });

  if (qrUrl) {
    drawCenteredText(page, `Verificar en: ${qrUrl}`, {
      y: 88, size: 8.5, font: helvetica, color: COLOR_GRIS_CLARO
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

module.exports = {
  generarCertificadoPDF,
  buildCertificadoPDF,
  // Expuesto para el chequeo de layout: mide contra las mismas constantes y la
  // misma función de ajuste que se usan al dibujar, no contra una copia.
  __test: { ajustarTexto, MARCO, ANCHO_UTIL }
};
