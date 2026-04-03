const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
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
    // Extraer texto del PDF (simple: leer como buffer y enviarlo como base64 a Claude)
    const pdfBuffer = fs.readFileSync(req.file.path);
    const pdfBase64 = pdfBuffer.toString('base64');

    // Llamar a la API de Gemini
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
    const prompt = `Eres un asistente para crear cursos de capacitación para trabajadores de hogares de adultos mayores (ELEAM) en Chile.

Analiza el protocolo institucional adjunto y genera un borrador de curso con el siguiente formato JSON estricto:

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
- Genera entre 2 y 4 módulos según la extensión del protocolo
- Cada módulo debe tener exactamente 2 preguntas de alternativas
- Cada pregunta debe tener exactamente 4 alternativas, solo una correcta
- El lenguaje debe ser claro y accesible para personal de cuidado
- Contexto adicional: ${contexto || 'protocolo de cuidado del adulto mayor'}
- Nombre del curso: ${nombre_curso}

Responde SOLO con el JSON, sin texto adicional.`;

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              inline_data: {
                mime_type: 'application/pdf',
                data: pdfBase64
              }
            },
            { text: prompt }
          ]
        }]
      })
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      console.error('[Gemini API] Status:', response.status, '| Error:', JSON.stringify(errorBody));
      throw new Error('Error al llamar a la API de IA');
    }
    const data = await response.json();
    const textoRespuesta = data.candidates[0].content.parts[0].text;

    let borrador;
    try {
      borrador = JSON.parse(textoRespuesta);
    } catch {
      // Intentar extraer JSON de la respuesta
      const match = textoRespuesta.match(/\{[\s\S]*\}/);
      if (match) borrador = JSON.parse(match[0]);
      else throw new Error('La IA no devolvió un formato válido');
    }

    // Crear el curso en BD como borrador
    const cursoResult = await pool.query(
      'INSERT INTO cursos (nombre, descripcion, area, profesor_id, publicado, generado_por_ia) VALUES ($1,$2,$3,$4,false,true) RETURNING *',
      [nombre_curso, `Generado automáticamente desde protocolo: ${req.file.originalname}`, area || null, profesor_id || null]
    );
    const curso = cursoResult.rows[0];

    // Guardar módulos y preguntas
    for (let i = 0; i < borrador.modulos.length; i++) {
      const mod = borrador.modulos[i];
      const moduloResult = await pool.query(
        'INSERT INTO modulos (curso_id, titulo, descripcion, orden) VALUES ($1,$2,$3,$4) RETURNING id',
        [curso.id, mod.titulo, mod.descripcion, i + 1]
      );
      // Guardar preguntas
      for (const pregunta of mod.preguntas) {
        await pool.query(
          'INSERT INTO preguntas (curso_id, texto, alternativas) VALUES ($1,$2,$3)',
          [curso.id, pregunta.texto, JSON.stringify(pregunta.alternativas)]
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

      if (profesor) {
        const totalPreguntas = borrador.modulos.reduce((acc, m) => acc + (m.preguntas?.length || 0), 0);
        fetch(process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/alumco/notificar-profesor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            curso_id:        curso.id,
            curso_nombre:    curso.nombre,
            profesor_email:  profesor.email,
            profesor_nombre: profesor.nombre,
            nombre_archivo:  req.file.originalname,
            modulos_count:   borrador.modulos.length,
            preguntas_count: totalPreguntas,
            subido_por:      req.usuario.nombre || 'Jefatura'
          })
        }).catch(err => console.error('[N8N] Error al notificar al profesor:', err.message));
      }
    }

    res.status(201).json({
      curso_id: curso.id,
      nombre: curso.nombre,
      generado_por_ia: true,
      modulos: borrador.modulos,
      message: 'Borrador generado correctamente. Debe ser revisado y aprobado por el profesor antes de publicarse.'
    });

  } catch (err) {
    console.error('Error IA:', err.message);
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: 'Error al generar el curso con IA. Intenta nuevamente.' });
  }
});

module.exports = router;
