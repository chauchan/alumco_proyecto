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
const { uploadBuffer, s3, BUCKET, keyFromUrl, generateSignedUrl } = require('../config/s3');
const { GetObjectCommand } = require('@aws-sdk/client-s3');
const { auditar } = require('../utils/audit');

const OLLAMA_URL        = process.env.OLLAMA_URL        || 'http://localhost:11434';
const OLLAMA_MODEL      = process.env.OLLAMA_MODEL      || 'gemma3:4b';
const VISION_MODEL      = process.env.OLLAMA_VISION_MODEL || 'moondream';
const OPENROUTER_KEY   = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'nvidia/nemotron-3-super-120b-a12b:free';
const OPENROUTER_URL   = 'https://openrouter.ai/api/v1/chat/completions';

// Resuelve el nombre de área a su id (inserta si no existe)
async function resolveAreaId(nombre) {
  if (!nombre) return null;
  const { rows } = await pool.query('SELECT id FROM areas WHERE nombre = ?', [nombre]);
  if (rows.length) return rows[0].id;
  const { lastID } = await pool.query('INSERT INTO areas (nombre) VALUES (?)', [nombre]);
  return lastID;
}

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

// ── Describe una imagen con OpenRouter o moondream vía Ollama ────────────────
async function describirImagen(imagePath) {
  const imageBase64 = fs.readFileSync(imagePath).toString('base64');
  const promptVision = 'Describe detalladamente el contenido de esta imagen de un protocolo médico o de cuidado. Incluye: texto visible, tablas, posiciones corporales mostradas en fotos, procedimientos, horarios o esquemas. Responde en español.';

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
        if (stat.size < 8 * 1024 || (hashCount[fileHashes[archivo]] || 0) > 2) {
          fs.unlinkSync(fullPath); continue;
        }
        let finalPath = fullPath;
        if (archivo.endsWith('.ppm')) {
          finalPath = fullPath.replace('.ppm', '.png');
          await sharp(fullPath).png().toFile(finalPath);
          fs.unlinkSync(fullPath);
        }
        const meta = await sharp(finalPath).metadata();
        if ((meta.width || 0) < 100 || (meta.height || 0) < 100) {
          fs.unlinkSync(finalPath); continue;
        }
        // Subir a S3 en lugar de guardar localmente (Railway filesystem es efímero)
        const buffer = fs.readFileSync(finalPath);
        const s3Key = `imagenes-curso/${cursoId}/${path.basename(finalPath)}`;
        const url = await uploadBuffer(buffer, s3Key, 'image/png');
        utiles.push(url);
      } catch (e) {
        console.warn('[IA] Error subiendo imagen a S3:', e.message);
      }
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

