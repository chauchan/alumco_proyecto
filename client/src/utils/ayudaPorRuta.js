// Contenido del panel de ayuda contextual del Topbar, por ruta.
// Fallback por rol para rutas no mapeadas explícitamente.

export const AYUDA_POR_RUTA = {
  '/colaborador': {
    titulo: 'Panel de inicio',
    pasos: [
      'Revisa "Cursos pendientes" para ver qué te falta completar y hasta cuándo.',
      'Haz clic en "Continuar" o "Iniciar" para entrar a un curso.',
      'Tus certificados obtenidos aparecen abajo, con enlace de descarga directo.',
    ],
  },
  '/capacitaciones': {
    titulo: 'Cómo completar un curso',
    pasos: [
      'Elige un curso de la lista y haz clic en "Continuar" o "Iniciar".',
      'Recorre los módulos, marcando cada uno como visto al terminar.',
      'Al completar todos los módulos, rinde la evaluación — tienes 2 intentos.',
    ],
  },
  '/mis-certificados': {
    titulo: 'Mis certificados',
    pasos: [
      'Los certificados "aprobados" ya se pueden descargar en PDF.',
      'Si dice "pendiente de validación", tu profesor todavía tiene que revisarlo.',
    ],
  },
  '/practicos': {
    titulo: 'Prácticos',
    pasos: [
      'Los prácticos son actividades presenciales obligatorias para ciertos cursos.',
      'Puedes conectar tu Google Calendar para que se agreguen automáticamente.',
    ],
  },
  '/profesor': {
    titulo: 'Panel del profesor',
    pasos: [
      'Revisa "Certificados pendientes" para aprobar o rechazar evaluaciones.',
      'Los "Borradores IA" son cursos generados automáticamente que necesitan tu revisión antes de publicarse.',
      'Usa "Nuevo curso" para crear uno desde cero, paso a paso.',
    ],
  },
  '/profesor/nuevo-curso': {
    titulo: 'Cómo crear y publicar un curso',
    pasos: [
      'Completa la información básica y avanza al paso de módulos.',
      'Sube el material (PDF, video o PPT) de cada módulo.',
      'Carga las preguntas de evaluación (4 alternativas, una correcta).',
      'En "Audiencia" elige sede/estamentos y publica.',
    ],
  },
  '/admin': {
    titulo: 'Panel de administración de sede',
    pasos: [
      'Los indicadores de arriba resumen el estado de capacitación de tu sede.',
      'Revisa "Requieren atención" para ver colaboradores bloqueados o con vencimientos.',
      'Desde "Certificados sede" puedes buscar y filtrar certificados individuales.',
    ],
  },
  '/jefatura': {
    titulo: 'Resumen global',
    pasos: [
      'Los gráficos muestran cobertura y certificaciones de toda la ONG.',
      'Desde acá accedes a Gestión de usuarios, Sedes y al Generador de cursos con IA.',
    ],
  },
  '/jefatura/usuarios': {
    titulo: 'Cómo crear un usuario',
    pasos: [
      'Haz clic en "+ Nuevo usuario" y completa nombre, RUT, rol y estamento.',
      'El estamento es obligatorio: sin él, la persona no recibe capacitaciones asignadas.',
      'Para altas masivas, usa "Importar XLSX" con la plantilla descargable.',
    ],
  },
  '/jefatura/sedes': {
    titulo: 'Gestión de sedes',
    pasos: [
      'Cada sede puede tener cursos dirigidos solo a ella desde "Audiencia" al crear un curso.',
    ],
  },
  '/ia': {
    titulo: 'Generador de cursos con IA',
    pasos: [
      'Sube un PDF de protocolo (o elige uno ya guardado en la biblioteca).',
      'La IA genera módulos, preguntas y presentaciones — puede tardar varios minutos.',
      'El borrador queda pendiente de revisión del profesor antes de publicarse.',
    ],
  },
  '/protocolos': {
    titulo: 'Biblioteca de protocolos',
    pasos: [
      'Sube PDFs de protocolos institucionales para reutilizarlos en el Generador IA sin volver a subirlos.',
    ],
  },
}

const AYUDA_POR_ROL_FALLBACK = {
  colaborador: { titulo: 'Ayuda', pasos: ['Consulta "Mis capacitaciones" para ver tus cursos pendientes y completados.'] },
  profesor:    { titulo: 'Ayuda', pasos: ['Gestiona tus cursos y valida certificados desde el panel del profesor.'] },
  admin_sede:  { titulo: 'Ayuda', pasos: ['Consulta los indicadores de tu sede desde el panel de administración.'] },
  jefatura:    { titulo: 'Ayuda', pasos: ['Consulta el resumen global o navega a Gestión de usuarios / Sedes.'] },
}

export function resolverAyuda(pathname, rol) {
  if (AYUDA_POR_RUTA[pathname]) return AYUDA_POR_RUTA[pathname]
  if (pathname.startsWith('/capacitaciones/')) {
    return {
      titulo: 'Detalle del curso',
      pasos: [
        'Recorre los módulos en orden, marcando cada uno como visto.',
        'Una vez vistos todos, aparece la pestaña "Evaluación".',
        'Necesitas 60% o más para aprobar, con un máximo de 2 intentos.',
      ],
    }
  }
  return AYUDA_POR_ROL_FALLBACK[rol] || { titulo: 'Ayuda', pasos: [] }
}
