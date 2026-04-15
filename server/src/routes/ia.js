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
const { uploadBuffer } = require('../config/s3');

const OLLAMA_URL        = process.env.OLLAMA_URL        || 'http://localhost:11434';
const OLLAMA_MODEL      = process.env.OLLAMA_MODEL      || 'gemma3:4b';
const VISION_MODEL      = process.env.OLLAMA_VISION_MODEL || 'moondream';
const OPENROUTER_KEY   = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'nvidia/nemotron-3-super-120b-a12b:free';
const GEMINI_KEY       = process.env.GEMINI_API_KEY;
const GEMINI_MODEL     = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const OPENROUTER_URL   = 'https://openrouter.ai/api/v1/chat/completions';

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

// ── Describe una imagen con Gemini vision, OpenRouter o moondream vía Ollama ──
async function describirImagen(imagePath) {
  const imageBase64 = fs.readFileSync(imagePath).toString('base64');
  const promptVision = 'Describe detalladamente el contenido de esta imagen de un protocolo médico o de cuidado. Incluye: texto visible, tablas, posiciones corporales mostradas en fotos, procedimientos, horarios o esquemas. Responde en español.';

  if (GEMINI_KEY) {
    try {
      // Gemini vision no usa responseMimeType JSON para descripciones de imagen
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`;
      const response = await undiciFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [
            { inline_data: { mime_type: 'image/png', data: imageBase64 } },
            { text: promptVision }
          ]}],
          generationConfig: { temperature: 0.1, maxOutputTokens: 1000 }
        })
      });
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } catch (e) {
      console.warn('[IA] Gemini vision falló:', e.message);
    }
  }

  if (OPENROUTER_KEY) {
    const response = await undiciFetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_KEY}`,
        'HTTP-Referer': 'https://alumco.cl',
        'X-Title': 'ALUMCO - Generador de Cursos'
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.2-11b-vision-instruct:free',
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:image/png;base64,${imageBase64}` } },
            { type: 'text', text: promptVision }
          ]
        }],
        max_tokens: 1000
      })
    });
    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  // Fallback: moondream vía Ollama (local)
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

// ── Extrae imágenes embebidas del PDF filtrando logos repetidos y sube al bucket ─
async function extraerImagenesPDF(pdfPath, cursoId) {
  const crypto = require('crypto');
  const sharp = require('sharp');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `alumco-imgs-${cursoId}-`));

  try {
    const outPrefix = path.join(tmpDir, 'img');
    await new Promise((resolve) => {
      execFile('pdfimages', ['-png', pdfPath, outPrefix], (err) => {
        if (err) console.warn('[IA] pdfimages error:', err.message);
        resolve();
      });
    });

    const archivos = fs.readdirSync(tmpDir)
      .filter(f => f.endsWith('.png') || f.endsWith('.ppm') || f.endsWith('.jpg'))
      .sort();

    // Calcular MD5 de cada archivo para detectar imágenes repetidas (logos)
    const hashCount = {};
    const fileHashes = {};
    for (const archivo of archivos) {
      try {
        const buf = fs.readFileSync(path.join(tmpDir, archivo));
        const h = crypto.createHash('md5').update(buf).digest('hex');
        fileHashes[archivo] = h;
        hashCount[h] = (hashCount[h] || 0) + 1;
      } catch {}
    }

    const utiles = [];
    for (const archivo of archivos) {
      const fullPath = path.join(tmpDir, archivo);
      try {
        const stat = fs.statSync(fullPath);
        // Descartar imágenes pequeñas (< 8 KB) o repetidas más de 2 veces (logo de cada página)
        if (stat.size < 8 * 1024 || (hashCount[fileHashes[archivo]] || 0) > 2) continue;

        let pngBuffer;
        if (archivo.endsWith('.ppm')) {
          pngBuffer = await sharp(fullPath).png().toBuffer();
        } else {
          pngBuffer = fs.readFileSync(fullPath);
        }

        const meta = await sharp(pngBuffer).metadata();
        if ((meta.width || 0) < 100 || (meta.height || 0) < 100) continue;

        const key = `imagenes/${cursoId}/${archivo.replace('.ppm', '.png')}`;
        const url = await uploadBuffer(pngBuffer, key, 'image/png');
        utiles.push(url);
      } catch {}
    }

    console.log('[IA] Imágenes count:', utiles.length);
    console.log('[IA] Imágenes URL[0]:', utiles[0]);
    return utiles;
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
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

async function llamarOpenRouter(prompt, timeoutMs = 90000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await undiciFetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_KEY}`,
        'HTTP-Referer': 'https://alumco.cl',
        'X-Title': 'ALUMCO - Generador de Cursos'
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [
          {
            role: 'system',
            content: 'Eres un experto en diseño instruccional. Tu tarea es SOLO generar el JSON solicitado. NO expliques tu razonamiento. NO agregues texto antes o después. Responde ÚNICAMENTE con el objeto JSON.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 12000,
        stream: false,
        response_format: { type: 'json_object' }
      })
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`OpenRouter HTTP ${response.status}: ${body}`);
    }
    const data = await response.json();
    const finishReason = data.choices?.[0]?.finish_reason;
    const content = data.choices?.[0]?.message?.content || '';
    const reasoning = data.choices?.[0]?.message?.reasoning || '';
    console.log(`[IA] OpenRouter finish_reason=${finishReason} tokens=${data.usage?.total_tokens || '?'}`);
    const candidato = content.includes('{') ? content : (reasoning.includes('{') ? reasoning : '');
    if (!candidato) throw new Error(`OpenRouter no devolvió JSON (finish_reason: ${finishReason})`);
    if (finishReason === 'length') {
      console.warn('[IA] OpenRouter cortó la respuesta por longitud — puede estar incompleta');
    }
    return candidato;
  } finally {
    clearTimeout(timer);
  }
}

