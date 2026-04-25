import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// Ítems del sidebar por rol — siempre los mismos sin importar en qué página esté
const NAV_ITEMS = {
  colaborador: [
    { label: 'Inicio',            path: '/colaborador' },
    { label: 'Mis capacitaciones',path: '/capacitaciones' },
    { label: 'Mis certificados',  path: '/mis-certificados' },
    { label: 'Prácticos',         path: '/practicos' },
  ],
  profesor: [
    { label: 'Mis cursos',        path: '/profesor' },
    { label: 'Capacitaciones',    path: '/capacitaciones' },
    { label: 'Mis certificados',  path: '/mis-certificados' },
    { label: 'Prácticos',         path: '/practicos' },
    { label: 'Nuevo curso',       path: '/profesor/nuevo-curso' },
  ],
  admin_sede: [
    { label: 'Resumen',           path: '/admin' },
    { label: 'Capacitaciones',    path: '/capacitaciones' },
    { label: 'Mis certificados',  path: '/mis-certificados' },
    { label: 'Certificados sede', path: '/certificados-globales' },
    { label: 'Prácticos',         path: '/practicos' },
    { label: 'Generador IA',      path: '/jefatura/ia'},
    { label: 'Protocolos',        path: '/jefatura/protocolos' },
  ],
  jefatura: [
    { label: 'Resumen global',    path: '/jefatura' },
    { label: 'Gestión de usuarios', path: '/jefatura/usuarios' },
    { label: 'Capacitaciones',    path: '/capacitaciones' },
    { label: 'Mis certificados',  path: '/mis-certificados' },
    { label: 'Certificados ONG',  path: '/certificados-globales' },
    { label: 'Prácticos',         path: '/practicos' },
    { label: 'Generador IA',      path: '/jefatura/ia'},
    { label: 'Protocolos',        path: '/jefatura/protocolos' },
  ],
}

const SECTION_LABEL = {
  colaborador: 'Principal',
  profesor:    'Docencia',
  admin_sede:  'Gestión',
  jefatura:    'Global ONG',
}

export default function Sidebar() {
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const items = NAV_ITEMS[usuario?.rol] || []
  const label = SECTION_LABEL[usuario?.rol] || 'Menú'

  const MI_CUENTA = [
    { label: 'Mis datos',          path: '/mis-datos' },
    { label: 'Cambiar contraseña', path: '/cambiar-password' },
  ]

  return (
    <aside className="sidebar">
      <div className="nav-section-label">{label}</div>
      {items.map(item => {
        const isActive = location.pathname === item.path
        return (
          <div
            key={item.label}
            className={`nav-item ${isActive ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
          >
            <span style={{ flex: 1 }}>{item.label}</span>
          </div>
        )
      })}

      <div style={{ marginTop: 'auto', borderTop: '0.5px solid var(--gris-borde)', paddingTop: 4 }}>
        <div className="nav-section-label">Mi cuenta</div>
        {MI_CUENTA.map(item => {
          const isActive = location.pathname === item.path
          return (
            <div
              key={item.label}
              className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              <span style={{ flex: 1 }}>{item.label}</span>
            </div>
          )
        })}
      </div>
    </aside>
  )
}
