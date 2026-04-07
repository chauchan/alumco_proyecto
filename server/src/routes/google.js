const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const pool = require('../config/db');
const { verificarToken } = require('../middleware/auth');

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

// GET /api/google/auth — redirige al consentimiento de Google
// Acepta token por query param porque es una redirección de navegador (no fetch)
router.get('/auth', (req, res, next) => {
  if (req.query.token) req.headers.authorization = `Bearer ${req.query.token}`
  next()
}, verificarToken, (req, res) => {
  const oauth2Client = getOAuthClient();
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/calendar.events'],
    state: req.usuario.id.toString()
  });
  res.redirect(url);
});

// GET /api/google/callback — Google redirige aquí tras el consentimiento
router.get('/callback', async (req, res) => {
  const { code, state: userId } = req.query;
  if (!code || !userId) return res.redirect(`${process.env.CLIENT_URL}/practicos?google=error`);

  try {
    const oauth2Client = getOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);

    await pool.query(
      `UPDATE usuarios SET google_access_token = ?, google_refresh_token = ? WHERE id = ?`,
      [tokens.access_token, tokens.refresh_token || null, userId]
    );

    res.redirect(`${process.env.CLIENT_URL}/practicos?google=connected`);
  } catch (err) {
    console.error('Google OAuth error:', err.message);
    res.redirect(`${process.env.CLIENT_URL}/practicos?google=error`);
  }
});

