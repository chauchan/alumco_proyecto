const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const pool = require('../config/db');
const { verificarToken, verificarRol } = require('../middleware/auth');

const upload = multer({
  dest: path.join(__dirname, '../../uploads/protocolos'),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Solo se permiten archivos PDF'), false);
  },
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB
});

// POST /api/ia/generar-curso — subir protocolo y generar borrador con IA
router.post('/generar-curso', verificarToken, verificarRol('jefatura', 'admin_sede'), upload.single('protocolo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Archivo PDF requerido' });
  const { nombre_curso, area, profesor_id, contexto } = req.body;
  if (!nombre_curso) return res.status(400).json({ error: 'El nombre del curso es requerido' });

  try {
    console.log('[IA] Paso 1: archivo recibido', req.file.originalname);
    // Extraer texto del PDF con pdf-parse
    const pdfBuffer = fs.readFileSync(req.file.path);
    const pdfData = await pdfParse(pdfBuffer);
    const textoPdf = pdfData.text.trim().slice(0, 12000); // limitar tokens
    console.log('[IA] Paso 2: PDF extraído, chars:', textoPdf.length);

    const prompt = `Eres un asistente para crear cursos de capacitación para trabajadores de hogares de adultos mayores (ELEAM) en Chile.

Analiza el siguiente protocolo institucional y genera un borrador de curso con el siguiente formato JSON estricto:

{
  "modulos": [
    {
      "titulo": "string",
      "descripcion": "string (2-3 oraciones resumen del contenido)",
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

Instrucciones:
- Genera entre 3 y 4 módulos según la extensión del protocolo
- Cada módulo debe tener entre 4 y 5 preguntas de alternativas (total aproximado: 15 preguntas)
- Cada pregunta debe tener exactamente 4 alternativas, solo una correcta
- El lenguaje debe ser claro y accesible para personal de cuidado
- Contexto adicional: ${contexto || 'protocolo de cuidado del adulto mayor'}
- Nombre del curso: ${nombre_curso}

Responde SOLO con el JSON, sin texto adicional.

PROTOCOLO:
${textoPdf}`;

    // Llamar a Ollama (local)
    const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
    const ollamaModel = process.env.OLLAMA_MODEL || 'llama3.2';

    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: ollamaModel,
        prompt: prompt,
        stream: false,
        format: 'json'
      })
    });

    console.log('[IA] Paso 3: llamando a Ollama...');
    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      console.error('[Ollama] Status:', response.status, '| Error:', errorBody);
      throw new Error('Error al llamar a Ollama. ¿Está corriendo en localhost:11434?');
    }
    const data = await response.json();
    const textoRespuesta = data.response;
    console.log('[IA] Paso 4: respuesta Ollama recibida, chars:', textoRespuesta?.length);

    let borrador;
    try {
      borrador = JSON.parse(textoRespuesta);
    } catch {
      // Intentar extraer JSON de la respuesta
      const match = textoRespuesta.match(/\{[\s\S]*\}/);
      if (match) borrador = JSON.parse(match[0]);
      else throw new Error('La IA no devolvió un formato válido');
    }

    console.log('[IA] Paso 5: borrador parseado OK, módulos:', borrador.modulos?.length);
    // Crear el curso en BD como borrador
    const cursoResult = await pool.query(
      'INSERT INTO cursos (nombre, descripcion, area, profesor_id, publicado, generado_por_ia) VALUES ($1,$2,$3,$4,0,1)',
      [nombre_curso, `Generado automáticamente desde protocolo: ${req.file.originalname}`, area || null, profesor_id || null]
    );
    const cursoId = cursoResult.lastID;
    console.log('[IA] Paso 6: curso insertado, id:', cursoId);

    // Guardar módulos y preguntas
    for (let i = 0; i < borrador.modulos.length; i++) {
      const mod = borrador.modulos[i];
      await pool.query(
        'INSERT INTO modulos (curso_id, titulo, descripcion, orden) VALUES ($1,$2,$3,$4)',
        [cursoId, mod.titulo, mod.descripcion, i + 1]
      );
      // Guardar preguntas
      for (const pregunta of mod.preguntas) {
        await pool.query(
          'INSERT INTO preguntas (curso_id, texto, alternativas) VALUES ($1,$2,$3)',
          [cursoId, pregunta.texto, JSON.stringify(pregunta.alternativas)]
        );
      }
    }

    // Limpiar archivo temporal
    fs.unlinkSync(req.file.path);

    // Notificar al profesor via N8N (sin bloquear la respuesta al cliente)
    // Si N8N falla, el curso ya está guardado — cumple RNF-18 tolerancia a fallos
    if (profesor_id) {
      const profesorResult = await pool.query(
        'SELECT nombre, email FROM usuarios WHERE id = $1',
        [profesor_id]
      );
      const profesor = profesorResult.rows[0];
      const totalPreguntas = borrador.modulos.reduce((acc, m) => acc + (m.preguntas?.length || 0), 0);
      fetch(process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/alumco/notificar-profesor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          curso_id:        cursoId,
          curso_nombre:    nombre_curso,
          profesor_email:  process.env.TEST_EMAIL || profesor?.email,
          profesor_nombre: profesor?.nombre || 'Profesor',
          nombre_archivo:  req.file.originalname,
          modulos_count:   borrador.modulos.length,
          preguntas_count: totalPreguntas,
          subido_por:      req.usuario.nombre || 'Jefatura'
        })
      }).catch(err => console.error('[N8N] Error al notificar al profesor:', err.message));
    }

    res.status(201).json({
      curso_id: cursoId,
      nombre:   nombre_curso,
      generado_por_ia: true,
      modulos: borrador.modulos,
      message: 'Borrador generado correctamente. Debe ser revisado y aprobado por el profesor antes de publicarse.'
    });

  } catch (err) {
    console.error('Error IA:', err.message, err.stack);
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: 'Error al generar el curso con IA. Intenta nuevamente.' });
  }
});

module.exports = router;
