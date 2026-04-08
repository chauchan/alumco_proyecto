const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const { Agent, fetch: undiciFetch } = require('undici');
const { execFile } = require('child_process');
const os = require('os');
const pool = require('../config/db');
const { verificarToken, verificarRol } = require('../middleware/auth');
const { notificarProfesor } = require('../config/mailer');

const OLLAMA_URL   = process.env.OLLAMA_URL   || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'gemma3:4b';
const VISION_MODEL = process.env.OLLAMA_VISION_MODEL || 'moondream';

// ── Convierte PDF a imágenes PNG usando pdftoppm ──────────────────────────────
function pdfToImages(pdfPath, outDir, maxPages = 4) {
  return new Promise((resolve, reject) => {
    execFile('pdftoppm', ['-png', '-r', '96', '-l', String(maxPages), pdfPath, path.join(outDir, 'page')],
      (err) => {
        if (err) return reject(err);
        const files = fs.readdirSync(outDir)
          .filter(f => f.endsWith('.png'))
          .sort()
          .map(f => path.join(outDir, f));
        resolve(files);
      }
    );
  });
}

// ── Describe una imagen con moondream vía Ollama ──────────────────────────────
async function describirImagen(imagePath) {
  const imageBase64 = fs.readFileSync(imagePath).toString('base64');
  const response = await undiciFetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    dispatcher: ollamaAgent,
    body: JSON.stringify({
      model: VISION_MODEL,
      prompt: 'Describe detalladamente el contenido de esta imagen de un protocolo médico o de cuidado. Incluye: texto visible, tablas, posiciones corporales mostradas en fotos, procedimientos, horarios o esquemas. Responde en español.',
      images: [imageBase64],
      stream: false
    })
  });
  const data = await response.json();
  return data.response || '';
}

// ── Extrae imágenes embebidas del PDF, filtra las pequeñas y guarda las útiles
async function extraerImagenesPDF(pdfPath, cursoId) {
  const sharp = require('sharp');
  const outDir = path.join(__dirname, '../../uploads/imagenes', String(cursoId));
  fs.mkdirSync(outDir, { recursive: true });
  const outPrefix = path.join(outDir, 'img');

  await new Promise((resolve, reject) => {
    execFile('pdfimages', ['-png', pdfPath, outPrefix], (err) => {
      if (err) return reject(err);
      resolve();
    });
  });

  // Filtrar imágenes por tamaño mínimo (ancho y alto >= 150px, archivo >= 15KB)
  const archivos = fs.readdirSync(outDir)
    .filter(f => f.endsWith('.png') || f.endsWith('.ppm') || f.endsWith('.jpg'))
    .sort();

  const utiles = [];
  for (const archivo of archivos) {
    const fullPath = path.join(outDir, archivo);
    const stat = fs.statSync(fullPath);
    if (stat.size < 15 * 1024) continue; // descartar < 15KB

    try {
      // Convertir PPM a PNG si es necesario
      let finalPath = fullPath;
      if (archivo.endsWith('.ppm')) {
        finalPath = fullPath.replace('.ppm', '.png');
        await sharp(fullPath).png().toFile(finalPath);
        fs.unlinkSync(fullPath);
      }

      const meta = await sharp(finalPath).metadata();
      if ((meta.width || 0) < 150 || (meta.height || 0) < 150) {
        fs.unlinkSync(finalPath);
        continue;
      }

      // Escalar imágenes pequeñas a mínimo 1200px de ancho para que el texto sea legible
      if ((meta.width || 0) < 1200) {
        const escaladoPath = finalPath.replace('.png', '_hd.png');
        await sharp(finalPath)
          .resize({ width: 1200, withoutEnlargement: false })
          .png({ compressionLevel: 8 })
          .toFile(escaladoPath);
        fs.unlinkSync(finalPath);
        utiles.push(`/uploads/imagenes/${cursoId}/${path.basename(escaladoPath)}`);
      } else {
        utiles.push(`/uploads/imagenes/${cursoId}/${path.basename(finalPath)}`);
      }
    } catch {
      // ignorar archivos corruptos
    }
  }

  console.log('[IA] Imágenes útiles extraídas del PDF:', utiles.length);
  return utiles;
}

