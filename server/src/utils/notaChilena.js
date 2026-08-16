// Convierte un porcentaje de respuestas correctas (0-100) a la escala chilena 1.0-7.0.
// Usa el mismo umbral de aprobación que ya rige en evaluaciones.js (60% de exigencia),
// de modo que un intento aprobado (>=60%) siempre da nota >= 4.0 y viceversa.
const EXIGENCIA = 60;

// El tope de 3.9 para los reprobados no es cosmético: con la fórmula pura, 59%
// da 3.95 y al redondear a un decimal sube a 4.0. Como se aprueba con 60%, esa
// persona veía "No aprobaste. Nota: 4.0" — la nota de aprobación exacta. El
// redondeo no puede cruzar el umbral que él mismo define.
const NOTA_MAXIMA_REPROBADO = 3.9;

function porcentajeANotaChilena(pct) {
  const p = Math.max(0, Math.min(100, pct));
  const nota = p < EXIGENCIA
    ? Math.min(NOTA_MAXIMA_REPROBADO, 1.0 + 3.0 * (p / EXIGENCIA))
    : 4.0 + 3.0 * (p - EXIGENCIA) / (100 - EXIGENCIA);
  return Math.round(nota * 10) / 10;
}

module.exports = { porcentajeANotaChilena, EXIGENCIA_NOTA_MINIMA: 4.0 };
