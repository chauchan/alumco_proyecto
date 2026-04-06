const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const pool = require('../config/db');
const { verificarToken, verificarRol } = require('../middleware/auth');
const { notificarProfesor } = require('../config/mailer');

const upload = multer({
  dest: path.join(__dirname, '../../uploads/protocolos'),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Solo se permiten archivos PDF'), false);
  },
  limits: { fileSize: 20 * 1024 * 1024 }
});

const OLLAMA_URL   = process.env.OLLAMA_URL   || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';

async function llamarOllama(prompt, timeoutMs = 180000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
        format: 'json',
        options: {
          num_ctx: 8192,
          num_predict: 4096,
          temperature: 0.2
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
    // 6000 chars = ~1500 tokens aprox, deja espacio suficiente para la respuesta
    const textoPdf  = textoCompleto.slice(0, 6000);
    const totalChars = textoCompleto.length;
    const modulosMin = totalChars > 12000 ? 6 : totalChars > 6000 ? 5 : 4;
    const modulosMax = totalChars > 12000 ? 9 : totalChars > 6000 ? 7 : 5;
    console.log('[IA] Paso 2: chars totales:', totalChars, '→ usando:', textoPdf.length, '→ módulos:', modulosMin, '-', modulosMax);

    const prompt = `Eres un experto en diseño de cursos de capacitación para trabajadores de hogares de adultos mayores (ELEAM) en Chile.

Analiza este protocolo y genera un curso estructurado en formato JSON:

{
  "modulos": [
    {
      "titulo": "string",
      "descripcion": "string (2-3 oraciones sobre el contenido)",
      "preguntas": [
        {
          "texto": "string (pregunta de alternativas)",
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
- Genera entre ${modulosMin} y ${modulosMax} módulos cubriendo los principales temas del protocolo
- Cada módulo: entre 3 y 5 preguntas de alternativas (4 opciones, 1 correcta)
- Lenguaje claro para personal sin formación técnica avanzada
- Nombre del curso: ${nombre_curso}
- Contexto: ${contexto || 'protocolo de cuidado del adulto mayor'}

Responde SOLO con el JSON, sin texto adicional.

PROTOCOLO:
${textoPdf}`;

    console.log('[IA] Paso 3: llamando a Ollama (max 3 min)...');
    const textoRespuesta = await llamarOllama(prompt, 180000);
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
    console.error('[IA] Error:', err.message);
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'La IA tardó demasiado. Intenta con un PDF más pequeño o vuelve a intentarlo.' });
    }
    res.status(500).json({ error: err.message || 'Error al generar el curso con IA.' });
  }
});

// ─── POST /api/ia/generar-presentacion ────────────────────────────────────────
// Paso 2 (on-demand): genera la presentación de UN módulo específico
router.post('/generar-presentacion', verificarToken, verificarRol('jefatura', 'admin_sede', 'profesor'), async (req, res) => {
  const { titulo, descripcion, contexto } = req.body;
  if (!titulo) return res.status(400).json({ error: 'El título del módulo es requerido' });

  const prompt = `Eres un experto en diseño instruccional para trabajadores de hogares de adultos mayores en Chile.

Para el módulo indicado genera un JSON con DOS secciones independientes:

{
  "resumen": {
    "objetivo": "string (qué aprenderá el trabajador)",
    "puntos_clave": ["string x4 (ideas principales del módulo)"],
    "conceptos_importantes": [{ "termino": "string", "definicion": "string" }],
    "procedimientos": ["string (pasos si aplica, sino [])"],
    "advertencias": ["string (errores comunes, sino [])"],
    "cierre": "string (2 oraciones de cierre)"
  },
  "diapositivas": [
    {
      "tipo": "portada",
      "titulo": "string (nombre del módulo)",
      "subtitulo": "string (frase motivadora o pregunta de enganche)"
    },
    {
      "tipo": "definicion",
      "concepto": "string (término técnico del módulo)",
      "definicion_completa": "string (explicación clara y detallada del concepto)",
      "ejemplo_real": "string (ejemplo concreto de cómo se aplica en el trabajo diario)"
    },
    {
      "tipo": "caso",
      "titulo": "string (título del caso)",
      "situacion": "string (descripción realista de una situación que puede ocurrir)",
      "como_actuar": ["string x3-4 (pasos concretos de qué hacer)"]
    },
    {
      "tipo": "importante",
      "titulo": "string",
      "puntos": ["string x3-4 (cosas críticas a recordar, distintas a puntos_clave)"]
    },
    {
      "tipo": "reflexion",
      "pregunta": "string (pregunta que invite a pensar sobre el tema)",
      "pista": "string (orientación breve hacia la respuesta correcta)"
    }
  ]
}

Módulo: ${titulo}
Descripción: ${descripcion || ''}
Contexto: ${contexto || 'protocolo de cuidado del adulto mayor'}

IMPORTANTE: Las diapositivas deben tener contenido DISTINTO al resumen — más profundo, con ejemplos reales y situaciones prácticas del trabajo.
Responde SOLO con el JSON válido.`;

  try {
    console.log('[IA] Generando presentación para:', titulo);
    const textoRespuesta = await llamarOllama(prompt, 120000);
    const presentacion = parsearJSON(textoRespuesta);
    res.json({ presentacion });
  } catch (err) {
    console.error('[IA] Error presentación:', err.message);
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'La IA tardó demasiado. Intenta de nuevo.' });
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