// ── Extrae contenido completo del PDF: descripción visual de páginas ──────────
async function extraerContenidoPDF(pdfBuffer, pdfPath) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'alumco-pdf-'));
  try {
    const imagePaths = await pdfToImages(pdfPath, tmpDir, 5);
    console.log('[IA] Páginas convertidas a imagen:', imagePaths.length);
    const descripciones = await Promise.all(imagePaths.map((img, i) =>
      describirImagen(img).then(desc => `--- Página ${i + 1} ---\n${desc}`)
    ));
    return descripciones.join('\n\n');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

const ollamaAgent = new Agent({ headersTimeout: 600000, bodyTimeout: 600000, connectTimeout: 30000 });

const upload = multer({
  dest: path.join(__dirname, '../../uploads/protocolos'),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Solo se permiten archivos PDF'), false);
  },
  limits: { fileSize: 20 * 1024 * 1024 }
});

async function llamarIA(prompt, timeoutMs = 480000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await undiciFetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      dispatcher: ollamaAgent,
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
        format: 'json',
        options: {
          num_ctx: 6144,
          num_predict: 4096,
          temperature: 0.1,
          repeat_penalty: 1.1
        }
      })
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Ollama HTTP ${response.status}: ${body}`);
    }
    const data = await response.json();
    return data.response;
  } finally {
    clearTimeout(timer);
  }
}

function parsearJSON(texto) {
  try { return JSON.parse(texto); } catch {}
  const match = texto?.match(/\{[\s\S]*\}/);
  if (match) { try { return JSON.parse(match[0]); } catch {} }
  throw new Error('La IA no devolvió un JSON válido');
}

// ─── POST /api/ia/generar-curso ────────────────────────────────────────────────
// Paso 1: genera SOLO estructura de módulos + preguntas (rápido ~30-60s)
router.post('/generar-curso', verificarToken, verificarRol('jefatura', 'admin_sede'), upload.single('protocolo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Archivo PDF requerido' });
  const { nombre_curso, area, profesor_id, contexto, num_modulos } = req.body;
  if (!nombre_curso) return res.status(400).json({ error: 'El nombre del curso es requerido' });

  try {
    console.log('[IA] Paso 1: archivo recibido', req.file.originalname);

    const pdfBuffer = fs.readFileSync(req.file.path);

    // ── Paso 2: moondream describe páginas del PDF (texto + imágenes) ──
    let textoPdf;
    console.log('[IA] Paso 2: convirtiendo PDF a imágenes y describiendo con moondream...');
    try {
      textoPdf = await extraerContenidoPDF(pdfBuffer, req.file.path);
      console.log('[IA] Paso 2 OK: moondream extrajo', textoPdf.length, 'chars');
    } catch (visionErr) {
      console.warn('[IA] Visión local falló, usando pdf-parse como fallback:', visionErr.message);
      const pdfData = await pdfParse(pdfBuffer);
      textoPdf = pdfData.text.trim();
      console.log('[IA] Fallback pdf-parse:', textoPdf.length, 'chars');
    }

    const totalChars = textoPdf.length;
    const modulosFijo = num_modulos ? parseInt(num_modulos) : null;
    const modulosMin = modulosFijo || (totalChars > 15000 ? 5 : totalChars > 8000 ? 4 : 3);
    const modulosMax = modulosFijo || (totalChars > 15000 ? 7 : totalChars > 8000 ? 6 : 4);
    const textoParaOllama = textoPdf.slice(0, 6000);
    console.log('[IA] Paso 2: chars totales:', totalChars, '→ enviando a Ollama:', textoParaOllama.length, '→ módulos:', modulosFijo ? `fijo: ${modulosFijo}` : `${modulosMin}-${modulosMax}`);

    const prompt = `Eres un experto en diseño instruccional y evaluación educativa para trabajadores de hogares de adultos mayores (ELEAM) en Chile. Tienes experiencia en taxonomía de Bloom y en la creación de preguntas de opción múltiple de alta calidad.

Analiza el protocolo y genera un curso completo en formato JSON:

{
  "modulos": [
    {
      "titulo": "string (título claro y específico del tema)",
      "descripcion": "string (4-6 oraciones: qué cubre el módulo, por qué es importante para el cuidado del adulto mayor, qué habilidades desarrollará el trabajador y cómo aplicarlo en su trabajo diario)",
      "preguntas": [
        {
          "texto": "string (pregunta clara, sin ambigüedades, que evalúe comprensión real o aplicación práctica)",
          "alternativas": [
            { "texto": "string", "correcta": false },
            { "texto": "string", "correcta": true },
            { "texto": "string", "correcta": false },
            { "texto": "string", "correcta": false }
          ]
        }
      ]
    }
  ]
}

