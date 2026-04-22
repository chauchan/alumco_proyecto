const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verificarToken, verificarRol } = require('../middleware/auth');
const { enviarRecordatorioCertificados } = require('../config/mailer');

// POST /api/correos/recordatorio-certificados — correo masivo a colaboradores con cursos pendientes
router.post('/recordatorio-certificados', verificarToken, verificarRol('admin_sede', 'jefatura'), async (req, res) => {
  const { rol, sede_id } = req.usuario;
  try {
    // Obtener colaboradores activos con cursos asignados pero sin certificado aprobado
    const filtroSede = rol === 'admin_sede' ? 'AND u.sede_id = ?' : '';
    const params = rol === 'admin_sede' ? [sede_id] : [];

    const result = await pool.query(`
      SELECT DISTINCT
        u.id, u.nombre, u.email,
        COUNT(DISTINCT a.curso_id) as cursos_asignados,
        COUNT(DISTINCT CASE WHEN cert.estado = 'aprobado' THEN cert.curso_id END) as certificados_aprobados
      FROM usuarios u
      JOIN asignaciones a ON a.usuario_id = u.id
      LEFT JOIN certificados cert ON cert.usuario_id = u.id AND cert.curso_id = a.curso_id AND cert.estado = 'aprobado'
      WHERE u.rol = 'colaborador' AND u.activo = 1 AND u.email IS NOT NULL AND u.email != ''
      ${filtroSede}
      GROUP BY u.id, u.nombre, u.email
      HAVING certificados_aprobados < cursos_asignados
    `, params);

    const colaboradoresSinCertificado = result.rows;

    if (colaboradoresSinCertificado.length === 0) {
      return res.json({ message: 'Todos los colaboradores con email están al día. No se enviaron correos.', enviados: 0 });
    }

    // Para cada colaborador, obtener detalle de cursos pendientes
    const destinatarios = [];
    for (const colab of colaboradoresSinCertificado) {
      const cursosResult = await pool.query(`
        SELECT c.nombre,
               CASE
                 WHEN p.bloqueado_hasta IS NOT NULL AND p.bloqueado_hasta > NOW() THEN 'bloqueado'
                 WHEN p.porcentaje > 0 THEN 'pendiente'
                 ELSE 'sin_iniciar'
               END as estado
        FROM asignaciones a
        JOIN cursos c ON a.curso_id = c.id
        LEFT JOIN progreso p ON p.curso_id = a.curso_id AND p.usuario_id = a.usuario_id
        LEFT JOIN certificados cert ON cert.usuario_id = a.usuario_id AND cert.curso_id = a.curso_id AND cert.estado = 'aprobado'
        WHERE a.usuario_id = ? AND cert.id IS NULL
        ORDER BY c.nombre
      `, [colab.id]);

      destinatarios.push({
        nombre: colab.nombre,
        email: colab.email,
        cursos_pendientes: cursosResult.rows.length,
        cursos: cursosResult.rows
      });
    }

    const resultados = await enviarRecordatorioCertificados({ destinatarios });

    res.json({
      message: `Correos enviados a ${resultados.enviados} colaborador(es). ${resultados.errores > 0 ? `${resultados.errores} error(es).` : ''}`,
      enviados: resultados.enviados,
      errores: resultados.errores,
      total_destinatarios: destinatarios.length
    });
  } catch (err) {
    console.error('[correos/recordatorio]', err);
    res.status(500).json({ error: 'Error al enviar correos' });
  }
});

// GET /api/correos/preview-certificados — preview: cuántos recibirían el correo
router.get('/preview-certificados', verificarToken, verificarRol('admin_sede', 'jefatura'), async (req, res) => {
  const { rol, sede_id } = req.usuario;
  try {
    const filtroSede = rol === 'admin_sede' ? 'AND u.sede_id = ?' : '';
    const params = rol === 'admin_sede' ? [sede_id] : [];

    const result = await pool.query(`
      SELECT COUNT(DISTINCT u.id) as total
      FROM usuarios u
      JOIN asignaciones a ON a.usuario_id = u.id
      LEFT JOIN certificados cert ON cert.usuario_id = u.id AND cert.curso_id = a.curso_id AND cert.estado = 'aprobado'
      WHERE u.rol = 'colaborador' AND u.activo = 1 AND u.email IS NOT NULL AND u.email != ''
      ${filtroSede}
      GROUP BY u.id
      HAVING COUNT(DISTINCT a.curso_id) > COUNT(DISTINCT cert.curso_id)
    `, params);

    // La consulta HAVING devuelve una fila por colaborador; contamos las filas
    const sinEmail = await pool.query(`
      SELECT COUNT(DISTINCT u.id) as total
      FROM usuarios u
      JOIN asignaciones a ON a.usuario_id = u.id
      LEFT JOIN certificados cert ON cert.usuario_id = u.id AND cert.curso_id = a.curso_id AND cert.estado = 'aprobado'
      WHERE u.rol = 'colaborador' AND u.activo = 1 AND (u.email IS NULL OR u.email = '')
      ${filtroSede}
      GROUP BY u.id
      HAVING COUNT(DISTINCT a.curso_id) > COUNT(DISTINCT cert.curso_id)
    `, params);

    res.json({
      con_email: result.rows.length,
      sin_email: sinEmail.rows.length
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener preview' });
  }
});

module.exports = router;
