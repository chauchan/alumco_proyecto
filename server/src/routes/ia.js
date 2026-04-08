const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const { Agent, fetch: undiciFetch } = require('undici');
const pool = require('../config/db');
const { verificarToken, verificarRol } = require('../middleware/auth');
const { notificarProfesor } = require('../config/mailer');

const OLLAMA_URL   = process.env.OLLAMA_URL   || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'gemma3:4b';

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
  const { nombre_curso, area, profesor_id, contexto } = req.body;
  if (!nombre_curso) return res.status(400).json({ error: 'El nombre del curso es requerido' });

  try {
    console.log('[IA] Paso 1: archivo recibido', req.file.originalname);

    const pdfBuffer = fs.readFileSync(req.file.path);
    const pdfData   = await pdfParse(pdfBuffer);
    const textoCompleto = pdfData.text.trim();
    const textoPdf  = textoCompleto.slice(0, 4000);
    const totalChars = textoCompleto.length;
    const modulosMin = totalChars > 10000 ? 4 : 3;
    const modulosMax = totalChars > 10000 ? 6 : 5;
    console.log('[IA] Paso 2: chars totales:', totalChars, '→ usando:', textoPdf.length, '→ módulos:', modulosMin, '-', modulosMax);

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
- Entre ${modulosMin} y ${modulosMax} módulos con los temas principales del protocolo
- Cada módulo: exactamente 4 preguntas de alternativas
- Preguntas variadas: comprensión, aplicación práctica y análisis
- Alternativas incorrectas plausibles (errores reales del personal, no respuestas absurdas)
- Sin "todas las anteriores" ni "ninguna de las anteriores"
- Descripciones de módulo: 3 oraciones claras para personal sin formación técnica
- Nombre del curso: ${nombre_curso}
- Contexto: ${contexto || 'protocolo de cuidado del adulto mayor'}

Responde SOLO con el JSON válido, sin texto adicional, sin bloques de código markdown.

PROTOCOLO:
${textoPdf}`;

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
    console.log('[IA] Paso 5: módulos generados:', borrador.modulos.length);

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
    fs.unlinkSync(req.file.path);

    res.status(201).json({
      curso_id: cursoId,
      nombre: nombre_curso,
      generado_por_ia: true,
      modulos: borrador.modulos,
      preguntas_count: totalPreguntas,
      nombre_archivo: nombreArchivo,
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

  const prompt = `Eres un experto en diseño instruccional y comunicación educativa para trabajadores de hogares de adultos mayores (ELEAM) en Chile. Tu objetivo es crear material de aprendizaje claro, práctico y memorable.

Para el módulo indicado genera un JSON con DOS secciones:

{
  "resumen": {
    "objetivo": "string (oración completa: al terminar este módulo el trabajador será capaz de...)",
    "puntos_clave": ["string x5-6 (ideas principales, redactadas como aprendizajes concretos, no solo temas)"],
    "conceptos_importantes": [
      { "termino": "string", "definicion": "string (definición completa en 2-3 oraciones, con ejemplo de uso real en el ELEAM)" }
    ],
    "procedimientos": ["string (pasos numerados y detallados, comenzando con verbo de acción: Verificar, Registrar, Informar...)"],
    "advertencias": ["string (errores frecuentes del personal y sus consecuencias reales para el residente)"],
    "cierre": "string (3-4 oraciones que refuercen la importancia del tema y motiven al trabajador a aplicar lo aprendido)"
  },
  "diapositivas": [
    {
      "tipo": "portada",
      "titulo": "string (nombre del módulo)",
      "subtitulo": "string (pregunta provocadora o dato impactante que genere interés inmediato)"
    },
    {
      "tipo": "definicion",
      "concepto": "string (término central del módulo)",
      "definicion_completa": "string (explicación completa en lenguaje simple, sin jerga técnica, 3-4 oraciones)",
      "ejemplo_real": "string (escena concreta del trabajo diario en el ELEAM, con nombres ficticios si ayuda: 'Cuando doña Rosa...', '...el auxiliar Pedro notó que...')"
    },
    {
      "tipo": "caso",
      "titulo": "string (título descriptivo del caso)",
      "situacion": "string (narrativa detallada de una situación real que puede ocurrir, 3-4 oraciones con contexto específico)",
      "como_actuar": ["string x4-5 (pasos concretos y ordenados, comenzando con verbo de acción)"]
    },
    {
      "tipo": "importante",
      "titulo": "string (título que resuma la idea central)",
      "puntos": ["string x4-5 (alertas críticas, consecuencias de no cumplir, obligaciones legales o éticas relevantes)"]
    },
    {
      "tipo": "reflexion",
      "pregunta": "string (pregunta abierta que conecte el tema con la experiencia personal del trabajador)",
      "pista": "string (2-3 oraciones que guíen hacia la respuesta correcta sin darla directamente)"
    }
  ]
}

Módulo: ${titulo}
Descripción: ${descripcion || ''}
Contexto: ${contexto || 'protocolo de cuidado del adulto mayor'}

Reglas:
- Cada sección debe tener contenido DISTINTO y complementario, no repetir la misma información
- Usa lenguaje accesible, directo y empático para personal con educación media
- Los ejemplos deben ser situaciones reales y específicas del trabajo en ELEAM chilenos
- Los procedimientos deben ser ejecutables tal como están escritos, sin necesitar explicación adicional
Responde SOLO con el JSON válido, sin texto adicional, sin bloques de código markdown.`;

  try {
    console.log('[IA] Generando presentación para:', titulo);
    const textoRespuesta = await llamarIA(prompt);
    const presentacion = parsearJSON(textoRespuesta);
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
