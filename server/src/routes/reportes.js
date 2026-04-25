const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verificarToken, verificarRol } = require('../middleware/auth');

const ROLES_REPORTE = verificarRol('admin_sede', 'jefatura');

// GET /api/reportes/resumen — resumen general por sede o global
router.get('/resumen', verificarToken, ROLES_REPORTE, async (req, res) => {
  const { rol, sede_id } = req.usuario;
  const filtroSede = rol === 'admin_sede' ? 'AND u.sede_id = ?' : '';
  const p = rol === 'admin_sede' ? [sede_id] : [];
  try {
    const { rows: [{ total: totalUsuarios }] } = await pool.query(
      `SELECT COUNT(*) as total FROM usuarios u WHERE u.rol = 'colaborador' AND u.activo = 1 ${filtroSede}`, p);

    const { rows: [{ total: capacitados }] } = await pool.query(
      `SELECT COUNT(DISTINCT p.usuario_id) as total FROM progreso p
       JOIN usuarios u ON p.usuario_id = u.id
       WHERE p.porcentaje >= 100 AND u.activo = 1 AND u.rol = 'colaborador' ${filtroSede}`, p);

    const { rows: [{ total: certificados }] } = await pool.query(
      `SELECT COUNT(*) as total FROM certificados cert
       JOIN intentos it ON cert.intento_id = it.id
       JOIN usuarios u ON it.usuario_id = u.id
       WHERE cert.estado = 'aprobado' ${filtroSede}`, p);

    // UNION usa filtroSede dos veces — duplicar params si aplica
    const { rows: [{ total: alertas }] } = await pool.query(`
      SELECT COUNT(DISTINCT usuario_id) as total FROM (
        SELECT p2.usuario_id FROM progreso p2
        JOIN usuarios u ON p2.usuario_id = u.id
        WHERE p2.intentos_fallidos >= 2 AND u.rol = 'colaborador' AND u.activo = 1 ${filtroSede}
        UNION
        SELECT a.usuario_id FROM asignaciones a
        JOIN usuarios u ON a.usuario_id = u.id
        LEFT JOIN progreso p2 ON p2.curso_id = a.curso_id AND p2.usuario_id = a.usuario_id
        WHERE a.fecha_limite IS NOT NULL AND a.fecha_limite < NOW()
          AND (p2.porcentaje IS NULL OR p2.porcentaje < 100)
          AND u.rol = 'colaborador' AND u.activo = 1 ${filtroSede}
      ) as alertas`, [...p, ...p]);

    res.json({
      total_colaboradores: parseInt(totalUsuarios),
      capacitados_al_dia:  parseInt(capacitados),
      certificados_emitidos: parseInt(certificados),
      requieren_atencion:  parseInt(alertas)
    });
  } catch (err) {
    console.error('[reportes/resumen]', err.message);
    res.status(500).json({ error: 'Error al obtener resumen' });
  }
});

