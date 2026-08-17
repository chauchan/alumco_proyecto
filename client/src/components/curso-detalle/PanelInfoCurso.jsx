import { Icon } from '@iconify/react'

export default function PanelInfoCurso({ curso, progreso, esperandoPractico, resultado }) {
  // El ancho va por clase y no inline: al apilarse en móvil, .curso-layout > *
  // lo lleva al 100%, y una regla CSS no puede sobreescribir un style inline.
  return (
    <div className="panel-info-curso">
      <div style={{ background: 'var(--cd-card-bg)', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--cd-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>Información del curso</div>
        {curso?.profesor_nombre && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
            <Icon icon="lucide:user" width={14} style={{color:'var(--cd-text-muted)',flexShrink:0}} />
            <span style={{ fontSize: 12, color: 'var(--cd-text-sec)' }}>Prof. {curso.profesor_nombre}</span>
          </div>
        )}
        {curso?.area && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
            <Icon icon="lucide:tag" width={14} style={{color:'var(--cd-text-muted)',flexShrink:0}} />
            <span style={{ fontSize: 12, color: 'var(--cd-text-sec)' }}>{curso.area}</span>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
          <Icon icon="lucide:layers" width={14} style={{color:'var(--cd-text-muted)',flexShrink:0}} />
          <span style={{ fontSize: 12, color: 'var(--cd-text-sec)' }}>{curso?.modulos?.length || 0} módulo{curso?.modulos?.length !== 1 ? 's' : ''}</span>
        </div>
        {curso?.preguntas?.length > 0 && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
            <Icon icon="lucide:help-circle" width={14} style={{color:'var(--cd-text-muted)',flexShrink:0}} />
            <span style={{ fontSize: 12, color: 'var(--cd-text-sec)' }}>{curso.preguntas.length} preguntas de evaluación</span>
          </div>
        )}

        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '0.5px solid var(--cd-border-light)' }}>
          <div style={{ fontSize: 11, color: 'var(--cd-text-muted)', marginBottom: 6 }}>Tu progreso</div>
          <div style={{ height: 6, background: 'var(--cd-border-light)', borderRadius: 3, overflow: 'hidden', marginBottom: 4 }}>
            <div style={{ height: '100%', width: `${progreso}%`, background: progreso >= 100 ? 'var(--success)' : 'var(--azul)', borderRadius: 3, transition: 'width 0.4s' }} />
          </div>
          <div style={{ fontSize: 12, color: progreso >= 100 ? 'var(--success)' : 'var(--cd-text-sec)', fontWeight: 500 }}>{progreso}% completado</div>
        </div>
        {esperandoPractico && !resultado && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '0.5px solid var(--cd-border-light)', background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: 'var(--warning)', display: 'flex', alignItems: 'flex-start', gap: 7 }}>
            <Icon icon="lucide:clock" width={14} style={{flexShrink:0, marginTop:1}} />
            <span>Has aprobado la evaluación. Falta asistir al práctico para certificarte.</span>
          </div>
        )}
      </div>
    </div>
  )
}
