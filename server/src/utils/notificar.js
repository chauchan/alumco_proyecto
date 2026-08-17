const pool = require('../config/db');

// Tipos de notificación válidos:
//   'practico_asignado'   — se programó un práctico para un curso del colaborador
//   'evaluacion_bloqueo'  — un colaborador falló 2 veces y quedó bloqueado en un curso
//   'curso_asignado'      — se asignó un curso al colaborador
//   'curso_borrador_ia'   — jefatura envió al profesor un borrador generado con IA
//   'general'             — notificación sin entidad específica (usado en migración legacy)
//
// Entidades válidas: 'practico', 'curso', 'intento', 'certificado', null
//
// El helper nunca lanza excepción — los errores se loguean en consola.
async function notificar(usuario_id, { tipo, entidad = null, entidad_id = null, titulo, mensaje }) {
  try {
    await pool.query(
      `INSERT INTO notificaciones (usuario_id, tipo, entidad, entidad_id, titulo, mensaje)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [usuario_id, tipo, entidad ?? null, entidad_id ?? null, titulo, mensaje]
    );
  } catch (err) {
    console.error('[notificar] Error al insertar notificación:', err.message);
  }
}

module.exports = { notificar };