Reglas:
- ${modulosFijo ? `Genera EXACTAMENTE ${modulosFijo} módulos, ni más ni menos.` : `Genera entre ${modulosMin} y ${modulosMax} módulos según la cantidad de temas del protocolo. NO generes menos de ${modulosMin}.`}
- Cada módulo cubre un tema diferente del protocolo (no repitas temas)
- Cada módulo: exactamente 4 preguntas de alternativas
- Preguntas variadas: comprensión, aplicación práctica y análisis
- Alternativas incorrectas plausibles (errores reales del personal, no respuestas absurdas)
- Sin "todas las anteriores" ni "ninguna de las anteriores"
- Descripciones de módulo: 3 oraciones claras para personal sin formación técnica
- Nombre del curso: ${nombre_curso}
- Contexto: ${contexto || 'protocolo de cuidado del adulto mayor'}

Responde SOLO con el JSON válido, sin texto adicional, sin bloques de código markdown.

PROTOCOLO:
${textoParaOllama}`;

    console.log('[IA] Paso 3: llamando a Ollama (max 8 min)...');
    const textoRespuesta = await llamarIA(prompt);
    console.log('[IA] Paso 4: respuesta recibida, chars:', textoRespuesta?.length);
    console.log('[IA] Raw (300 chars):', textoRespuesta?.slice(0, 300));

    const borrador = parsearJSON(textoRespuesta);
    if (!borrador.modulos && borrador.modules) borrador.modulos = borrador.modules;
    if (!Array.isArray(borrador.modulos) || borrador.modulos.length === 0) {
      console.error('[IA] Respuesta completa:', textoRespuesta);
      throw new Error('La IA no generó módulos válidos');
    }
    const modulosGenerados = borrador.modulos.length;
    console.log('[IA] Paso 5: módulos generados:', modulosGenerados);

    // ── Avisos sobre cantidad de módulos ──────────────────────────────────────
    const modulosAutomatico = totalChars > 15000 ? 6 : totalChars > 8000 ? 5 : 3;
    let aviso = null;
    if (modulosFijo && modulosGenerados < modulosFijo) {
      aviso = { tipo: 'menos', mensaje: `La IA generó ${modulosGenerados} módulo${modulosGenerados !== 1 ? 's' : ''} en lugar de ${modulosFijo} porque el protocolo no tiene suficiente contenido diferenciado para más. Considera subir un protocolo más extenso.` };
    } else if (modulosFijo && modulosFijo < modulosAutomatico - 1) {
      aviso = { tipo: 'mas', mensaje: `El protocolo tiene contenido para hasta ${modulosAutomatico} módulos. Si quieres aprovechar más el material, genera nuevamente con un número mayor.` };
    }

    const cursoResult = await pool.query(
      'INSERT INTO cursos (nombre, descripcion, area, profesor_id, publicado, generado_por_ia) VALUES ($1,$2,$3,$4,0,1)',
      [nombre_curso, `Generado desde: ${req.file.originalname}`, area || null, profesor_id || null]
    );
    const cursoId = cursoResult.lastID;
    console.log('[IA] Paso 6: curso insertado, id:', cursoId);

    for (let i = 0; i < borrador.modulos.length; i++) {
      const mod = borrador.modulos[i];
      await pool.query(
        'INSERT INTO modulos (curso_id, titulo, descripcion, orden) VALUES ($1,$2,$3,$4)',
        [cursoId, mod.titulo, mod.descripcion, i + 1]
      );
      for (const pregunta of (mod.preguntas || [])) {
        await pool.query(
          'INSERT INTO preguntas (curso_id, texto, alternativas) VALUES ($1,$2,$3)',
          [cursoId, pregunta.texto, JSON.stringify(pregunta.alternativas)]
        );
      }
    }

    const totalPreguntas = borrador.modulos.reduce((acc, m) => acc + (m.preguntas?.length || 0), 0);
    const nombreArchivo = req.file.originalname;
    const pdfPathGuardado = req.file.path;

    // Extraer imágenes embebidas del PDF y guardarlas permanentemente
    const imagenesProtocolo = await extraerImagenesPDF(pdfPathGuardado, cursoId);

    fs.unlinkSync(pdfPathGuardado);

    res.status(201).json({
      curso_id: cursoId,
      nombre: nombre_curso,
      generado_por_ia: true,
      modulos: borrador.modulos,
      preguntas_count: totalPreguntas,
      nombre_archivo: nombreArchivo,
      imagenes_protocolo: imagenesProtocolo,
      aviso,
      message: 'Borrador generado. Debe ser revisado por el profesor antes de publicarse.'
    });

  } catch (err) {
    console.error('[IA] Error completo:', err);
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'La IA tardó demasiado. Intenta con un PDF más pequeño o reinicia Ollama.' });
    }
    res.status(500).json({ error: err.message || 'Error al generar el curso con IA.' });
  }
});

// ─── POST /api/ia/generar-presentacion ────────────────────────────────────────
// Paso 2 (on-demand): genera la presentación de UN módulo específico
router.post('/generar-presentacion', verificarToken, verificarRol('jefatura', 'admin_sede', 'profesor'), async (req, res) => {
  const { titulo, descripcion, contexto } = req.body;
  if (!titulo) return res.status(400).json({ error: 'El título del módulo es requerido' });

  const prompt = `Genera una presentación educativa en JSON para trabajadores de un hogar de adultos mayores (ELEAM) en Chile.