async function llamarOllama(prompt, timeoutMs = 480000) {
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
        options: { num_ctx: 6144, num_predict: 4096, temperature: 0.1, repeat_penalty: 1.1 }
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

async function llamarGemini(prompt, imageBase64 = null, timeoutMs = 120000, _intento = 1) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`;
  try {
    const parts = [];
    if (imageBase64) parts.push({ inline_data: { mime_type: 'image/png', data: imageBase64 } });
    parts.push({ text: prompt });
    const response = await undiciFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingBudget: 0 }
        }
      })
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      // 503 = sobrecarga temporal → reintentar hasta 3 veces con espera
      if (response.status === 503 && _intento < 3) {
        const espera = _intento * 8000;
        console.log(`[IA] Gemini 503, reintento ${_intento}/3 en ${espera/1000}s...`);
        await new Promise(r => setTimeout(r, espera));
        return llamarGemini(prompt, imageBase64, timeoutMs, _intento + 1);
      }
      throw new Error(`Gemini HTTP ${response.status}: ${body}`);
    }
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Gemini no devolvió contenido');
    console.log(`[IA] Gemini OK tokens=${data.usageMetadata?.totalTokenCount || '?'}`);
    return text;
  } finally {
    clearTimeout(timer);
  }
}

async function llamarIA(prompt, timeoutMs = 480000) {
  if (GEMINI_KEY) {
    console.log(`[IA] Usando Gemini → ${GEMINI_MODEL}`);
    return await llamarGemini(prompt, null, timeoutMs);
  }
  if (OPENROUTER_KEY) {
    console.log(`[IA] Usando OpenRouter → ${OPENROUTER_MODEL}`);
    return await llamarOpenRouter(prompt, timeoutMs);
  }
  console.log(`[IA] Usando Ollama local → ${OLLAMA_MODEL}`);
  return await llamarOllama(prompt, timeoutMs);
}

function parsearJSON(texto) {
  if (!texto) throw new Error('La IA no devolvió contenido');
  // Eliminar bloques <think>...</think> de modelos de razonamiento
  let t = texto.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  // Intento directo
  try { return JSON.parse(t); } catch {}
  // Bloque de código markdown ```json ... ```
  const mdMatch = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (mdMatch) { try { return JSON.parse(mdMatch[1].trim()); } catch {} }
  // Buscar desde cada { balanceando llaves (maneja texto de razonamiento previo)
  let pos = 0;
  while ((pos = t.indexOf('{', pos)) !== -1) {
    let depth = 0, end = -1;
    for (let i = pos; i < t.length; i++) {
      if (t[i] === '{') depth++;
      else if (t[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end !== -1) { try { return JSON.parse(t.slice(pos, end + 1)); } catch {} }
    pos++;
  }
  throw new Error('La IA no devolvió un JSON válido');
}

// ── Helper: genera slides PPT para un módulo ─────────────────────────────────
async function generarPPTModulo(titulo, descripcion) {
  const prompt = `Genera una presentación educativa COMPLETA en JSON para trabajadores de un hogar de adultos mayores (ELEAM) en Chile.
Responde SOLO con este JSON exacto, sin texto adicional:
{"diapositivas":[
  {"tipo":"objetivos","titulo":"Objetivos de aprendizaje","lista":["Al finalizar podrás... 1","Al finalizar podrás... 2","Al finalizar podrás... 3"]},
  {"tipo":"desempeno","titulo":"Objetivo de desempeño","descripcion":"Al finalizar este módulo, el trabajador será capaz de [acción concreta]"},
  {"tipo":"introduccion","titulo":"Introducción","texto":"párrafo de 3-4 oraciones que contextualice el tema"},
  {"tipo":"seccion","titulo":"título del primer tema","texto":"explicación en 3-4 oraciones","puntos":["punto 1","punto 2","punto 3"]},
  {"tipo":"seccion","titulo":"título del segundo tema","texto":"explicación en 3-4 oraciones","puntos":["punto 1","punto 2","punto 3"]},
  {"tipo":"puntos_clave","titulo":"Puntos claves","puntos":["clave 1","clave 2","clave 3","clave 4"]},
  {"tipo":"importante","titulo":"Cosas importantes","puntos":["importante 1","importante 2","importante 3"]},
  {"tipo":"conclusion","titulo":"Conclusión","texto":"párrafo de cierre","mensaje":"frase motivacional corta"}
]}

Módulo: ${titulo}
Descripción: ${descripcion || titulo}
Responde SOLO el JSON.`;
  for (let intento = 1; intento <= 2; intento++) {
    try {
      const resp = await llamarIA(prompt, OPENROUTER_KEY ? 90000 : 300000);
      const parsed = parsearJSON(resp);
      if (!Array.isArray(parsed.diapositivas) || parsed.diapositivas.length === 0) continue;
      return parsed;
    } catch (e) {
      console.warn(`[IA] Error generando PPT para "${titulo}" (intento ${intento}/2):`, e.message);
      if (intento < 2) await new Promise(r => setTimeout(r, 2000)); // 2s antes del reintento
    }
  }
  return null;
}

// ─── POST /api/ia/generar-curso ────────────────────────────────────────────────
// Paso 1: genera SOLO estructura de módulos + preguntas (rápido ~30-60s)
router.post('/generar-curso', verificarToken, verificarRol('jefatura', 'admin_sede'), upload.single('protocolo'), async (req, res) => {
  const { nombre_curso, area, profesor_id, contexto, num_modulos, protocolo_id } = req.body;

  // Permite usar protocolo guardado en lugar de subir un nuevo PDF
  if (!req.file && protocolo_id) {
    const result = await pool.query('SELECT * FROM protocolos WHERE id = $1', [protocolo_id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Protocolo no encontrado' });
    req.file = { path: result.rows[0].archivo_path, originalname: result.rows[0].archivo_nombre, _fromLib: true };
  }

  if (!req.file) return res.status(400).json({ error: 'Archivo PDF requerido' });

  if (!nombre_curso) return res.status(400).json({ error: 'El nombre del curso es requerido' });

  try {
    console.log('[IA] Paso 1: archivo recibido', req.file.originalname);

    // Si el archivo viene del bucket S3 (URL), descargarlo a un temp local
    if (req.file._fromLib && req.file.path.startsWith('http')) {
      console.log('[IA] Descargando protocolo desde S3:', req.file.path);
      const resp = await undiciFetch(req.file.path);
      if (!resp.ok) throw new Error(`No se pudo descargar el protocolo: HTTP ${resp.status}`);
      const arrayBuf = await resp.arrayBuffer();
      const tmpPath = path.join(os.tmpdir(), `protocolo_${Date.now()}.pdf`);
      fs.writeFileSync(tmpPath, Buffer.from(arrayBuf));
      req.file.path = tmpPath;
      req.file._tmpDownload = true;
      console.log('[IA] Protocolo descargado a:', tmpPath);
    }

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
    const limiteChars = OPENROUTER_KEY ? 40000 : 6000;
    const textoParaOllama = textoPdf.slice(0, limiteChars);
    console.log('[IA] Paso 2: chars totales:', totalChars, '→ enviando:', textoParaOllama.length, '→ módulos:', modulosFijo ? `fijo: ${modulosFijo}` : `${modulosMin}-${modulosMax}`);

    // ── Paso 3a: generar solo los módulos (sin preguntas) ────────────────────
    // Separado para no exceder el contexto del modelo con protocolo + preguntas juntos
    const promptModulos = `Analiza el siguiente protocolo de cuidado del adulto mayor y genera los módulos de un curso de capacitación.

Responde ÚNICAMENTE con este JSON (sin texto adicional):
{"modulos":[{"titulo":"string","descripcion":"string (2-3 oraciones claras)"}]}

Reglas:
- ${modulosFijo ? `EXACTAMENTE ${modulosFijo} módulos.` : `Entre ${modulosMin} y ${modulosMax} módulos según los temas del protocolo.`}
- Cada módulo cubre un tema distinto, sin repetir.
- Títulos claros y específicos.
- Contexto: ${contexto || 'protocolo de cuidado del adulto mayor en ELEAM Chile'}
- Curso: ${nombre_curso}

PROTOCOLO:
${textoParaOllama}`;

    console.log('[IA] Paso 3: generando módulos...');
    const respModulos = await llamarIA(promptModulos);
    console.log('[IA] Raw módulos (1000 chars):', respModulos?.slice(0, 1000));
    const borradorModulos = parsearJSON(respModulos);
    if (!Array.isArray(borradorModulos.modulos) || borradorModulos.modulos.length === 0) {
      throw new Error('La IA no generó módulos válidos');
    }

    // ── Paso 3b: generar preguntas para cada módulo ───────────────────────────
    console.log('[IA] Paso 3b: generando preguntas para', borradorModulos.modulos.length, 'módulos...');
    const modulos = await Promise.all(borradorModulos.modulos.map(async (mod) => {
      const promptPreguntas = `Genera 4 preguntas de opción múltiple para el módulo "${mod.titulo}" de un curso sobre: ${mod.descripcion}

Responde ÚNICAMENTE con este JSON:
{"preguntas":[{"texto":"string","alternativas":[{"texto":"string","correcta":false},{"texto":"string","correcta":true},{"texto":"string","correcta":false},{"texto":"string","correcta":false}]}]}

Reglas:
- Exactamente 4 preguntas, cada una con exactamente 4 alternativas.
- Solo una alternativa correcta por pregunta.
- Preguntas de comprensión y aplicación práctica para personal de cuidado.
- Alternativas incorrectas plausibles (errores reales del personal).
- Sin "todas las anteriores" ni "ninguna de las anteriores".`;

      try {
        const respPreg = await llamarIA(promptPreguntas);
        const parsed = parsearJSON(respPreg);
        return { ...mod, preguntas: parsed.preguntas || [] };
      } catch (e) {
        console.error(`[IA] Error generando preguntas para "${mod.titulo}":`, e.message);
        return { ...mod, preguntas: [] };
      }
    }));

    // ── Paso 3c: generar PPT para cada módulo (secuencial para evitar rate limit) ─
    console.log('[IA] Paso 3c: generando presentaciones PPT...');
    const modulosConPPT = [];
    for (const mod of modulos) {
      console.log(`[IA] Generando PPT: "${mod.titulo}"`);
      const presentacion = await generarPPTModulo(mod.titulo, mod.descripcion);
      modulosConPPT.push({ ...mod, presentacion });
    }

    const borrador = { modulos: modulosConPPT };
    const modulosGenerados = borrador.modulos.length;
    console.log('[IA] Paso 5: módulos generados:', modulosGenerados);

    // ── Avisos sobre cantidad de módulos ──────────────────────────────────────
    // Estimación de cuántos módulos "aguanta" el contenido según longitud del texto
    const modulosOptimo = totalChars > 12000 ? 7
      : totalChars > 6000  ? 6
      : totalChars > 3500  ? 5
      : totalChars > 2000  ? 4
      : totalChars > 1000  ? 3
      : 2;
    console.log(`[IA] totalChars=${totalChars}, modulosOptimo=${modulosOptimo}, modulosFijo=${modulosFijo}, modulosGenerados=${modulosGenerados}`);
    let aviso = null;
    if (modulosFijo) {
      if (modulosFijo > modulosOptimo) {
        aviso = {
          tipo: 'menos',
          mensaje: `Pediste ${modulosFijo} módulos pero el protocolo tiene contenido para ${modulosOptimo} como máximo. Algunos módulos pueden quedar con información escasa o repetida. Considera usar un documento más extenso.`
        };
      } else if (modulosFijo < modulosOptimo - 1) {
        aviso = {
          tipo: 'mas',
          mensaje: `El protocolo tiene información suficiente para hasta ${modulosOptimo} módulos. Genera nuevamente eligiendo un número mayor para aprovechar mejor el material.`
        };
      }
    }

    const cursoResult = await pool.query(
      'INSERT INTO cursos (nombre, descripcion, area, profesor_id, publicado, generado_por_ia) VALUES ($1,$2,$3,$4,0,1)',
      [nombre_curso, `Generado desde: ${req.file.originalname}`, area || null, profesor_id || null]
    );
    const cursoId = cursoResult.lastID;
    console.log('[IA] Paso 6: curso insertado, id:', cursoId);

    const modulosConId = [];
    for (let i = 0; i < borrador.modulos.length; i++) {
      const mod = borrador.modulos[i];
      const insM = await pool.query(
        'INSERT INTO modulos (curso_id, titulo, descripcion, contenido_presentacion, tipo, orden) VALUES ($1,$2,$3,$4,$5,$6)',
        [cursoId, (mod.titulo || '').slice(0, 190), mod.descripcion,
         mod.presentacion ? JSON.stringify(mod.presentacion) : null,
         'ppt', i + 1]
      );
      modulosConId.push({ ...mod, id: insM.lastID });
      for (const pregunta of (mod.preguntas || [])) {
        // Saltar preguntas malformadas que Ollama devuelve sin alternativas
        if (!pregunta.texto || !Array.isArray(pregunta.alternativas) || pregunta.alternativas.length === 0) continue;
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

    // Borrar el PDF si fue upload temporal o descarga temporal desde S3
    if (!req.file._fromLib || req.file._tmpDownload) {
      if (fs.existsSync(pdfPathGuardado)) fs.unlinkSync(pdfPathGuardado);
    }

    res.status(201).json({
      curso_id: cursoId,
      nombre: nombre_curso,
      generado_por_ia: true,
      modulos: modulosConId,
      preguntas_count: totalPreguntas,
      nombre_archivo: nombreArchivo,
      imagenes_protocolo: imagenesProtocolo,
      aviso,
      modulosOptimo,
      totalChars,
      message: 'Borrador generado. Debe ser revisado por el profesor antes de publicarse.'
    });

  } catch (err) {
    console.error('[IA] Error completo:', err);
    if (req.file?.path && (!req.file._fromLib || req.file._tmpDownload) && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
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

  const prompt = `Genera una presentación educativa COMPLETA en JSON para trabajadores de un hogar de adultos mayores (ELEAM) en Chile.
Incluye objetivos, contenido educativo detallado y cierre. Usa lenguaje simple y ejemplos del trabajo diario.

Responde SOLO con este JSON exacto, sin texto adicional:

{
  "diapositivas": [
    {
      "tipo": "objetivos",
      "titulo": "Objetivos de aprendizaje",
      "lista": ["Al finalizar podrás... 1", "Al finalizar podrás... 2", "Al finalizar podrás... 3"]
    },
    {
      "tipo": "desempeno",
      "titulo": "Objetivo de desempeño",
      "descripcion": "Al finalizar este módulo, el trabajador será capaz de [acción concreta y medible]"
    },
    {
      "tipo": "introduccion",
      "titulo": "Introducción",
      "texto": "párrafo de 3-4 oraciones que contextualice el tema y su importancia en el ELEAM"
    },
    {
      "tipo": "seccion",
      "titulo": "título del primer tema de contenido",
      "texto": "explicación clara en 3-4 oraciones",
      "puntos": ["punto práctico 1", "punto práctico 2", "punto práctico 3"]
    },
    {
      "tipo": "seccion",
      "titulo": "título del segundo tema de contenido",
      "texto": "explicación clara en 3-4 oraciones",
      "puntos": ["punto práctico 1", "punto práctico 2", "punto práctico 3"]
    },
    {
      "tipo": "seccion",
      "titulo": "título del tercer tema de contenido",
      "texto": "explicación clara en 3-4 oraciones",
      "puntos": ["punto práctico 1", "punto práctico 2"]
    },
    {
      "tipo": "caso_practico",
      "titulo": "Caso práctico",
      "descripcion": "descripción de una situación real que puede ocurrir en el ELEAM",
      "pasos": ["paso 1 de cómo actuar", "paso 2", "paso 3", "paso 4"]
    },
    {
      "tipo": "puntos_clave",
      "titulo": "Puntos claves del protocolo",
      "puntos": ["punto clave 1", "punto clave 2", "punto clave 3", "punto clave 4"]
    },
    {
      "tipo": "importante",
      "titulo": "Cosas importantes",
      "puntos": ["cosa importante 1", "cosa importante 2", "cosa importante 3"]
    },
    {
      "tipo": "conclusion",
      "titulo": "Conclusión",
      "texto": "párrafo de cierre que refuerce la importancia del tema",
      "mensaje": "frase motivacional corta para el trabajador"
    }
  ]
}

Módulo: ${titulo}
Descripción: ${descripcion || titulo}
Contexto: ${contexto || 'cuidado del adulto mayor en ELEAM'}

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

// ─── POST /api/ia/modulo/:id/generar-ppt ──────────────────────────────────────
// Genera y guarda el PPT de un módulo existente (accesible a todos los roles)
router.post('/modulo/:id/generar-ppt', verificarToken, async (req, res) => {
  try {
    const mod = await pool.query('SELECT id, titulo, descripcion, contenido_presentacion FROM modulos WHERE id = $1', [req.params.id]);
    if (!mod.rows.length) return res.status(404).json({ error: 'Módulo no encontrado' });
    const m = mod.rows[0];
    // Si ya tiene contenido, devolverlo sin regenerar
    if (m.contenido_presentacion) {
      const cp = typeof m.contenido_presentacion === 'string' ? JSON.parse(m.contenido_presentacion) : m.contenido_presentacion;
      return res.json({ presentacion: cp });
    }
    const presentacion = await generarPPTModulo(m.titulo, m.descripcion);
    if (!presentacion) return res.status(500).json({ error: 'No se pudo generar la presentación' });
    await pool.query('UPDATE modulos SET contenido_presentacion = $1 WHERE id = $2', [JSON.stringify(presentacion), m.id]);
    res.json({ presentacion });
  } catch (err) {
    console.error('[IA] Error generar-ppt módulo:', err.message);
    res.status(500).json({ error: 'Error al generar la presentación' });
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

// ─── POST /api/ia/generar-contenido ───────────────────────────────────────────
// Genera contenido de aprendizaje para un módulo específico
router.post('/generar-contenido', verificarToken, verificarRol('jefatura', 'admin_sede', 'profesor'), async (req, res) => {
  const { modulo_id, titulo, descripcion, contexto } = req.body;
  if (!titulo) return res.status(400).json({ error: 'El título del módulo es requerido' });

  const prompt = `Genera contenido educativo detallado en JSON para trabajadores de un hogar de adultos mayores (ELEAM) en Chile.
El contenido debe ser claro, práctico y adaptado a personal sin formación técnica universitaria.

Responde SOLO con este JSON exacto, sin texto adicional:

{
  "introduccion": "párrafo de 3-4 oraciones que contextualice el tema y su importancia en el trabajo diario",
  "secciones": [
    {
      "titulo": "título de la sección",
      "texto": "explicación clara de 3-5 oraciones",
      "puntos": ["punto práctico 1", "punto práctico 2", "punto práctico 3"]
    }
  ],
  "caso_practico": {
    "descripcion": "descripción de una situación real que puede ocurrir en el ELEAM",
    "pasos": ["paso 1 de cómo actuar", "paso 2", "paso 3", "paso 4"]
  },
  "recuerda": ["punto clave 1 para recordar", "punto clave 2", "punto clave 3"]
}

Módulo: ${titulo}
Descripción: ${descripcion || titulo}
Contexto: ${contexto || 'cuidado del adulto mayor en ELEAM'}

Genera entre 3 y 4 secciones con temas distintos del módulo.
Usa lenguaje simple, ejemplos concretos del trabajo diario. Responde SOLO el JSON.`;

  try {
    const textoRespuesta = await llamarIA(prompt, 300000);
    const contenido = parsearJSON(textoRespuesta);

    if (modulo_id) {
      await pool.query('UPDATE modulos SET contenido_aprendizaje = ? WHERE id = ?',
        [JSON.stringify(contenido), modulo_id]);
    }

    res.json({ contenido });
  } catch (err) {
    if (err.name === 'AbortError') return res.status(504).json({ error: 'La IA tardó demasiado.' });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
