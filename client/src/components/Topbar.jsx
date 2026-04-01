import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { LOGO_SIMBOLO, LOGO_LETRAS } from '../assets/logo'

const avatarColors = {
  colaborador: '#F5A623',
  profesor: '#E8505B',
  admin_sede: '#7BC67A',
  jefatura: '#F5A623',
}

const rolesLabel = {
  colaborador: null,
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

  return (
    <header className="topbar">
      <div className="topbar-left">
        <img src={LOGO_SIMBOLO} alt="ALUMCO símbolo" style={{ height: 32 }} />
        <img src={LOGO_LETRAS} alt="alumco" style={{ height: 20, filter: 'brightness(0) invert(1)' }} />
        <div className="topbar-divider" />
        <span className="topbar-section">{seccion}</span>
      </div>
      <div className="topbar-right">
        {rolesLabel[usuario?.rol] && (
          <span className="role-badge">{rolesLabel[usuario?.rol]}</span>
        )}
        <span className="topbar-name">{usuario?.nombre}</span>
        <div
          className="avatar"
          style={{ background: avatarColors[usuario?.rol] || '#F5A623' }}
          title="Cerrar sesión"
          onClick={() => { logout(); navigate('/login') }}
        >
          {iniciales}
        </div>
      </div>
    </header>
  )
}
