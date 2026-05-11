const pool = require('../config/db');
const { enviarRecordatorioCertificados } = require('../config/mailer');
const { auditar } = require('../utils/audit');

/**
 * Envía recordatorios por email a colaboradores con cursos asignados sin certificado aprobado.
 * @param {number|null} sedeId  - filtrar por sede; null = todas las sedes
 * @param {object|null} req     - request de Express (para auditoría); null en contexto cron
 * @returns {Promise<{enviados: number, errores: number, total: number}>}
 */
async function enviarRecordatorios(sedeId = null, req = null) {
  const filtro = sedeId ? 'AND u.sede_id = ?' : '';
  const params = sedeId ? [sedeId] : [];

  const { rows } = await pool.query(`
    SELECT u.id, u.nombre, u.email,
      GROUP_CONCAT(DISTINCT c.nombre ORDER BY c.nombre SEPARATOR '||') AS cursos_pendientes
    FROM asignaciones a
    JOIN usuarios u ON a.usuario_id = u.id
    JOIN cursos c ON a.curso_id = c.id
    LEFT JOIN intentos it ON it.usuario_id = u.id AND it.curso_id = a.curso_id AND it.aprobado = 1
    WHERE u.rol = 'colaborador' AND u.activo = 1
      AND it.id IS NULL
      AND c.publicado = 1
      AND c.obligatorio = 1
      ${filtro}
    GROUP BY u.id, u.nombre, u.email
  `, params);

  let enviados = 0;
  let errores = 0;

  for (const row of rows) {
    if (!row.email) { errores++; continue; }
    const cursosPendientes = row.cursos_pendientes ? row.cursos_pendientes.split('||') : [];
    try {
      await enviarRecordatorioCertificados(row.email, row.nombre, cursosPendientes);
      enviados++;
    } catch (e) {
      console.error(`[recordatorios] Error enviando a ${row.email}:`, e.message);
      errores++;
    }
  }

  auditar(req, 'recordatorios.enviar', 'sede', sedeId, { enviados, errores, total: rows.length })
    .catch(e => console.error('[recordatorios] audit error:', e.message));

  return { enviados, errores, total: rows.length };
}

module.exports = { enviarRecordatorios };
