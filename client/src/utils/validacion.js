// Valida un RUT chileno (módulo 11). Acepta con o sin puntos/guion.
export function validarRut(rut) {
  if (!rut || typeof rut !== 'string') return false
  const limpio = rut.replace(/\./g, '').replace(/-/g, '').trim().toUpperCase()
  if (limpio.length < 2) return false
  const cuerpo = limpio.slice(0, -1)
  const dv = limpio.slice(-1)
  if (!/^\d+$/.test(cuerpo)) return false

  let suma = 0
  let multiplo = 2
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += parseInt(cuerpo[i], 10) * multiplo
    multiplo = multiplo === 7 ? 2 : multiplo + 1
  }
  const resto = 11 - (suma % 11)
  const dvEsperado = resto === 11 ? '0' : resto === 10 ? 'K' : String(resto)
  return dv === dvEsperado
}

export function validarEmail(email) {
  if (!email) return true // el email es opcional en la mayoría de los formularios
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}
