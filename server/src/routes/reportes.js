const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verificarToken, verificarRol } = require('../middleware/auth');
const { enviarRecordatorios } = require('../jobs/recordatoriosCertificados');

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

    const { rows: [{ total: sinEstamento }] } = await pool.query(
      `SELECT COUNT(*) as total FROM usuarios u
       WHERE u.estamento_id IS NULL AND u.rol = 'colaborador' AND u.activo = 1 ${filtroSede}`, p);

    res.json({
      total_colaboradores: parseInt(totalUsuarios),
      capacitados_al_dia:  parseInt(capacitados),
      certificados_emitidos: parseInt(certificados),
      requieren_atencion:  parseInt(alertas),
      sin_estamento:       parseInt(sinEstamento)
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

// GET /api/reportes/graficos/cobertura-sede — % completado por sede (jefatura)
router.get('/graficos/cobertura-sede', verificarToken, verificarRol('jefatura'), async (req, res) => {
  const { desde, hasta } = req.query;
  const isValidDate = d => /^\d{4}-\d{2}-\d{2}$/.test(d);
  if (desde && !isValidDate(desde)) return res.status(400).json({ error: 'Fecha desde inválida' });
  if (hasta && !isValidDate(hasta)) return res.status(400).json({ error: 'Fecha hasta inválida' });

  const hasFiltro = desde && hasta;
  // filtro aplicado dentro de CASE, aparece dos veces → params duplicados
  const fechaFilter = hasFiltro ? 'AND p.ultimo_acceso BETWEEN ? AND ?' : '';
  const params = hasFiltro ? [desde, hasta, desde, hasta] : [];

  try {
    const { rows } = await pool.query(`
      SELECT s.id, s.nombre,
        COUNT(DISTINCT CASE WHEN u.rol = 'colaborador' AND u.activo = 1 THEN u.id END) AS total,
        COUNT(DISTINCT CASE WHEN p.porcentaje >= 100 ${fechaFilter} THEN p.usuario_id END) AS completaron,
        COALESCE(ROUND(
          100.0 * COUNT(DISTINCT CASE WHEN p.porcentaje >= 100 ${fechaFilter} THEN p.usuario_id END) /
          NULLIF(COUNT(DISTINCT CASE WHEN u.rol = 'colaborador' AND u.activo = 1 THEN u.id END), 0)
        ), 0) AS pct_completado
      FROM sedes s
      LEFT JOIN usuarios u ON u.sede_id = s.id
      LEFT JOIN progreso p ON p.usuario_id = u.id
      GROUP BY s.id, s.nombre
      ORDER BY s.nombre
    `, params);
    res.json(rows.map(r => ({
      id: r.id,
      nombre: r.nombre,
      total: parseInt(r.total) || 0,
      completaron: parseInt(r.completaron) || 0,
      pct_completado: parseFloat(r.pct_completado) || 0
    })));
  } catch (err) {
    console.error('[reportes/graficos/cobertura-sede]', err.message);
    res.status(500).json({ error: 'Error al obtener cobertura por sede' });
  }
});

// GET /api/reportes/graficos/certificaciones-mes — certs aprobados por mes, últimos 12 (jefatura)
router.get('/graficos/certificaciones-mes', verificarToken, verificarRol('jefatura'), async (req, res) => {
  const { desde, hasta } = req.query;
  const isValidDate = d => /^\d{4}-\d{2}-\d{2}$/.test(d);
  if (desde && !isValidDate(desde)) return res.status(400).json({ error: 'Fecha desde inválida' });
  if (hasta && !isValidDate(hasta)) return res.status(400).json({ error: 'Fecha hasta inválida' });

  const desdeDate = desde
    ? new Date(desde + 'T00:00:00')
    : (() => { const d = new Date(); d.setMonth(d.getMonth() - 11); d.setDate(1); return d; })();
  const hastaDate = hasta ? new Date(hasta + 'T23:59:59') : new Date();
  const sqlDesde = `${desdeDate.getFullYear()}-${String(desdeDate.getMonth()+1).padStart(2,'0')}-01`;
  const sqlHasta = `${hastaDate.getFullYear()}-${String(hastaDate.getMonth()+1).padStart(2,'0')}-${String(hastaDate.getDate()).padStart(2,'0')} 23:59:59`;

  try {
    const { rows } = await pool.query(`
      SELECT DATE_FORMAT(cert.created_at, '%Y-%m') AS mes, COUNT(*) AS total
      FROM certificados cert
      JOIN intentos it ON cert.intento_id = it.id
      WHERE cert.estado = 'aprobado'
        AND cert.created_at >= ? AND cert.created_at <= ?
      GROUP BY mes ORDER BY mes
    `, [sqlDesde, sqlHasta]);

    const map = {};
    rows.forEach(r => { map[r.mes] = parseInt(r.total); });

    const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const result = [];
    const cur = new Date(desdeDate.getFullYear(), desdeDate.getMonth(), 1);
    const end = new Date(hastaDate.getFullYear(), hastaDate.getMonth(), 1);
    while (cur <= end) {
      const key = `${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,'0')}`;
      result.push({
        mes: key,
        label: `${MESES[cur.getMonth()]} ${String(cur.getFullYear()).slice(-2)}`,
        total: map[key] || 0
      });
      cur.setMonth(cur.getMonth() + 1);
    }
    res.json(result);
  } catch (err) {
    console.error('[reportes/graficos/certificaciones-mes]', err.message);
    res.status(500).json({ error: 'Error al obtener certificaciones por mes' });
  }
});

// GET /api/reportes/graficos/distribucion-estamento — colaboradores activos por estamento (jefatura)
router.get('/graficos/distribucion-estamento', verificarToken, verificarRol('jefatura'), async (req, res) => {
  const { desde, hasta } = req.query;
  const isValidDate = d => /^\d{4}-\d{2}-\d{2}$/.test(d);
  if (desde && !isValidDate(desde)) return res.status(400).json({ error: 'Fecha desde inválida' });
  if (hasta && !isValidDate(hasta)) return res.status(400).json({ error: 'Fecha hasta inválida' });

  const hasFiltro = desde && hasta;
  // Con filtro: contar colaboradores con actividad (progreso.ultimo_acceso) en el período
  const joinFiltro = hasFiltro
    ? 'AND u.id IN (SELECT p.usuario_id FROM progreso p WHERE p.ultimo_acceso BETWEEN ? AND ?)'
    : '';
  const params = hasFiltro ? [desde, hasta] : [];

  try {
    const { rows } = await pool.query(`
      SELECT e.nombre, COUNT(DISTINCT u.id) AS total
      FROM estamentos e
      LEFT JOIN usuarios u ON u.estamento_id = e.id
        AND u.rol = 'colaborador' AND u.activo = 1 ${joinFiltro}
      GROUP BY e.id, e.nombre
      HAVING total > 0
      ORDER BY total DESC
    `, params);
    res.json(rows.map(r => ({ nombre: r.nombre, total: parseInt(r.total) || 0 })));
  } catch (err) {
    console.error('[reportes/graficos/distribucion-estamento]', err.message);
    res.status(500).json({ error: 'Error al obtener distribución por estamento' });
  }
});

// POST /api/reportes/enviar-recordatorios — envío manual de recordatorios
router.post('/enviar-recordatorios', verificarToken, ROLES_REPORTE, async (req, res) => {
  const { rol, sede_id } = req.usuario;
  const sedeId = rol === 'admin_sede' ? sede_id : (req.body.sede_id ? parseInt(req.body.sede_id) : null);
  try {
    const result = await enviarRecordatorios(sedeId, req);
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[reportes/enviar-recordatorios]', err.message);
    res.status(500).json({ error: 'Error al enviar recordatorios' });
  }
});

module.exports = router;