// GET /api/reportes/sedes — métricas por sede (jefatura)
router.get('/sedes', verificarToken, verificarRol('jefatura'), async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT s.id, s.nombre, s.ciudad,
        COUNT(DISTINCT CASE WHEN u.rol = 'colaborador' AND u.activo = 1 THEN u.id END) as colaboradores,
        COUNT(DISTINCT CASE WHEN cert.estado = 'aprobado' THEN cert.id END) as certificados,
        ROUND(
          100.0 * COUNT(DISTINCT CASE WHEN p.porcentaje >= 100 THEN p.usuario_id END) /
          NULLIF(COUNT(DISTINCT CASE WHEN u.rol = 'colaborador' AND u.activo = 1 THEN u.id END), 0)
        ) as cobertura_pct
      FROM sedes s
      LEFT JOIN usuarios u ON u.sede_id = s.id
      LEFT JOIN intentos it ON it.usuario_id = u.id
      LEFT JOIN certificados cert ON cert.intento_id = it.id
      LEFT JOIN progreso p ON p.usuario_id = u.id
      GROUP BY s.id, s.nombre, s.ciudad
      ORDER BY s.nombre`);
    res.json(rows);
  } catch (err) {
    console.error('[reportes/sedes]', err.message);
    res.status(500).json({ error: 'Error al obtener métricas por sede' });
  }
});

// GET /api/reportes/cursos — cobertura por curso
router.get('/cursos', verificarToken, ROLES_REPORTE, async (req, res) => {
  const { rol, sede_id } = req.usuario;
  const filtroSede = rol === 'admin_sede' ? 'AND u.sede_id = ?' : '';
  const p = rol === 'admin_sede' ? [sede_id] : [];
  try {
    const { rows } = await pool.query(`
      SELECT c.id, c.nombre, ar.nombre as area,
        COUNT(DISTINCT a.usuario_id) as inscritos,
        COUNT(DISTINCT CASE WHEN p.porcentaje >= 100 THEN p.usuario_id END) as completaron,
        ROUND(100.0 * COUNT(DISTINCT CASE WHEN p.porcentaje >= 100 THEN p.usuario_id END) / NULLIF(COUNT(DISTINCT a.usuario_id), 0)) as pct_completado
      FROM cursos c
      LEFT JOIN areas ar ON c.area_id = ar.id
      LEFT JOIN asignaciones a ON a.curso_id = c.id
      LEFT JOIN usuarios u ON a.usuario_id = u.id ${filtroSede}
      LEFT JOIN progreso p ON p.curso_id = c.id AND p.usuario_id = a.usuario_id
      WHERE c.publicado = 1
      GROUP BY c.id, c.nombre, ar.nombre ORDER BY c.nombre`, p);
    res.json(rows);
  } catch (err) {
    console.error('[reportes/cursos]', err.message);
    res.status(500).json({ error: 'Error al obtener reporte de cursos' });
  }
});

// GET /api/reportes/colaboradores — estado de certificaciones por colaborador
router.get('/colaboradores', verificarToken, ROLES_REPORTE, async (req, res) => {
  const { rol, sede_id } = req.usuario;
  const { sede_id: sedeQuery } = req.query;
  try {
    const params = [];
    let filtroExtra = '';
    if (rol === 'admin_sede')      { filtroExtra = 'AND u.sede_id = ?'; params.push(sede_id); }
    else if (sedeQuery)            { filtroExtra = 'AND u.sede_id = ?'; params.push(parseInt(sedeQuery)); }

    const { rows } = await pool.query(`
      SELECT u.id, u.nombre, u.tipo_contrato, s.nombre as sede,
        COUNT(DISTINCT a.curso_id) as cursos_asignados,
        COUNT(DISTINCT CASE WHEN cert.estado = 'aprobado' THEN cert.id END) as certificados_obtenidos,
        CASE WHEN COUNT(DISTINCT a.curso_id) > 0 THEN
          COUNT(DISTINCT CASE WHEN cert.estado = 'aprobado' THEN cert.id END) >= COUNT(DISTINCT a.curso_id)
        ELSE 0 END as al_dia
      FROM usuarios u
      LEFT JOIN sedes s ON u.sede_id = s.id
      LEFT JOIN asignaciones a ON a.usuario_id = u.id
      LEFT JOIN intentos it ON it.usuario_id = u.id
      LEFT JOIN certificados cert ON cert.intento_id = it.id
      WHERE u.rol = 'colaborador' AND u.activo = 1 ${filtroExtra}
      GROUP BY u.id, u.nombre, u.tipo_contrato, s.nombre
      ORDER BY u.nombre`, params);
    res.json(rows);
  } catch (err) {
    console.error('[reportes/colaboradores]', err.message);
    res.status(500).json({ error: 'Error al obtener reporte de colaboradores' });
  }
});

// GET /api/reportes/etarios — distribución por rango etario
router.get('/etarios', verificarToken, ROLES_REPORTE, async (req, res) => {
  const { rol, sede_id } = req.usuario;
  const filtroSede = rol === 'admin_sede' ? 'AND u.sede_id = ?' : '';
  const p = rol === 'admin_sede' ? [sede_id] : [];
  try {
    const { rows } = await pool.query(`
      SELECT rango_etario, COUNT(*) as total
      FROM usuarios u
      WHERE u.rol = 'colaborador' AND u.activo = 1 ${filtroSede}
        AND rango_etario IS NOT NULL
      GROUP BY rango_etario ORDER BY rango_etario`, p);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener distribución etaria' });
  }
});

module.exports = router;