Responde SOLO con este JSON exacto, sin texto adicional:

{
  "diapositivas": [
    {
      "tipo": "objetivos",
      "titulo": "Objetivos de aprendizaje",
      "lista": ["objetivo 1", "objetivo 2", "objetivo 3"]
    },
    {
      "tipo": "desempeno",
      "titulo": "Objetivo de desempeño",
      "descripcion": "Al finalizar este módulo, el trabajador será capaz de [acción concreta relacionada al módulo]"
    },
    {
      "tipo": "introduccion",
      "titulo": "Introducción",
      "texto": "párrafo introductorio de 3-4 oraciones que contextualice el tema para el personal del ELEAM"
    },
    {
      "tipo": "puntos_clave",
      "titulo": "Puntos claves del protocolo",
      "puntos": ["punto clave 1", "punto clave 2", "punto clave 3", "punto clave 4", "punto clave 5"]
    },
    {
      "tipo": "importante",
      "titulo": "Cosas importantes",
      "puntos": ["cosa importante 1", "cosa importante 2", "cosa importante 3"]
    },
    {
      "tipo": "conclusion",
      "titulo": "Conclusión",
      "texto": "párrafo de cierre que refuerce la importancia del tema para el cuidado del adulto mayor",
      "mensaje": "frase motivacional corta para el trabajador"
    }
  ]
}

Módulo: ${titulo}
Descripción: ${descripcion || titulo}
Contexto: ${contexto || 'cuidado del adulto mayor en ELEAM'}

Usa lenguaje simple y ejemplos reales del trabajo en hogares de adultos mayores.
Responde SOLO el JSON.`;

  try {
    console.log('[IA] Generando presentación para:', titulo);
    const textoRespuesta = await llamarIA(prompt);
    const presentacion = parsearJSON(textoRespuesta);
    // Normalizar: asegurar que diapositivas sea un array válido
    if (!Array.isArray(presentacion.diapositivas)) presentacion.diapositivas = []
    if (!presentacion.resumen || typeof presentacion.resumen !== 'object') presentacion.resumen = {}
    res.json({ presentacion });
  } catch (err) {
    console.error('[IA] Error presentación:', err.message);
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'La IA tardó demasiado. Intenta con un PDF más pequeño o reinicia Ollama.' });
    }
    res.status(500).json({ error: 'Error al generar la presentación.' });
  }
});

// ─── POST /api/ia/notificar-profesor ──────────────────────────────────────────
// Se llama solo cuando el usuario presiona "Enviar al profesor"
router.post('/notificar-profesor', verificarToken, verificarRol('jefatura', 'admin_sede'), async (req, res) => {
  const { curso_id, curso_nombre, profesor_id, modulos_count, preguntas_count, nombre_archivo } = req.body;
  if (!curso_nombre) return res.status(400).json({ error: 'Datos del curso incompletos' });

  let profesorEmail  = null;
  let profesorNombre = 'Profesor';
  if (profesor_id) {
    const result = await pool.query('SELECT nombre, email FROM usuarios WHERE id = $1', [profesor_id]);
    const profesor = result.rows[0];
    profesorEmail  = profesor?.email  || null;
    profesorNombre = profesor?.nombre || 'Profesor';
  }

  try {
    await notificarProfesor({
      profesorEmail,
      profesorNombre,
      cursoNombre:    curso_nombre,
      cursoId:        curso_id,
      modulosCount:   modulos_count,
      preguntasCount: preguntas_count,
      nombreArchivo:  nombre_archivo || 'protocolo.pdf',
      subidoPor:      req.usuario.nombre || 'Jefatura'
    });
    console.log('[MAIL] Notificación enviada para curso:', curso_nombre);
    res.json({ ok: true, mensaje: 'Notificación enviada al profesor' });
  } catch (err) {
    console.error('[MAIL] Error:', err.message);
    res.status(500).json({ error: 'No se pudo enviar el correo. Verifica la configuración de email.' });
  }
});

module.exports = router;
