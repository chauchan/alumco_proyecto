const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const pool = require('../config/db');
const { verificarToken, verificarRol } = require('../middleware/auth');
const { notificar } = require('../utils/notificar');
const { auditar } = require('../utils/audit');
const { generarCertificadoPDF } = require('../utils/pdfCertificado');

async function sincronizarConGoogle(usuarioId, practico) {
  try {
    const userResult = await pool.query(
      `SELECT google_access_token, google_refresh_token FROM usuarios WHERE id = ?`,
      [usuarioId]
    );
    const user = userResult.rows[0];
    if (!user?.google_refresh_token) return;

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    oauth2Client.setCredentials({
      access_token: user.google_access_token,
      refresh_token: user.google_refresh_token
    });
    oauth2Client.on('tokens', async (tokens) => {
      if (tokens.access_token) {
        await pool.query(
          `UPDATE usuarios SET google_access_token = ? WHERE id = ?`,
          [tokens.access_token, usuarioId]
        );
      }
    });

    const fecha = practico.fecha;
    const inicio = `${fecha}T${practico.hora_inicio}`;
    const fin = practico.hora_fin ? `${fecha}T${practico.hora_fin}` : `${fecha}T${practico.hora_inicio.slice(0,2)}:59:00`;

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: practico.titulo,
        description: `Curso: ${practico.curso_nombre || ''}${practico.descripcion ? '\n' + practico.descripcion : ''}`,
        location: practico.lugar || 'ALUMCO',
        start: { dateTime: inicio, timeZone: 'America/Santiago' },
        end: { dateTime: fin, timeZone: 'America/Santiago' }
      }
    });
  } catch (err) {
    console.error('Error sincronizando con Google Calendar:', err.message);
  }
}

const PUEDE_CREAR = verificarRol('profesor', 'admin_sede', 'jefatura');

