import { Icon } from '@iconify/react'

// Compara los módulos pedidos contra los que el protocolo realmente soporta,
// y avisa si conviene pedir más, menos, o si el número elegido fue el correcto.
export default function AvisoModulosIA({ resultado, numModulosPedidos }) {
  if (!resultado || !numModulosPedidos) return null

  const pedidos = parseInt(numModulosPedidos)
  const optimo = resultado.modulosOptimo
  const generados = resultado.modulos?.length

  let tipo, titulo, mensaje
  if (pedidos > optimo) {
    tipo = 'menos'
    titulo = 'Módulos solicitados superan el contenido'
    mensaje = `Pediste ${pedidos} módulos pero el protocolo tiene información para ${optimo} como máximo. Algunos módulos pueden quedar con contenido escaso o repetido.`
  } else if (pedidos < optimo - 1) {
    tipo = 'mas'
    titulo = 'Puedes aprovechar más el contenido'
    mensaje = `El protocolo tiene información suficiente para hasta ${optimo} módulos. Genera nuevamente con ese número para cubrir mejor el material.`
  } else {
    tipo = 'ok'
    titulo = 'Número de módulos adecuado'
    mensaje = `El protocolo tiene contenido para ${optimo} módulos y generaste ${generados}. Buena elección.`
  }

  const colores = {
    menos: { bg: 'var(--danger-bg)',  border: 'var(--danger-graphic)',  text: 'var(--danger)' },
    mas:   { bg: 'var(--warning-bg)', border: 'var(--warning-graphic)', text: 'var(--warning)' },
    ok:    { bg: 'var(--success-bg)', border: 'var(--success-graphic)', text: 'var(--success)' },
  }
  const c = colores[tipo]
  const icono = tipo === 'menos'
    ? <Icon icon="lucide:alert-triangle" width={20} style={{ color: 'var(--warning)', flexShrink: 0 }} />
    : tipo === 'mas'
    ? <Icon icon="lucide:lightbulb" width={20} style={{ color: 'var(--warning)', flexShrink: 0 }} />
    : <Icon icon="lucide:check-circle" width={20} style={{ color: 'var(--success)', flexShrink: 0 }} />

  return (
    <div style={{
      display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 18px',
      borderRadius: 10, border: `1.5px solid ${c.border}`, background: c.bg,
      boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
    }}>
      <span style={{ flexShrink: 0, lineHeight: 1 }}>{icono}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: c.text, marginBottom: 2 }}>{titulo}</div>
        <div style={{ fontSize: 12, color: c.text, lineHeight: 1.55 }}>{mensaje}</div>
      </div>
    </div>
  )
}