// ── Resuelve el profesor asignado automáticamente si no se provee uno ─────────
async function resolverProfesor(profesorIdOverride, sedeObjetivo, estamentos) {
  if (profesorIdOverride) {
    const { rows } = await pool.query(
      'SELECT id, nombre, email FROM usuarios WHERE id = ? AND activo = 1', [profesorIdOverride]
    );
    return rows[0] || null;
  }

  const sinEstamentos = !Array.isArray(estamentos) || !estamentos.length;

  async function conMenorCarga(candidatos) {
    if (!candidatos.length) return null;
    if (candidatos.length === 1) return candidatos[0];
    const ph = candidatos.map((_, i) => `$${i + 1}`).join(',');
    const { rows: cnts } = await pool.query(
      `SELECT profesor_id, COUNT(*) AS n FROM cursos
       WHERE profesor_id IN (${ph}) AND publicado = 0 AND generado_por_ia = 1
       GROUP BY profesor_id`,
      candidatos.map(r => r.id)
    );
    const cmap = {};
    for (const c of cnts) cmap[c.profesor_id] = parseInt(c.n);
    return [...candidatos].sort((a, b) => (cmap[a.id] || 0) - (cmap[b.id] || 0))[0];
  }

  // 1. Profesores en la sede con intersección de estamento
  if (sedeObjetivo && !sinEstamentos) {
    const ph = estamentos.map(() => '?').join(',');
    const { rows } = await pool.query(`
      SELECT DISTINCT u.id, u.nombre, u.email FROM usuarios u
      JOIN estamentos e ON u.estamento_id = e.id
      WHERE u.rol = 'profesor' AND u.activo = 1 AND u.sede_id = ?
        AND e.nombre IN (${ph})
    `, [sedeObjetivo, ...estamentos]);
    if (rows.length) return conMenorCarga(rows);
  }

  // 2. Cualquier profesor con intersección de estamento (cualquier sede)
  if (!sinEstamentos) {
    const ph = estamentos.map(() => '?').join(',');
    const { rows } = await pool.query(`
      SELECT DISTINCT u.id, u.nombre, u.email FROM usuarios u
      JOIN estamentos e ON u.estamento_id = e.id
      WHERE u.rol = 'profesor' AND u.activo = 1 AND e.nombre IN (${ph})
    `, estamentos);
    if (rows.length) return conMenorCarga(rows);
  }

  // 3. Cualquier profesor en la sede (sin filtro de estamento)
  if (sedeObjetivo) {
    const { rows } = await pool.query(
      "SELECT id, nombre, email FROM usuarios WHERE rol = 'profesor' AND activo = 1 AND sede_id = ?",
      [sedeObjetivo]
    );
    if (rows.length) return conMenorCarga(rows);
  }

  // 4. Fallback: primer usuario con rol jefatura
  const { rows: jefes } = await pool.query(
    "SELECT id, nombre, email FROM usuarios WHERE rol = 'jefatura' AND activo = 1 LIMIT 1"
  );
  if (jefes.length) {
    console.warn('[IA] resolverProfesor: sin match de profesor — asignando a jefatura:', jefes[0].nombre);
    return jefes[0];
  }

  return null;
}

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


async function llamarIA(prompt, timeoutMs = 480000) {
  if (OPENROUTER_KEY) {
    console.log(`[IA] Usando OpenRouter → ${OPENROUTER_MODEL}`);
    return await llamarOpenRouter(prompt, timeoutMs);
  }
  console.log(`[IA] Usando Ollama local → ${OLLAMA_MODEL}`);
  return await llamarOllama(prompt, timeoutMs);
}

function parsearJSON(texto) {
  if (!texto) throw new Error('La IA no devolvió contenido');
  let t = texto.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  try { return JSON.parse(t); } catch {}
  const mdMatch = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (mdMatch) { try { return JSON.parse(mdMatch[1].trim()); } catch {} }
  const candidatos = [...t.matchAll(/\{[\s\S]*?\}/g)].map(m => m[0]).sort((a,b) => b.length - a.length);
  for (const c of candidatos) { try { return JSON.parse(c); } catch {} }
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
      if (intento < 2) await new Promise(r => setTimeout(r, 2000));
    }
  }
  return null;
}

