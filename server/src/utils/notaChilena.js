// Convierte un porcentaje de respuestas correctas (0-100) a la escala chilena 1.0-7.0.
// Usa el mismo umbral de aprobación que ya rige en evaluaciones.js (60% de exigencia),
// de modo que un intento aprobado (>=60%) siempre da nota >= 4.0 y viceversa.
const EXIGENCIA = 60;

function porcentajeANotaChilena(pct) {
  const p = Math.max(0, Math.min(100, pct));
  const nota = p <= EXIGENCIA
    ? 1.0 + 3.0 * (p / EXIGENCIA)
    : 4.0 + 3.0 * (p - EXIGENCIA) / (100 - EXIGENCIA);
  return Math.round(nota * 10) / 10;
}

module.exports = { porcentajeANotaChilena, EXIGENCIA_NOTA_MINIMA: 4.0 };
