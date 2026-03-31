import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'

const LogoSVG = ({ size = 32 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
    <polygon points="50,5 72,27 50,27" fill="#7BC67A"/>
    <polygon points="50,5 28,27 50,27" fill="#1E3A6E"/>
    <polygon points="72,27 95,50 72,50" fill="#E8505B"/>
    <polygon points="5,50 28,27 28,50" fill="#F5A623"/>
    <polygon points="28,50 50,50 28,72" fill="#1E3A6E"/>
    <polygon points="72,50 95,50 72,72" fill="#7BC67A"/>
    <polygon points="28,72 50,72 50,95" fill="#E8505B"/>
    <polygon points="50,72 72,72 50,95" fill="#F5A623"/>
    <polygon points="50,33 62,50 50,62 38,50" fill="#E8505B"/>
  </svg>
)

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

export { LogoSVG }

export default function Topbar({ seccion, dark = false }) {
  const { usuario, logout } = useAuth()
  const navigate = useNavigate()

  const iniciales = usuario?.nombre
    ? usuario.nombre.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  return (
    <header className={`topbar ${dark ? 'topbar-dark' : ''}`}>
      <div className="topbar-left">
        <LogoSVG size={28} />
        <span className="topbar-logo-text">alumco</span>
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
          onClick={() => { logout(); navigate('/login'); }}
        >
          {iniciales}
        </div>
      </div>
    </header>
  )
}
