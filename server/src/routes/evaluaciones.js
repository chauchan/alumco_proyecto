const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verificarToken, verificarRol } = require('../middleware/auth');
const { notificar } = require('../utils/notificar');
const { generarCertificadoPDF } = require('../utils/pdfCertificado');
const { auditar } = require('../utils/audit');
const { enviarBloqueo } = require('../config/mailer');
const { parseIdParam } = require('../utils/validate');

// GET /api/evaluaciones/:curso_id/estado
router.get('/:curso_id/estado', verificarToken, async (req, res) => {
  const curso_id = parseIdParam(req, 'curso_id');
  if (curso_id === null) return res.status(400).json({ error: 'curso_id inválido' });
  const usuario_id = req.usuario.id;
  try {
    const { rows: intentos } = await pool.query(
      'SELECT * FROM intentos WHERE usuario_id = ? AND curso_id = ? ORDER BY numero_intento ASC',
      [usuario_id, curso_id]
    );
    const aprobado = intentos.some(i => i.aprobado);
    const bloqueado = intentos.length >= 2 && !aprobado;
    res.json({
      intentos_realizados: intentos.length,
      puede_intentar: !aprobado && intentos.length < 2,
      aprobado,
      bloqueado,
      intentos
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener estado' });
  }
});

// POST /api/evaluaciones/:curso_id/responder
// Body: { respuestas: [{ pregunta_id, alternativa_id }] }
// También acepta alternativa_idx para compatibilidad con el frontend anterior
router.post('/:curso_id/responder', verificarToken, verificarRol('colaborador'), async (req, res) => {
  const curso_id = parseIdParam(req, 'curso_id');
  if (curso_id === null) return res.status(400).json({ error: 'curso_id inválido' });
  const usuario_id = req.usuario.id;
  const { respuestas } = req.body;

  try {
    const warnings = [];
    const { rows: [stats] } = await pool.query(
      'SELECT COUNT(*) as total, MAX(aprobado) as aprobado FROM intentos WHERE usuario_id = ? AND curso_id = ?',
      [usuario_id, curso_id]
    );
    if (parseInt(stats.aprobado) === 1) return res.status(400).json({ error: 'Ya aprobaste este curso' });
    if (parseInt(stats.total) >= 2) return res.status(400).json({ error: 'Alcanzaste el máximo de 2 intentos' });

    const { rows: preguntas } = await pool.query(
      'SELECT id FROM preguntas WHERE curso_id = ?', [curso_id]
    );
    if (!preguntas.length) return res.status(400).json({ error: 'Este curso no tiene preguntas' });

    const pregIds = preguntas.map(p => p.id);
    const ph = pregIds.map(() => '?').join(',');
    const { rows: alternativas } = await pool.query(
      `SELECT id, pregunta_id, correcta FROM alternativas WHERE pregunta_id IN (${ph}) ORDER BY id`,
      pregIds
    );

    // Agrupar alternativas por pregunta para soportar alternativa_idx
    const altsByPregunta = {};
    for (const alt of alternativas) {
      if (!altsByPregunta[alt.pregunta_id]) altsByPregunta[alt.pregunta_id] = [];
      altsByPregunta[alt.pregunta_id].push(alt);
    }

    let correctas = 0;
    const respuestasValidas = [];
    for (const resp of (respuestas || [])) {
      const { pregunta_id } = resp;
      let alternativa_id = resp.alternativa_id;

      if (!alternativa_id && resp.alternativa_idx !== undefined) {
        const ordered = altsByPregunta[pregunta_id] || [];
        alternativa_id = ordered[resp.alternativa_idx]?.id;
      }
      if (!alternativa_id) continue;

      const alt = alternativas.find(a => a.id === alternativa_id);
      if (!alt) continue;
      if (alt.correcta) correctas++;
      respuestasValidas.push({ pregunta_id, alternativa_id });
    }

    const nota = preguntas.length > 0 ? Math.round((correctas / preguntas.length) * 100) : 0;
    const cursoAprobado = nota >= 60;
    const numero_intento = parseInt(stats.total) + 1;

    const { lastID: intentoId } = await pool.query(
      'INSERT INTO intentos (usuario_id, curso_id, numero_intento, nota, aprobado) VALUES (?, ?, ?, ?, ?)',
      [usuario_id, curso_id, numero_intento, nota, cursoAprobado ? 1 : 0]
    );

    for (const r of respuestasValidas) {
      await pool.query(
        'INSERT INTO intento_respuestas (intento_id, pregunta_id, alternativa_id) VALUES (?, ?, ?)',
        [intentoId, r.pregunta_id, r.alternativa_id]
      );
    }

    // Sync blocking state into progreso table so mi-progreso reflects the attempt
    const DIAS_BLOQUEO = 7;
    const intentos_fallidos_prog = cursoAprobado ? 0 : numero_intento;
    const bloqueado_hasta_prog = (!cursoAprobado && numero_intento >= 2)
      ? new Date(Date.now() + DIAS_BLOQUEO * 86400000)
      : null;
    try {
      await pool.query(
        `INSERT INTO progreso (usuario_id, curso_id, porcentaje, ultimo_acceso, intentos_fallidos, bloqueado_hasta)
         VALUES (?, ?, ?, NOW(), ?, ?)
         ON DUPLICATE KEY UPDATE
           porcentaje = IF(? = 1, 100, GREATEST(porcentaje, 70)),
           ultimo_acceso = NOW(), intentos_fallidos = ?, bloqueado_hasta = ?`,
        [usuario_id, curso_id, cursoAprobado ? 100 : 70, intentos_fallidos_prog, bloqueado_hasta_prog,
         cursoAprobado ? 1 : 0, intentos_fallidos_prog, bloqueado_hasta_prog]
      );
    // progreso sync is non-critical — evaluation is already persisted
    } catch (e) { console.error('[evaluaciones] progreso sync:', e.message); warnings.push('progreso_no_sincronizado'); }

    let requierePractico = false;
    let tieneAsistencia = false;

    if (cursoAprobado) {
      const { rows: [cursoRow] } = await pool.query('SELECT requiere_practico FROM cursos WHERE id = ?', [curso_id]);
      requierePractico = parseInt(cursoRow?.requiere_practico || 0) === 1;

      if (requierePractico) {
        const { rows: asistRows } = await pool.query(`
          SELECT 1 FROM asistencia_practicos ap
          JOIN practicos p ON ap.practico_id = p.id
          WHERE p.curso_id = ? AND ap.usuario_id = ? AND ap.asistio = 1
          LIMIT 1
        `, [curso_id, usuario_id]);
        tieneAsistencia = asistRows.length > 0;
      }

      if (!requierePractico || tieneAsistencia) {
        const { rows: [userRow] } = await pool.query('SELECT nombre FROM usuarios WHERE id = ?', [usuario_id]);
        const { rows: [cursoNombreRow] } = await pool.query('SELECT nombre FROM cursos WHERE id = ?', [curso_id]);
        await pool.query('INSERT IGNORE INTO certificados (intento_id) VALUES (?)', [intentoId]);
        try {
          const pdfUrl = await generarCertificadoPDF({
            certId: intentoId,
            nombre: userRow?.nombre || '',
            curso: cursoNombreRow?.nombre || '',
            estado: 'pendiente'
          });
          const { rows: [certRow] } = await pool.query('SELECT id FROM certificados WHERE intento_id = ?', [intentoId]);
          if (certRow) {
            await pool.query('UPDATE certificados SET archivo_url = ? WHERE id = ?', [pdfUrl, certRow.id]);
          }
        } catch (pdfErr) {
          console.error('[evaluaciones] Error generando PDF:', pdfErr.message);
          await pool.query("UPDATE certificados SET estado = 'error' WHERE intento_id = ?", [intentoId]).catch(() => {});
          return res.status(500).json({ error: 'Error al generar el certificado. La evaluación fue registrada.' });
        }
      }
    }

    if (!cursoAprobado && numero_intento === 2) {
      try {
        const { rows: [userInfo] } = await pool.query(
          'SELECT sede_id, nombre FROM usuarios WHERE id = ?', [usuario_id]
        );
        const { rows: [cursoInfo] } = await pool.query(
          'SELECT nombre, profesor_id FROM cursos WHERE id = ?', [curso_id]
        );
        const sede_id    = userInfo?.sede_id;
        const nombreColab = userInfo?.nombre;
        const nombreCurso = cursoInfo?.nombre || 'Curso';
        const profesor_id = cursoInfo?.profesor_id;
        const bloqueMsg = `${nombreColab} ha fallado 2 veces el curso "${nombreCurso}" y ha sido bloqueado.`;

        if (sede_id) {
          const { rows: admins } = await pool.query(
            "SELECT id, email, nombre FROM usuarios WHERE rol = 'admin_sede' AND sede_id = ?", [sede_id]
          );
          for (const admin of admins) {
            await notificar(admin.id, {
              tipo: 'evaluacion_bloqueo', entidad: 'curso', entidad_id: parseInt(curso_id),
              titulo: 'Colaborador bloqueado en curso', mensaje: bloqueMsg
            });
            if (admin.email) enviarBloqueo(admin.email, admin.nombre, nombreColab, nombreCurso)
              .catch(e => console.error('[bloqueo] email admin:', e.message));
          }
        }

        if (profesor_id) {
          await notificar(profesor_id, {
            tipo: 'evaluacion_bloqueo', entidad: 'curso', entidad_id: parseInt(curso_id),
            titulo: 'Colaborador bloqueado en tu curso', mensaje: bloqueMsg
          });
          const { rows: [profInfo] } = await pool.query(
            'SELECT email, nombre FROM usuarios WHERE id = ?', [profesor_id]
          );
          if (profInfo?.email) enviarBloqueo(profInfo.email, profInfo.nombre, nombreColab, nombreCurso)
            .catch(e => console.error('[bloqueo] email profesor:', e.message));
        }

        await auditar(req, 'evaluacion.bloqueo', 'curso', parseInt(curso_id), { usuario_id, nombreColab, nombreCurso });
      } catch (notifErr) {
        console.error('[ALERTA] Error al enviar notificación de doble fallo:', notifErr.message);
      }
    }

    res.json({
      nota,
      aprobado: cursoAprobado,
      numero_intento,
      doble_fallo: !cursoAprobado && numero_intento === 2,
      bloqueado_hasta: bloqueado_hasta_prog,
      esperando_practico: cursoAprobado && requierePractico && !tieneAsistencia,
      message: cursoAprobado
        ? (requierePractico && !tieneAsistencia
            ? 'Aprobaste la evaluación. Debes asistir al práctico para obtener tu certificado.'
            : 'Felicitaciones, aprobaste el curso. Tu certificado está pendiente de validación.')
        : numero_intento === 2
          ? 'No aprobaste. Has alcanzado el máximo de intentos. Contacta a tu profesor para un refuerzo.'
          : `No aprobaste. Tienes 1 intento más disponible. Nota: ${nota}%`,
      ...(warnings.length ? { warnings } : {})
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al procesar evaluación' });
  }
});

// GET /api/evaluaciones/dobles-fallos
router.get('/dobles-fallos', verificarToken, verificarRol('profesor', 'admin_sede', 'jefatura'), async (req, res) => {
  const { sede_id, rol, id: userId } = req.usuario;
  try {
    const params = [];
    let whereExtra = '';
    if (rol === 'admin_sede') {
      whereExtra = ' AND u.sede_id = ?';
      params.push(sede_id);
    } else if (rol === 'profesor') {
      whereExtra = ' AND c.profesor_id = ?';
      params.push(userId);
    }
    const { rows } = await pool.query(`
      SELECT u.id as usuario_id, u.nombre as usuario_nombre, u.sede_id,
             s.nombre as sede_nombre, c.id as curso_id, c.nombre as curso_nombre,
             MAX(i.fecha) as ultimo_intento
      FROM intentos i
      JOIN usuarios u ON i.usuario_id = u.id
      JOIN cursos c ON i.curso_id = c.id
      LEFT JOIN sedes s ON u.sede_id = s.id
      WHERE i.aprobado = 0${whereExtra}
      GROUP BY u.id, u.nombre, u.sede_id, s.nombre, c.id, c.nombre
      HAVING COUNT(i.id) >= 2
      ORDER BY ultimo_intento DESC
    `, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener dobles fallos' });
  }
});

module.exports = router;
