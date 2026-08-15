import { Icon } from '@iconify/react'
import { useNavigate } from 'react-router-dom'

// Pantalla de bloqueo temporal tras 2 intentos fallidos en la evaluación de un curso.
export default function CursoBloqueado({ fechaDesbloqueo }) {
  const navigate = useNavigate()
  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <div style={{ background: 'var(--cd-card-bg)', borderRadius: 16, padding: '48px 40px', maxWidth: 480, width: '100%', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <Icon icon="lucide:lock" width={56} style={{ color: 'var(--danger)' }} />
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--cd-text)' }}>Curso temporalmente bloqueado</div>
        <div style={{ fontSize: 14, color: 'var(--cd-text-sec)', lineHeight: 1.6 }}>
          Has fallado este curso 2 veces. Podrás intentarlo nuevamente el{' '}
          <strong>{fechaDesbloqueo.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>.
        </div>
        <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-graphic)', borderRadius: 12, padding: '14px 24px', fontSize: 13, color: 'var(--danger)', maxWidth: 360 }}>
          Tu administrador de sede ha sido notificado. Aprovecha este tiempo para repasar los contenidos.
        </div>
        <button onClick={() => navigate('/capacitaciones')}
          style={{ background: 'var(--azul-oscuro)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 28px', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginTop: 8 }}>
          Volver
        </button>
      </div>
    </div>
  )
}
