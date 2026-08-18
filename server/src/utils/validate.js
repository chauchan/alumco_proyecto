function parseIdParam(req, name) {
  const raw = req.params[name];
  const n = parseInt(raw, 10);
  if (!Number.isInteger(n) || n <= 0 || String(n) !== raw) return null;
  return n;
}

// Mismo algoritmo que client/src/utils/validacion.js. Se duplica a propósito:
// el servidor no puede importar del cliente, y validar solo en el navegador
// deja la API igual de expuesta.
function validarRut(rut) {
  if (!rut || typeof rut !== 'string') return false;
  const limpio = rut.replace(/\./g, '').replace(/-/g, '').trim().toUpperCase();
  if (limpio.length < 2) return false;
  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);
  if (!/^\d+$/.test(cuerpo)) return false;

  let suma = 0;
  let multiplo = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += parseInt(cuerpo[i], 10) * multiplo;
    multiplo = multiplo === 7 ? 2 : multiplo + 1;
  }
  const resto = 11 - (suma % 11);
  const dvEsperado = resto === 11 ? '0' : resto === 10 ? 'K' : String(resto);
  return dv === dvEsperado;
}

function validarEmail(email) {
  if (!email) return true; // opcional
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
}

module.exports = { parseIdParam, validarRut, validarEmail };
