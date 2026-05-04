const pool = require('../config/db');

async function auditar(req, accion, entidad, entidad_id, payload = null) {
  try {
    const usuario_id = req?.usuario?.id ?? null;
    const ip = req?.ip ?? req?.socket?.remoteAddress ?? null;
    await pool.query(
      `INSERT INTO audit_log (usuario_id, accion, entidad, entidad_id, payload, ip)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        usuario_id,
        accion,
        entidad,
        entidad_id ?? null,
        payload !== null ? JSON.stringify(payload) : null,
        ip
      ]
    );
  } catch (err) {
    console.error('[audit] Error al registrar:', err.message);
  }
}

module.exports = { auditar };
