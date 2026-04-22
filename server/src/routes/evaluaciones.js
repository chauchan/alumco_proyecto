const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verificarToken, verificarRol } = require('../middleware/auth');
const { notificarAdminDobleFallo } = require('../config/mailer');

// GET /api/evaluaciones/:curso_id/estado — estado del usuario en la evaluación
router.get('/:curso_id/estado', verificarToken, async (req, res) => {
  const { curso_id } = req.params;
  const usuario_id = req.usuario.id;
  try {
    const intentosResult = await pool.query(
      'SELECT * FROM intentos WHERE usuario_id = $1 AND curso_id = $2 ORDER BY numero_intento ASC',
      [usuario_id, curso_id]
    );
    const intentos = intentosResult.rows;
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

// POST /api/evaluaciones/:curso_id/responder — enviar respuestas
router.post('/:curso_id/responder', verificarToken, verificarRol('colaborador'), async (req, res) => {
  const { curso_id } = req.params;
  const usuario_id = req.usuario.id;
  const { respuestas } = req.body; // [{ pregunta_id, alternativa_idx }]

  try {
    // Verificar intentos disponibles
    const intentosResult = await pool.query(
      'SELECT COUNT(*) as total, MAX(CASE WHEN aprobado THEN 1 ELSE 0 END) as aprobado FROM intentos WHERE usuario_id = $1 AND curso_id = $2',
      [usuario_id, curso_id]
    );
    const { total, aprobado } = intentosResult.rows[0];
    if (aprobado === '1') return res.status(400).json({ error: 'Ya aprobaste este curso' });
    if (parseInt(total) >= 2) return res.status(400).json({ error: 'Alcanzaste el máximo de 2 intentos' });

    // Obtener preguntas y corregir
    const preguntasResult = await pool.query('SELECT * FROM preguntas WHERE curso_id = $1', [curso_id]);
    const preguntas = preguntasResult.rows;
    let correctas = 0;
    preguntas.forEach(p => {
      const respuesta = respuestas.find(r => r.pregunta_id === p.id);
      if (respuesta) {
        const alternativas = p.alternativas;
        const elegida = alternativas[respuesta.alternativa_idx];
        if (elegida?.correcta) correctas++;
      }
    });
    const nota = preguntas.length > 0 ? Math.round((correctas / preguntas.length) * 100) : 0;
    const cursoAprobado = nota >= 60; // nota mínima 60%
    const numero_intento = parseInt(total) + 1;

    const intentoResult = await pool.query(
      'INSERT INTO intentos (usuario_id, curso_id, numero_intento, respuestas, nota, aprobado) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [usuario_id, curso_id, numero_intento, JSON.stringify(respuestas), nota, cursoAprobado]
    );

    // Si aprobó, crear certificado pendiente de validación
    if (cursoAprobado) {
      await pool.query(
        'INSERT IGNORE INTO certificados (usuario_id, curso_id, intento_id) VALUES ($1,$2,$3)',
        [usuario_id, curso_id, intentoResult.rows[0].id]
      );
    }

    // Si doble fallo, notificar al admin_sede (in-app + email)
    if (!cursoAprobado && numero_intento === 2) {
      try {
        const userInfo = await pool.query(
          'SELECT sede_id, nombre FROM usuarios WHERE id = $1',
          [usuario_id]
        );
        const { sede_id, nombre: nombreColab } = userInfo.rows[0] || {};
        const cursoInfo = await pool.query(
          'SELECT nombre FROM cursos WHERE id = $1',
          [curso_id]
        );
        const nombreCurso = cursoInfo.rows[0]?.nombre || 'Curso';
        if (sede_id) {
          const admins = await pool.query(
            "SELECT id, nombre, email FROM usuarios WHERE rol = 'admin_sede' AND sede_id = $1",
            [sede_id]
          );
          const sedeInfo = await pool.query('SELECT nombre FROM sedes WHERE id = $1', [sede_id]);
          const sedeNombre = sedeInfo.rows[0]?.nombre || '';
          for (const admin of admins.rows) {
            await pool.query(
              'INSERT INTO notificaciones (usuario_id, titulo, mensaje) VALUES ($1,$2,$3)',
              [
                admin.id,
                'Colaborador bloqueado en curso',
                `${nombreColab} ha fallado 2 veces el curso "${nombreCurso}" y ha sido bloqueado por 7 días.`
              ]
            );
            if (admin.email) {
              notificarAdminDobleFallo({
                adminEmail: admin.email,
                adminNombre: admin.nombre,
                colaboradorNombre: nombreColab,
                cursoNombre: nombreCurso,
                sede: sedeNombre
              }).catch(e => console.error('[email doble fallo]', e.message));
            }
          }
        }
      } catch (notifErr) {
        console.error('[ALERTA] Error al enviar notificación de doble fallo:', notifErr.message);
      }
    }

    res.json({
      nota,
      aprobado: cursoAprobado,
      numero_intento,
      doble_fallo: !cursoAprobado && numero_intento === 2,
      message: cursoAprobado
        ? 'Felicitaciones, aprobaste el curso. Tu certificado está pendiente de validación.'
        : numero_intento === 2
          ? 'No aprobaste. Has alcanzado el máximo de intentos. Contacta a tu profesor para un refuerzo.'
          : `No aprobaste. Tienes 1 intento más disponible. Nota: ${nota}%`
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al procesar evaluación' });
  }
});

// GET /api/evaluaciones/dobles-fallos — listar dobles fallos (para profesor/admin)
router.get('/dobles-fallos', verificarToken, verificarRol('profesor', 'admin_sede', 'jefatura'), async (req, res) => {
  const { sede_id, rol } = req.usuario;
  try {
    const params = [];
    let whereExtra = '';
    if (rol === 'admin_sede') {
      whereExtra = ' AND u.sede_id = $1';
      params.push(sede_id);
    }
    const query = `
      SELECT u.id as usuario_id, u.nombre as usuario_nombre, u.sede_id,
             s.nombre as sede_nombre, c.id as curso_id, c.nombre as curso_nombre,
             MAX(i.fecha) as ultimo_intento
      FROM intentos i
      JOIN usuarios u ON i.usuario_id = u.id
      JOIN cursos c ON i.curso_id = c.id
      LEFT JOIN sedes s ON u.sede_id = s.id
      WHERE i.aprobado = false${whereExtra}
      GROUP BY u.id, u.nombre, u.sede_id, s.nombre, c.id, c.nombre
      HAVING COUNT(i.id) >= 2
      ORDER BY ultimo_intento DESC
    `;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener dobles fallos' });
  }
});

module.exports = router;
