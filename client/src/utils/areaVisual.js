/* Ícono y color de cada área de capacitación.
   Las áreas no son un enum cerrado: el formulario de curso propone una lista,
   pero tanto la generación por IA como la edición manual crean áreas nuevas
   sobre la marcha (ver resolveAreaId en server/src/routes/cursos.js). Por eso
   el mapeo se hace por palabras clave sobre el nombre normalizado y no por
   igualdad exacta, y siempre hay un fallback.

   Los colores viven en index.css como tokens --area-* para que el modo de
   alto contraste pueda redefinirlos. */

const normalizar = txt =>
  (txt || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

/* El orden importa: gana la primera regla que coincida. */
const REGLAS = [
  { claves: ['seguridad', 'emergencia', 'accidente', 'incendio', 'riesgo', 'caida'],
    icon: 'lucide:shield-alert',   token: 'seguridad' },
  { claves: ['nutricion', 'alimentacion', 'alimentario', 'dieta', 'cocina'],
    icon: 'lucide:utensils',       token: 'nutricion' },
  /* Antes que 'servicios': "Higiene y cuidado personal" es aseo del residente,
     no limpieza del recinto, y de lo contrario lo capturaría 'higiene'. */
  { claves: ['cuidado personal', 'cuidado directo', 'acompanamiento', 'demencia', 'psicosocial', 'bienestar'],
    icon: 'lucide:hand-heart',     token: 'personal' },
  { claves: ['higiene', 'limpieza', 'aseo', 'residuo', 'desinfeccion', 'servicios generales', 'lavanderia'],
    icon: 'lucide:spray-can',      token: 'servicios' },
  /* Figura de persona y no una mano: 'hand-helping' encajaba mejor con el
     gesto, pero a 36px se confundía con el 'hand-heart' de cuidado personal. */
  { claves: ['movilizacion', 'posicionamiento', 'carga', 'traslado', 'ergonomia', 'transferencia'],
    icon: 'lucide:accessibility',  token: 'movilizacion' },
  { claves: ['cuidado clinico', 'clinico', 'enfermeria', 'curacion', 'farmaco', 'medicamento'],
    icon: 'lucide:stethoscope',    token: 'clinico' },
  { claves: ['salud', 'primeros auxilios', 'sanitari'],
    icon: 'lucide:heart-pulse',    token: 'salud' },
  { claves: ['administracion', 'gestion', 'documenta', 'normativa', 'legal', 'rrhh', 'recursos humanos'],
    icon: 'lucide:briefcase',      token: 'administracion' },
]

const POR_DEFECTO = { icon: 'lucide:book-open', token: 'general' }

/**
 * @param {string} area nombre del área tal como viene de la API (puede ser null)
 * @returns {{icon: string, color: string, fondo: string}}
 */
export function visualDeArea(area) {
  const nombre = normalizar(area)
  const regla = REGLAS.find(r => r.claves.some(c => nombre.includes(c))) || POR_DEFECTO
  return {
    icon: regla.icon,
    color: `var(--area-${regla.token})`,
    fondo: `var(--area-${regla.token}-bg)`,
  }
}
