import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'

import LOGO from '../assets/logo'


const rolesLabel = {
  colaborador: 'Colaborador',
  profesor: 'Profesor',
  admin_sede: 'Admin sede',
  jefatura: 'Jefatura',
}

export default function Topbar({ seccion }) {
  const { usuario, logout } = useAuth()
  const navigate = useNavigate()

  const iniciales = usuario?.nombre
    ? usuario.nombre.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  const avatarColors = {
    colaborador: '#F5A623',
    profesor: '#E8505B',
    admin_sede: '#7BC67A',
    jefatura: '#F5A623',
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header style={{
      background: usuario?.rol === 'jefatura' ? '#1E3A6E' : '#2B4BA0',
      height: 56, display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', padding: '0 24px',
      position: 'sticky', top: 0, zIndex: 100
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <img src={LOGO} alt="ALUMCO" style={{ height: 32 }} />
        <div style={{ width: 1, height: 22, background: 'rgba(255,255,255,0.25)' }} />
        <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>{seccion}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{
          fontSize: 10, background: 'rgba(255,255,255,0.18)',
          color: 'white', borderRadius: 20, padding: '2px 8px'
        }}>
          {rolesLabel[usuario?.rol]}
        </span>
        <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>{usuario?.nombre}</span>
        <div
          onClick={handleLogout}
          title="Cerrar sesión"
          style={{
            width: 34, height: 34, borderRadius: '50%',
            background: avatarColors[usuario?.rol] || '#F5A623',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 600, color: 'white', cursor: 'pointer'
          }}
        >
          {iniciales}
        </div>
      </div>
    </header>
  )
}
