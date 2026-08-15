import { Icon } from '@iconify/react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const RUTA_INICIO = { colaborador: '/colaborador', profesor: '/profesor', admin_sede: '/admin', jefatura: '/jefatura' }

export default function NotFound() {
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const inicio = usuario ? (RUTA_INICIO[usuario.rol] || '/') : '/login'

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24,
    }}>
      <Icon icon="lucide:map-pin-off" width={48} style={{ color: '#CCC', marginBottom: 16 }} />
      <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 6, color: '#1a1a1a' }}>Página no encontrada</div>
      <div style={{ fontSize: 13, color: 'var(--texto-muted)', marginBottom: 24, maxWidth: 320 }}>
        La dirección a la que intentaste llegar no existe o ya no está disponible.
      </div>
      <button className="btn-primary" onClick={() => navigate(inicio)}>
        Volver al inicio
      </button>
    </div>
  )
}