// GET /api/practicos — listar prácticos del usuario o sede
router.get('/', verificarToken, async (req, res) => {
  const { rol, id, sede_id } = req.usuario;
  try {
    let query, params = [];

    if (rol === 'colaborador' || rol === 'profesor') {
      // Ver prácticos de cursos asignados a este usuario
      query = `
        SELECT p.*, c.nombre as curso_nombre, s.nombre as sede_nombre,
               u.nombre as creado_por_nombre
        FROM practicos p
        JOIN cursos c ON p.curso_id = c.id
        JOIN sedes s ON p.sede_id = s.id
        JOIN usuarios u ON p.creado_por = u.id
        WHERE p.curso_id IN (
          SELECT curso_id FROM asignaciones WHERE usuario_id = ?
        )
        ORDER BY p.fecha ASC, p.hora_inicio ASC
      `;
      params = [id];
    } else if (rol === 'admin_sede') {
      query = `
        SELECT p.*, c.nombre as curso_nombre, s.nombre as sede_nombre,
               u.nombre as creado_por_nombre
        FROM practicos p
        JOIN cursos c ON p.curso_id = c.id
        JOIN sedes s ON p.sede_id = s.id
        JOIN usuarios u ON p.creado_por = u.id
        WHERE p.sede_id = ?
        ORDER BY p.fecha ASC, p.hora_inicio ASC
      `;
      params = [sede_id];
    } else {
      // Jefatura ve todos
      query = `
        SELECT p.*, c.nombre as curso_nombre, s.nombre as sede_nombre,
               u.nombre as creado_por_nombre
        FROM practicos p
        JOIN cursos c ON p.curso_id = c.id
        JOIN sedes s ON p.sede_id = s.id
        JOIN usuarios u ON p.creado_por = u.id
        ORDER BY p.fecha ASC, p.hora_inicio ASC
      `;
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener prácticos' });
  }
});

// POST /api/practicos — crear práctico y notificar a los asignados
router.post('/', verificarToken, PUEDE_CREAR, async (req, res) => {
  const { curso_id, titulo, descripcion, fecha, hora_inicio, hora_fin, lugar } = req.body;
  const { sede_id, id: creado_por } = req.usuario;

  if (!curso_id || !titulo || !fecha || !hora_inicio) {
    return res.status(400).json({ error: 'Curso, título, fecha y hora de inicio son obligatorios' });
  }

  try {
    // Crear el práctico
    const result = await pool.query(
      `INSERT INTO practicos (curso_id, sede_id, titulo, descripcion, fecha, hora_inicio, hora_fin, lugar, creado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [curso_id, sede_id, titulo, descripcion || null, fecha, hora_inicio, hora_fin || null, lugar || null, creado_por]
    );
    const practicoId = result.lastID;

    // Obtener todos los colaboradores asignados a ese curso en esa sede
    const asignados = await pool.query(
      `SELECT u.id, u.nombre
       FROM asignaciones a
       JOIN usuarios u ON a.usuario_id = u.id
       WHERE a.curso_id = ? AND u.sede_id = ? AND u.activo = 1`,
      [curso_id, sede_id]
    );

    // Crear notificación para cada asignado
    const fechaFormateada = new Date(fecha).toLocaleDateString('es-CL', { weekday:'long', day:'numeric', month:'long' });
    const mensaje = `Se ha programado un práctico para el curso. Fecha: ${fechaFormateada} a las ${hora_inicio}. Lugar: ${lugar || 'ELEAM sede'}`;

    for (const u of asignados.rows) {
      await notificar(u.id, {
        tipo: 'practico_asignado',
        entidad: 'practico',
        entidad_id: practicoId,
        titulo: `Práctico programado: ${titulo}`,
        mensaje
      });
    }

    // Sincronizar con Google Calendar del creador si está conectado
    const cursoResult = await pool.query(`SELECT nombre FROM cursos WHERE id = ?`, [curso_id]);
    await sincronizarConGoogle(creado_por, {
      titulo, descripcion, fecha, hora_inicio, hora_fin, lugar,
      curso_nombre: cursoResult.rows[0]?.nombre || ''
    });

    res.status(201).json({
      id: practicoId,
      message: `Práctico creado. Se notificó a ${asignados.rows.length} colaborador${asignados.rows.length !== 1 ? 'es' : ''}.`
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear el práctico' });
  }
});

// GET /api/practicos/:id/asistencia — lista colaboradores asignados con estado de asistencia
router.get('/:id/asistencia', verificarToken, verificarRol('profesor', 'admin_sede', 'jefatura'), async (req, res) => {
  const practicoId = req.params.id;
  try {
    const { rows: practicoRows } = await pool.query(
      'SELECT curso_id, sede_id FROM practicos WHERE id = ?', [practicoId]
    );
    if (!practicoRows.length) return res.status(404).json({ error: 'Práctico no encontrado' });
    const { curso_id, sede_id } = practicoRows[0];

    const { rows } = await pool.query(`
      SELECT u.id, u.nombre, u.tipo_contrato,
        COALESCE(ap.asistio, 0) AS asistio,
        ap.registrado_en
      FROM asignaciones a
      JOIN usuarios u ON a.usuario_id = u.id
      LEFT JOIN asistencia_practicos ap ON ap.practico_id = ? AND ap.usuario_id = u.id
      WHERE a.curso_id = ? AND u.sede_id = ? AND u.activo = 1
      ORDER BY u.nombre
    `, [practicoId, curso_id, sede_id]);

    res.json(rows);
  } catch (err) {
    console.error('[asistencia GET]', err.message);
    res.status(500).json({ error: 'Error al obtener asistencia' });
  }
});

// POST /api/practicos/:id/asistencia — upsert masivo de asistencia; auto-crea certs si usuario ya aprobó eval
router.post('/:id/asistencia', verificarToken, verificarRol('profesor', 'admin_sede'), async (req, res) => {
  const practicoId = req.params.id;
  const registradoPor = req.usuario.id;
  const { asistencias } = req.body;

  if (!Array.isArray(asistencias) || !asistencias.length)
    return res.status(400).json({ error: 'asistencias requerido' });

  try {
    const { rows: practicoRows } = await pool.query(
      'SELECT curso_id FROM practicos WHERE id = ?', [practicoId]
    );
    if (!practicoRows.length) return res.status(404).json({ error: 'Práctico no encontrado' });
    const { curso_id } = practicoRows[0];

    let certCreados = 0;

    for (const { usuario_id, asistio } of asistencias) {
      if (!usuario_id) continue;
      await pool.query(`
        INSERT INTO asistencia_practicos (practico_id, usuario_id, asistio, registrado_por, registrado_en)
        VALUES (?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE asistio = VALUES(asistio), registrado_por = VALUES(registrado_por), registrado_en = NOW()
      `, [practicoId, usuario_id, asistio ? 1 : 0, registradoPor]);

      if (asistio) {
        // Check: approved eval but no cert yet → auto-create cert placeholder
        const { rows: pendiente } = await pool.query(`
          SELECT it.id AS intento_id, u.nombre AS usuario_nombre, c.nombre AS curso_nombre
          FROM intentos it
          JOIN usuarios u ON u.id = it.usuario_id
          JOIN cursos c ON c.id = it.curso_id
          WHERE it.usuario_id = ? AND it.curso_id = ? AND it.aprobado = 1
            AND NOT EXISTS (SELECT 1 FROM certificados cert WHERE cert.intento_id = it.id)
          LIMIT 1
        `, [usuario_id, curso_id]);

        if (pendiente.length) {
          const { intento_id, usuario_nombre, curso_nombre } = pendiente[0];
          await pool.query('INSERT IGNORE INTO certificados (intento_id) VALUES (?)', [intento_id]);
          certCreados++;
          generarCertificadoPDF({ certId: intento_id, nombre: usuario_nombre, curso: curso_nombre, estado: 'pendiente' })
            .then(async pdfUrl => {
              const { rows: [certRow] } = await pool.query('SELECT id FROM certificados WHERE intento_id = ?', [intento_id]);
              if (certRow) await pool.query('UPDATE certificados SET archivo_url = ? WHERE id = ?', [pdfUrl, certRow.id]);
            })
            .catch(e => console.error('[asistencia] PDF error:', e.message));
        }
      }
    }

    auditar(req, 'practico.asistencia', 'practico', parseInt(practicoId), {
      asistencias: asistencias.length,
      presentes: asistencias.filter(a => a.asistio).length,
      certs_creados: certCreados
    }).catch(e => console.error('[asistencia] audit error:', e.message));

    res.json({ ok: true, certs_creados: certCreados });
  } catch (err) {
    console.error('[asistencia POST]', err.message);
    res.status(500).json({ error: 'Error al registrar asistencia' });
  }
});

// DELETE /api/practicos/:id — eliminar práctico
router.delete('/:id', verificarToken, PUEDE_CREAR, async (req, res) => {
  try {
    await pool.query('DELETE FROM practicos WHERE id = ?', [req.params.id]);
    res.json({ message: 'Práctico eliminado' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar práctico' });
  }
});

// GET /api/practicos/:id/asistencia — colaboradores del curso con estado de asistencia
router.get('/:id/asistencia', verificarToken, PUEDE_CREAR, async (req, res) => {
  try {
    const practicoResult = await pool.query('SELECT * FROM practicos WHERE id = ?', [req.params.id]);
    if (!practicoResult.rows.length) return res.status(404).json({ error: 'Práctico no encontrado' });
    const practico = practicoResult.rows[0];

    const result = await pool.query(`
      SELECT u.id, u.nombre, u.estamento, u.identificador,
             CASE WHEN ap.id IS NOT NULL THEN 1 ELSE 0 END as asistio
      FROM asignaciones a
      JOIN usuarios u ON a.usuario_id = u.id
      LEFT JOIN asistencia_practicos ap ON ap.practico_id = ? AND ap.usuario_id = u.id
      WHERE a.curso_id = ? AND u.sede_id = ? AND u.activo = 1 AND u.rol = 'colaborador'
      ORDER BY u.nombre
    `, [req.params.id, practico.curso_id, practico.sede_id]);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener asistencia' });
  }
});

// POST /api/practicos/:id/asistencia — registrar asistencia (reemplaza registros previos)
router.post('/:id/asistencia', verificarToken, PUEDE_CREAR, async (req, res) => {
  const { asistentes } = req.body; // array de user IDs presentes
  try {
    await pool.query('DELETE FROM asistencia_practicos WHERE practico_id = ?', [req.params.id]);
    if (asistentes && asistentes.length > 0) {
      for (const userId of asistentes) {
        await pool.query(
          'INSERT INTO asistencia_practicos (practico_id, usuario_id, registrado_por) VALUES (?, ?, ?)',
          [req.params.id, userId, req.usuario.id]
        );
      }
    }
    res.json({ message: `Asistencia registrada: ${asistentes?.length || 0} presentes` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al registrar asistencia' });
  }
});

// GET /api/practicos/mi-asistencia?curso_id=X — verifica si el usuario asistió a algún práctico del curso
router.get('/mi-asistencia', verificarToken, async (req, res) => {
  const { curso_id } = req.query;
  const usuario_id = req.usuario.id;
  try {
    const result = await pool.query(`
      SELECT ap.id, p.titulo, p.fecha
      FROM asistencia_practicos ap
      JOIN practicos p ON ap.practico_id = p.id
      WHERE ap.usuario_id = ? AND p.curso_id = ?
      LIMIT 1
    `, [usuario_id, curso_id]);
    res.json({ asistio: result.rows.length > 0, detalle: result.rows[0] || null });
  } catch (err) {
    res.status(500).json({ error: 'Error al verificar asistencia' });
  }
});

module.exports = router;