// ─── POST /api/ia/generar-curso ────────────────────────────────────────────────
router.post('/generar-curso', verificarToken, verificarRol('jefatura', 'admin_sede'), upload.single('protocolo'), async (req, res) => {
  const { nombre_curso, area, profesor_id, contexto, num_modulos, protocolo_id, sede_objetivo, estamentos } = req.body;

  if (!req.file && protocolo_id) {
    const result = await pool.query('SELECT * FROM protocolos WHERE id = ?', [protocolo_id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Protocolo no encontrado' });
    req.file = { path: result.rows[0].archivo_path, originalname: result.rows[0].archivo_nombre, _fromLib: true };
  }

  if (!req.file) return res.status(400).json({ error: 'Archivo PDF requerido' });
  if (!nombre_curso) return res.status(400).json({ error: 'El nombre del curso es requerido' });

  try {
    console.log('[IA] Paso 1: archivo recibido', req.file.originalname);

    // Si el archivo viene del bucket S3 (URL), descargarlo con el SDK autenticado
    if (req.file._fromLib && req.file.path.startsWith('http')) {
      console.log('[IA] Descargando protocolo desde S3:', req.file.path);
      const key = keyFromUrl(req.file.path);
      if (!key) throw new Error(`No se pudo extraer la key S3 de la URL: ${req.file.path}`);
      const s3Resp = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
      const chunks = [];
      for await (const chunk of s3Resp.Body) chunks.push(chunk);
      const tmpPath = path.join(os.tmpdir(), `protocolo_${Date.now()}.pdf`);
      fs.writeFileSync(tmpPath, Buffer.concat(chunks));
      req.file.path = tmpPath;
      req.file._tmpDownload = true;
      console.log('[IA] Protocolo descargado a:', tmpPath);
    }

    const pdfBuffer = fs.readFileSync(req.file.path);

    let textoPdf;
    console.log('[IA] Paso 2: convirtiendo PDF a imágenes y describiendo con moondream...');
    try {
      textoPdf = await extraerContenidoPDF(pdfBuffer, req.file.path);
      console.log('[IA] Paso 2 OK: visión extrajo', textoPdf.length, 'chars');
    } catch (visionErr) {
      console.warn('[IA] Visión falló, usando pdf-parse:', visionErr.message);
      textoPdf = '';
    }
    // Si la visión extrajo poco texto, completar con pdf-parse
    if (textoPdf.length < 500) {
      console.log('[IA] Extracción visual insuficiente, usando pdf-parse...');
      try {
        const pdfData = await pdfParse(pdfBuffer);
        const pdfText = pdfData.text.trim();
        textoPdf = pdfText.length > textoPdf.length ? pdfText : textoPdf;
        console.log('[IA] pdf-parse extrajo', pdfText.length, 'chars');
      } catch (parseErr) {
        console.warn('[IA] pdf-parse también falló:', parseErr.message);
      }
    }

    const totalChars = textoPdf.length;
    const modulosFijo = num_modulos ? parseInt(num_modulos) : null;
    const modulosMin = modulosFijo || (totalChars > 15000 ? 5 : totalChars > 8000 ? 4 : 3);
    const modulosMax = modulosFijo || (totalChars > 15000 ? 7 : totalChars > 8000 ? 6 : 4);
    const limiteChars = OPENROUTER_KEY ? 40000 : 6000;
    const textoParaOllama = textoPdf.slice(0, limiteChars);
    console.log('[IA] Paso 2: chars totales:', totalChars, '→ enviando:', textoParaOllama.length, '→ módulos:', modulosFijo ? `fijo: ${modulosFijo}` : `${modulosMin}-${modulosMax}`);

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
    if (!Array.isArray(borradorModulos.modulos) || borradorModulos.modulos.length === 0)
      throw new Error('La IA no generó módulos válidos');

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

    const modulosOptimo = totalChars > 12000 ? 7
      : totalChars > 6000  ? 6
      : totalChars > 3500  ? 5
      : totalChars > 2000  ? 4
      : totalChars > 1000  ? 3 : 2;
    console.log(`[IA] totalChars=${totalChars}, modulosOptimo=${modulosOptimo}, modulosFijo=${modulosFijo}, modulosGenerados=${modulosGenerados}`);
    let aviso = null;
    if (modulosFijo) {
      if (modulosFijo > modulosOptimo) {
        aviso = { tipo: 'menos', mensaje: `Pediste ${modulosFijo} módulos pero el protocolo tiene contenido para ${modulosOptimo} como máximo. Algunos módulos pueden quedar con información escasa o repetida. Considera usar un documento más extenso.` };
      } else if (modulosFijo < modulosOptimo - 1) {
        aviso = { tipo: 'mas', mensaje: `El protocolo tiene información suficiente para hasta ${modulosOptimo} módulos. Genera nuevamente eligiendo un número mayor para aprovechar mejor el material.` };
      }
    }

    // Resolver area_id y profesor antes de insertar el curso
    const area_id = await resolveAreaId(area);

    const sedeObjetivoNum = parseInt(sede_objetivo) ||
      (req.usuario.rol === 'admin_sede' ? req.usuario.sede_id : null);
    let estamentosArr = [];
    try { estamentosArr = estamentos ? (typeof estamentos === 'string' ? JSON.parse(estamentos) : estamentos) : []; } catch {}

    const profesorResuelto = await resolverProfesor(profesor_id, sedeObjetivoNum, estamentosArr);
    const profesorIdFinal = profesorResuelto?.id || null;

    const { lastID: cursoId } = await pool.query(
      'INSERT INTO cursos (nombre, descripcion, area_id, profesor_id, sede_objetivo, publicado, generado_por_ia) VALUES (?, ?, ?, ?, ?, 0, 1)',
      [nombre_curso, `Generado desde: ${req.file.originalname}`, area_id, profesorIdFinal, sedeObjetivoNum || null]
    );
    console.log('[IA] Paso 6: curso insertado, id:', cursoId);

    const modulosConId = [];
    for (let i = 0; i < borrador.modulos.length; i++) {
      const mod = borrador.modulos[i];

      const { lastID: moduloId } = await pool.query(
        'INSERT INTO modulos (curso_id, titulo, descripcion, tipo, orden) VALUES (?, ?, ?, ?, ?)',
        [cursoId, mod.titulo, mod.descripcion, 'ppt', i + 1]
      );

      // Insertar slides en modulo_slides
      if (mod.presentacion?.diapositivas) {
        for (let si = 0; si < mod.presentacion.diapositivas.length; si++) {
          await pool.query(
            'INSERT INTO modulo_slides (modulo_id, numero, datos) VALUES (?, ?, ?)',
            [moduloId, si + 1, JSON.stringify(mod.presentacion.diapositivas[si])]
          );
        }
      }

      modulosConId.push({ ...mod, id: moduloId });

      // Insertar preguntas y sus alternativas en tablas separadas
      for (const pregunta of (mod.preguntas || [])) {
        if (!pregunta.texto || !Array.isArray(pregunta.alternativas) || pregunta.alternativas.length === 0) continue;
        const { lastID: preguntaId } = await pool.query(
          'INSERT INTO preguntas (curso_id, texto) VALUES (?, ?)',
          [cursoId, pregunta.texto]
        );
        for (const alt of pregunta.alternativas) {
          await pool.query(
            'INSERT INTO alternativas (pregunta_id, texto, correcta) VALUES (?, ?, ?)',
            [preguntaId, alt.texto, alt.correcta ? 1 : 0]
          );
        }
      }
    }

    const totalPreguntas = borrador.modulos.reduce((acc, m) => acc + (m.preguntas?.length || 0), 0);
    const nombreArchivo = req.file.originalname;
    const pdfPathGuardado = req.file.path;

    // Extraer imágenes embebidas del PDF y guardarlas permanentemente en S3
    const imagenesProtocolo = await extraerImagenesPDF(pdfPathGuardado, cursoId);
    if (imagenesProtocolo.length > 0) {
      try {
        await pool.query('UPDATE cursos SET imagenes_protocolo = $1 WHERE id = $2',
          [JSON.stringify(imagenesProtocolo), cursoId]);
      } catch (e) {
        console.warn('[IA] No se pudo guardar imagenes_protocolo en BD:', e.message);
      }
    }

    if (!req.file._fromLib) fs.unlinkSync(pdfPathGuardado);

    // Notificar al profesor resuelto (fire-and-forget)
    if (profesorResuelto) {
      notificarProfesor({
        profesorEmail:  profesorResuelto.email || null,
        profesorNombre: profesorResuelto.nombre || 'Profesor',
        cursoNombre:    nombre_curso,
        cursoId,
        modulosCount:   modulosGenerados,
        preguntasCount: totalPreguntas,
        nombreArchivo,
        subidoPor:      req.usuario.nombre || 'Jefatura'
      }).catch(e => console.error('[IA] Error notificando al profesor resuelto:', e.message));
    }

    await auditar(req, 'ia.generar_curso', 'cursos', cursoId, {
      nombre:         nombre_curso,
      profesor_id:    profesorIdFinal,
      auto_asignado:  !profesor_id && !!profesorIdFinal ? profesorResuelto?.nombre : null,
      sede_objetivo:  sedeObjetivoNum
    });

    res.status(201).json({
      curso_id: cursoId,
      nombre: nombre_curso,
      profesor_id: profesorIdFinal,
      profesor_nombre: profesorResuelto?.nombre || null,
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
    if (req.file?.path && !req.file._fromLib && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    if (err.name === 'AbortError')
      return res.status(504).json({ error: 'La IA tardó demasiado. Intenta con un PDF más pequeño o reinicia Ollama.' });
    res.status(500).json({ error: err.message || 'Error al generar el curso con IA.' });
  }
});

// ─── POST /api/ia/generar-presentacion ────────────────────────────────────────
router.post('/generar-presentacion', verificarToken, verificarRol('jefatura', 'admin_sede', 'profesor'), async (req, res) => {
  const { titulo, descripcion, contexto } = req.body;
  if (!titulo) return res.status(400).json({ error: 'El título del módulo es requerido' });

  const prompt = `Genera una presentación educativa COMPLETA en JSON para trabajadores de un hogar de adultos mayores (ELEAM) en Chile.
Incluye objetivos, contenido educativo detallado y cierre. Usa lenguaje simple y ejemplos del trabajo diario.

Responde SOLO con este JSON exacto, sin texto adicional:

{
  "diapositivas": [
    {"tipo":"objetivos","titulo":"Objetivos de aprendizaje","lista":["Al finalizar podrás... 1","Al finalizar podrás... 2","Al finalizar podrás... 3"]},
    {"tipo":"desempeno","titulo":"Objetivo de desempeño","descripcion":"Al finalizar este módulo, el trabajador será capaz de [acción concreta y medible]"},
    {"tipo":"introduccion","titulo":"Introducción","texto":"párrafo de 3-4 oraciones que contextualice el tema y su importancia en el ELEAM"},
    {"tipo":"seccion","titulo":"título del primer tema de contenido","texto":"explicación clara en 3-4 oraciones","puntos":["punto práctico 1","punto práctico 2","punto práctico 3"]},
    {"tipo":"seccion","titulo":"título del segundo tema de contenido","texto":"explicación clara en 3-4 oraciones","puntos":["punto práctico 1","punto práctico 2","punto práctico 3"]},
    {"tipo":"seccion","titulo":"título del tercer tema de contenido","texto":"explicación clara en 3-4 oraciones","puntos":["punto práctico 1","punto práctico 2"]},
    {"tipo":"caso_practico","titulo":"Caso práctico","descripcion":"descripción de una situación real que puede ocurrir en el ELEAM","pasos":["paso 1 de cómo actuar","paso 2","paso 3","paso 4"]},
    {"tipo":"puntos_clave","titulo":"Puntos claves del protocolo","puntos":["punto clave 1","punto clave 2","punto clave 3","punto clave 4"]},
    {"tipo":"importante","titulo":"Cosas importantes","puntos":["cosa importante 1","cosa importante 2","cosa importante 3"]},
    {"tipo":"conclusion","titulo":"Conclusión","texto":"párrafo de cierre que refuerce la importancia del tema","mensaje":"frase motivacional corta para el trabajador"}
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
    if (!Array.isArray(presentacion.diapositivas)) presentacion.diapositivas = [];
    if (!presentacion.resumen || typeof presentacion.resumen !== 'object') presentacion.resumen = {};
    res.json({ presentacion });
  } catch (err) {
    console.error('[IA] Error presentación:', err.message);
    if (err.name === 'AbortError')
      return res.status(504).json({ error: 'La IA tardó demasiado. Intenta con un PDF más pequeño o reinicia Ollama.' });
    res.status(500).json({ error: 'Error al generar la presentación.' });
  }
});

// ─── POST /api/ia/modulo/:id/generar-ppt ──────────────────────────────────────
router.post('/modulo/:id/generar-ppt', verificarToken, async (req, res) => {
  try {
    const { rows: modRows } = await pool.query(
      'SELECT id, titulo, descripcion FROM modulos WHERE id = ?', [req.params.id]
    );
    if (!modRows.length) return res.status(404).json({ error: 'Módulo no encontrado' });
    const m = modRows[0];

    // Si ya tiene slides, devolverlas sin regenerar
    const { rows: slides } = await pool.query(
      'SELECT datos FROM modulo_slides WHERE modulo_id = ? ORDER BY numero', [m.id]
    );
    if (slides.length > 0) {
      const diapositivas = slides.map(s => typeof s.datos === 'string' ? JSON.parse(s.datos) : s.datos);
      return res.json({ presentacion: { diapositivas } });
    }

    const presentacion = await generarPPTModulo(m.titulo, m.descripcion);
    if (!presentacion) return res.status(500).json({ error: 'No se pudo generar la presentación' });

    await pool.query('DELETE FROM modulo_slides WHERE modulo_id = ?', [m.id]);
    for (let i = 0; i < presentacion.diapositivas.length; i++) {
      await pool.query(
        'INSERT INTO modulo_slides (modulo_id, numero, datos) VALUES (?, ?, ?)',
        [m.id, i + 1, JSON.stringify(presentacion.diapositivas[i])]
      );
    }
    res.json({ presentacion });
  } catch (err) {
    console.error('[IA] Error generar-ppt módulo:', err.message);
    res.status(500).json({ error: 'Error al generar la presentación' });
  }
});

// ─── POST /api/ia/notificar-profesor ──────────────────────────────────────────
router.post('/notificar-profesor', verificarToken, verificarRol('jefatura', 'admin_sede'), async (req, res) => {
  const { curso_id, curso_nombre, profesor_id, modulos_count, preguntas_count, nombre_archivo } = req.body;
  if (!curso_nombre) return res.status(400).json({ error: 'Datos del curso incompletos' });

  let profesorEmail  = null;
  let profesorNombre = 'Profesor';
  if (profesor_id) {
    const { rows } = await pool.query('SELECT nombre, email FROM usuarios WHERE id = ?', [profesor_id]);
    profesorEmail  = rows[0]?.email  || null;
    profesorNombre = rows[0]?.nombre || 'Profesor';
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
router.post('/generar-contenido', verificarToken, verificarRol('jefatura', 'admin_sede', 'profesor'), async (req, res) => {
  const { titulo, descripcion, contexto } = req.body;
  if (!titulo) return res.status(400).json({ error: 'El título del módulo es requerido' });

  const prompt = `Genera contenido educativo detallado en JSON para trabajadores de un hogar de adultos mayores (ELEAM) en Chile.
El contenido debe ser claro, práctico y adaptado a personal sin formación técnica universitaria.

Responde SOLO con este JSON exacto, sin texto adicional:

{
  "introduccion": "párrafo de 3-4 oraciones que contextualice el tema y su importancia en el trabajo diario",
  "secciones": [
    {"titulo":"título de la sección","texto":"explicación clara de 3-5 oraciones","puntos":["punto práctico 1","punto práctico 2","punto práctico 3"]}
  ],
  "caso_practico": {
    "descripcion": "descripción de una situación real que puede ocurrir en el ELEAM",
    "pasos": ["paso 1 de cómo actuar","paso 2","paso 3","paso 4"]
  },
  "recuerda": ["punto clave 1 para recordar","punto clave 2","punto clave 3"]
}

Módulo: ${titulo}
Descripción: ${descripcion || titulo}
Contexto: ${contexto || 'cuidado del adulto mayor en ELEAM'}

Genera entre 3 y 4 secciones con temas distintos del módulo.
Usa lenguaje simple, ejemplos concretos del trabajo diario. Responde SOLO el JSON.`;

  try {
    const textoRespuesta = await llamarIA(prompt, 300000);
    const contenido = parsearJSON(textoRespuesta);
    res.json({ contenido });
  } catch (err) {
    if (err.name === 'AbortError') return res.status(504).json({ error: 'La IA tardó demasiado.' });
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ia/imagen-signed?url=<s3url> — signed URL para imágenes de protocolo
router.get('/imagen-signed', verificarToken, async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'URL requerida' });
  const key = keyFromUrl(url);
  if (!key) return res.status(400).json({ error: 'URL S3 inválida' });
  try {
    const signedUrl = await generateSignedUrl(key, 3600);
    res.json({ url: signedUrl });
  } catch (err) {
    res.status(500).json({ error: 'Error generando URL firmada' });
  }
});

module.exports = router;
