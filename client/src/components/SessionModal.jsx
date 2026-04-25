import { useAuth } from '../context/AuthContext'

export default function SessionModal() {
  const { mostrarRenovacion, renovarSesion, ignorarRenovacion } = useAuth()

  if (!mostrarRenovacion) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9998,
    }}>
      <div style={{
        background: '#fff', borderRadius: 12, padding: '28px 32px',
        maxWidth: 380, width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      }}>
        <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 8, color: '#1a1a1a' }}>
          Tu sesión expira pronto
        </div>
        <div style={{ fontSize: 13, color: '#666', lineHeight: 1.6, marginBottom: 24 }}>
          Tu sesión cerrará en menos de 30 minutos. ¿Deseas continuar conectado?
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={ignorarRenovacion} style={{
            background: 'none', border: '0.5px solid #E8E8E8', borderRadius: 8,
            padding: '8px 16px', fontSize: 13, cursor: 'pointer', color: '#666',
          }}>
            No, cerrar después
          </button>
          <button onClick={renovarSesion} style={{
            background: '#2B4BA0', border: 'none', borderRadius: 8,
            padding: '8px 16px', fontSize: 13, cursor: 'pointer',
            color: '#fff', fontWeight: 500,
          }}>
            Continuar conectado
          </button>
        </div>
      </div>
    </div>
  )
}