// GET /api/google/status — verifica si el usuario tiene Google conectado
router.get('/status', verificarToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT google_refresh_token IS NOT NULL as conectado FROM usuarios WHERE id = ?`,
      [req.usuario.id]
    );
    res.json({ conectado: !!result.rows[0]?.conectado });
  } catch {
    res.json({ conectado: false });
  }
});

// DELETE /api/google/disconnect — desconectar Google Calendar
router.delete('/disconnect', verificarToken, async (req, res) => {
  try {
    await pool.query(
      `UPDATE usuarios SET google_access_token = NULL, google_refresh_token = NULL WHERE id = ?`,
      [req.usuario.id]
    );
    res.json({ message: 'Google Calendar desconectado' });
  } catch {
    res.status(500).json({ error: 'Error al desconectar' });
  }
});

// POST /api/google/calendar/events — agrega un práctico al Google Calendar del usuario
router.post('/calendar/events', verificarToken, async (req, res) => {
  const { practico_id } = req.body;

  try {
    // Obtener tokens del usuario
    const userResult = await pool.query(
      `SELECT google_access_token, google_refresh_token FROM usuarios WHERE id = ?`,
      [req.usuario.id]
    );
    const user = userResult.rows[0];

    if (!user?.google_refresh_token) {
      return res.status(401).json({ error: 'Google Calendar no conectado' });
    }

    // Obtener datos del práctico
    const practicoResult = await pool.query(
      `SELECT p.*, c.nombre as curso_nombre, s.nombre as sede_nombre
       FROM practicos p
       JOIN cursos c ON p.curso_id = c.id
       JOIN sedes s ON p.sede_id = s.id
       WHERE p.id = ?`,
      [practico_id]
    );
    const p = practicoResult.rows[0];
    if (!p) return res.status(404).json({ error: 'Práctico no encontrado' });

    // Configurar cliente OAuth con tokens del usuario
    const oauth2Client = getOAuthClient();
    oauth2Client.setCredentials({
      access_token: user.google_access_token,
      refresh_token: user.google_refresh_token
    });

    // Refrescar access token si expiró y guardar el nuevo
    oauth2Client.on('tokens', async (tokens) => {
      if (tokens.access_token) {
        await pool.query(
          `UPDATE usuarios SET google_access_token = ? WHERE id = ?`,
          [tokens.access_token, req.usuario.id]
        );
      }
    });

    // Construir fechas del evento
    const fecha = p.fecha.toISOString ? p.fecha.toISOString().slice(0, 10) : String(p.fecha).slice(0, 10);
    const inicio = `${fecha}T${p.hora_inicio}`;
    const fin = p.hora_fin ? `${fecha}T${p.hora_fin}` : `${fecha}T${p.hora_inicio.slice(0,2)}:59:00`;

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const event = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: p.titulo,
        description: `Curso: ${p.curso_nombre}${p.descripcion ? '\n' + p.descripcion : ''}`,
        location: p.sede_nombre || 'ALUMCO',
        start: { dateTime: inicio, timeZone: 'America/Santiago' },
        end: { dateTime: fin, timeZone: 'America/Santiago' }
      }
    });

    res.json({ message: 'Evento agregado a Google Calendar', eventId: event.data.id });
  } catch (err) {
    console.error('Error creando evento Google:', err.message);
    res.status(500).json({ error: 'Error al crear el evento en Google Calendar' });
  }
});

// POST /api/google/calendar/custom-event — crea un evento personalizado en Google Calendar
router.post('/calendar/custom-event', verificarToken, async (req, res) => {
  const { titulo, fecha, hora_inicio, hora_fin, descripcion, lugar } = req.body;
  if (!titulo || !fecha || !hora_inicio) {
    return res.status(400).json({ error: 'Título, fecha y hora de inicio son obligatorios' });
  }
  try {
    const userResult = await pool.query(
      `SELECT google_access_token, google_refresh_token FROM usuarios WHERE id = ?`,
      [req.usuario.id]
    );
    const user = userResult.rows[0];
    if (!user?.google_refresh_token) return res.status(401).json({ error: 'Google Calendar no conectado' });

    const oauth2Client = getOAuthClient();
    oauth2Client.setCredentials({
      access_token: user.google_access_token,
      refresh_token: user.google_refresh_token
    });
    oauth2Client.on('tokens', async (tokens) => {
      if (tokens.access_token) {
        await pool.query(`UPDATE usuarios SET google_access_token = ? WHERE id = ?`, [tokens.access_token, req.usuario.id]);
      }
    });

    const inicio = `${fecha}T${hora_inicio}:00`;
    const fin = hora_fin ? `${fecha}T${hora_fin}:00` : `${fecha}T${hora_inicio.slice(0,2)}:59:00`;

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: titulo,
        description: descripcion || '',
        location: lugar || '',
        start: { dateTime: inicio, timeZone: 'America/Santiago' },
        end: { dateTime: fin, timeZone: 'America/Santiago' }
      }
    });

    res.json({ message: 'Evento creado en Google Calendar' });
  } catch (err) {
    console.error('Error creando evento personalizado:', err.message);
    res.status(500).json({ error: 'Error al crear el evento' });
  }
});

// GET /api/google/calendar/events?year=2026&month=4 — trae eventos del mes desde Google Calendar
router.get('/calendar/events', verificarToken, async (req, res) => {
  const { year, month } = req.query;
  try {
    const userResult = await pool.query(
      `SELECT google_access_token, google_refresh_token FROM usuarios WHERE id = ?`,
      [req.usuario.id]
    );
    const user = userResult.rows[0];
    if (!user?.google_refresh_token) return res.json([]);

    const oauth2Client = getOAuthClient();
    oauth2Client.setCredentials({
      access_token: user.google_access_token,
      refresh_token: user.google_refresh_token
    });
    oauth2Client.on('tokens', async (tokens) => {
      if (tokens.access_token) {
        await pool.query(
          `UPDATE usuarios SET google_access_token = ? WHERE id = ?`,
          [tokens.access_token, req.usuario.id]
        );
      }
    });

    const y = parseInt(year) || new Date().getFullYear();
    const m = parseInt(month) || new Date().getMonth() + 1;
    const timeMin = new Date(y, m - 1, 1).toISOString();
    const timeMax = new Date(y, m, 0, 23, 59, 59).toISOString();

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 100
    });

    const eventos = (response.data.items || []).map(e => ({
      id: `gc_${e.id}`,
      titulo: e.summary || '(sin título)',
      fecha: e.start.dateTime ? e.start.dateTime.slice(0, 10) : e.start.date,
      hora_inicio: e.start.dateTime ? e.start.dateTime.slice(11, 16) : null,
      hora_fin: e.end.dateTime ? e.end.dateTime.slice(11, 16) : null,
      descripcion: e.description || '',
      sede_nombre: e.location || '',
      origen: 'google'
    }));

    res.json(eventos);
  } catch (err) {
    console.error('Error obteniendo eventos Google:', err.message);
    res.json([]);
  }
});

module.exports = router;
