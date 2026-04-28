import { useState, useEffect } from 'react'
import { Icon } from '@iconify/react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { LOGO_SIMBOLO, LOGO_LETRAS } from '../assets/logo'
import api from '../services/api'
import { useAccesibilidad } from '../hooks/useAccesibilidad'

const avatarColors = {
  colaborador: '#F5A623', profesor: '#E8505B',
  admin_sede: '#7BC67A', jefatura: '#F5A623',
}
const rolesLabel = {
  colaborador: null, profesor: 'Profesor',
  admin_sede: 'Admin sede', jefatura: 'Jefatura',
}
const rutaInicio = {
  colaborador: '/colaborador', profesor: '/profesor',
  admin_sede: '/admin', jefatura: '/jefatura',
}

function rutaPorTipo(n, rol) {
  if (n.entidad === 'practico' || n.tipo === 'practico_asignado') return '/practicos';
  return rutaInicio[rol] || '/';
}

const ROLES_VISTA = [
  { rol: 'colaborador', label: 'Colaborador', color: '#F5A623', ruta: '/colaborador' },
  { rol: 'profesor',    label: 'Profesor',    color: '#E8505B', ruta: '/profesor' },
  { rol: 'admin_sede',  label: 'Admin sede',  color: '#7BC67A', ruta: '/admin' },
  { rol: 'jefatura',    label: 'Jefatura',    color: '#2B4BA0', ruta: '/jefatura' },
]

export default function Topbar({ seccion }) {
  const { usuario, logout, simularRol } = useAuth()
  const navigate = useNavigate()
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [notifAbierto, setNotifAbierto] = useState(false)
  const [vistaAbierto, setVistaAbierto] = useState(false)
  const [notificaciones, setNotificaciones] = useState([])
  const [noLeidas, setNoLeidas] = useState(0)
  const { acc, toggle } = useAccesibilidad()

  const iniciales = usuario?.nombre
    ? usuario.nombre.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  const cargarNotificaciones = () => {
    api.get('/notificaciones')
      .then(res => {
        setNotificaciones(res.data.notificaciones)
        setNoLeidas(res.data.no_leidas)
      })
      .catch(() => {})
  }

  useEffect(() => {
    cargarNotificaciones()
    // Polling cada 60 segundos
    const interval = setInterval(cargarNotificaciones, 60000)
    return () => clearInterval(interval)
  }, [])

  const handleLeerTodas = async () => {
    await api.patch('/notificaciones/leer-todas')
    setNoLeidas(0)
    setNotificaciones(prev => prev.map(n => ({ ...n, leida: true })))
  }

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <header className="topbar" style={{ position: 'sticky', top: 0, zIndex: 100 }}>
      <div className="topbar-left">
        <button
          className="hamburger-btn"
          onClick={() => window.dispatchEvent(new CustomEvent('toggle-sidebar'))}
          aria-label="Menú"
          style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 4 }}
        >
          <Icon icon="lucide:menu" width={22} />
        </button>
        <img src={LOGO_SIMBOLO} alt="ALUMCO" style={{ height: 34, cursor: 'pointer' }}
          onClick={() => navigate(rutaInicio[usuario?.rol] || '/')} />
        <img src={LOGO_LETRAS} alt="alumco"
          style={{ height: 18, filter: 'brightness(0) invert(1)', cursor: 'pointer' }}
          onClick={() => navigate(rutaInicio[usuario?.rol] || '/')} />
        <div className="topbar-divider" />
        <span className="topbar-section">{seccion}</span>
      </div>

      <div className="topbar-right" style={{ position: 'relative' }}>
        {rolesLabel[usuario?.rol] && <span className="role-badge">{rolesLabel[usuario?.rol]}</span>}
        <span className="topbar-name">{usuario?.nombre}</span>

        {/* Botones accesibilidad */}
        <div style={{ display:'flex', gap:4, marginRight:2 }}>
          <button
            onClick={() => toggle('textoGrande')}
            title="Texto grande"
            style={{
              background: acc.textoGrande ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.15)',
              border: acc.textoGrande ? '1.5px solid #fff' : '1px solid rgba(255,255,255,0.3)',
              borderRadius: 6, padding: '3px 8px', cursor: 'pointer',
              color: acc.textoGrande ? '#1E3A6E' : 'rgba(255,255,255,0.85)',
              fontSize: 12, fontWeight: acc.textoGrande ? 700 : 400, lineHeight: 1,
            }}>
            A+
          </button>
          <button
            onClick={() => toggle('altoContraste')}
            title="Modo contraste (dislexia)"
            style={{
              background: acc.altoContraste ? '#FFF0B0' : 'rgba(255,255,255,0.15)',
              border: acc.altoContraste ? '1.5px solid #B8860B' : '1px solid rgba(255,255,255,0.3)',
              borderRadius: 6, padding: '3px 7px', cursor: 'pointer',
              color: acc.altoContraste ? '#7B3F00' : 'rgba(255,255,255,0.85)',
              fontSize: 11, fontWeight: acc.altoContraste ? 700 : 400,
              display: 'flex', alignItems: 'center', gap: 3,
            }}>
            <Icon icon="lucide:eye" width={13} />
            {acc.altoContraste ? 'ON' : 'contraste'}
          </button>
        </div>

        {/* Campana de notificaciones */}
        <div style={{ position: 'relative' }}>
          <div
            onClick={() => { setNotifAbierto(!notifAbierto); setMenuAbierto(false) }}
            style={{ cursor: 'pointer', position: 'relative', padding: 4 }}
            title="Notificaciones"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            {noLeidas > 0 && (
              <div style={{
                position: 'absolute', top: 0, right: 0,
                width: 16, height: 16, borderRadius: '50%',
                background: '#E8505B', color: 'white',
                fontSize: 9, fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                {noLeidas > 9 ? '9+' : noLeidas}
              </div>
            )}
          </div>

          {notifAbierto && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setNotifAbierto(false)} />
              <div style={{
                position: 'absolute', top: 42, right: 0, zIndex: 100,
                background: 'white', borderRadius: 10, border: '0.5px solid #E8E8E8',
                boxShadow: '0 4px 16px rgba(0,0,0,0.12)', width: 320, overflow: 'hidden'
              }}>
                <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #E8E8E8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>Notificaciones</span>
                  {noLeidas > 0 && (
                    <button onClick={handleLeerTodas}
                      style={{ fontSize: 11, color: '#2B4BA0', background: 'none', border: 'none', cursor: 'pointer' }}>
                      Marcar todas como leídas
                    </button>
                  )}
                </div>
                <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                  {notificaciones.length === 0 ? (
                    <div style={{ padding: 24, textAlign: 'center', color: '#888', fontSize: 13 }}>
                      Sin notificaciones
                    </div>
                  ) : notificaciones.map(n => (
                    <div key={n.id} style={{
                      padding: '12px 16px', borderBottom: '0.5px solid #F0F0F0',
                      background: n.leida ? 'white' : '#F0F4FF', cursor: 'pointer'
                    }}
                      onClick={() => {
                        api.patch(`/notificaciones/${n.id}/leer`)
                        setNoLeidas(prev => Math.max(0, prev - (n.leida ? 0 : 1)))
                        setNotificaciones(prev => prev.map(x => x.id === n.id ? { ...x, leida: true } : x))
                        navigate(rutaPorTipo(n, usuario?.rol))
                        setNotifAbierto(false)
                      }}
                    >
                      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: n.leida ? '#CCC' : '#2B4BA0', marginTop: 4, flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 500, color: '#1a1a1a', marginBottom: 2 }}>{n.titulo}</div>
                          <div style={{ fontSize: 11, color: '#666', lineHeight: 1.5 }}>{n.mensaje}</div>
                          <div style={{ fontSize: 10, color: '#AAA', marginTop: 4 }}>
                            {new Date(n.created_at).toLocaleDateString('es-CL')}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Switcher de vista rápida */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => { setVistaAbierto(!vistaAbierto); setMenuAbierto(false); setNotifAbierto(false) }}
            title="Cambiar vista"
            style={{
              background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: 7, padding: '4px 10px', cursor: 'pointer', color: '#fff',
              fontSize: 11, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 5,
              letterSpacing: '0.03em'
            }}>
            <Icon icon="lucide:arrows-left-right" width={14} /> Vista
          </button>
          {vistaAbierto && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setVistaAbierto(false)} />
              <div style={{
                position: 'absolute', top: 42, right: 0, zIndex: 100,
                background: 'white', borderRadius: 10, border: '0.5px solid #E8E8E8',
                boxShadow: '0 4px 16px rgba(0,0,0,0.14)', minWidth: 170, overflow: 'hidden'
              }}>
                <div style={{ padding: '9px 14px', borderBottom: '0.5px solid #EEE', fontSize: 10, fontWeight: 700, color: '#AAA', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Cambiar vista
                </div>
                {ROLES_VISTA.map(r => (
                  <div key={r.rol}
                    onClick={() => { simularRol(r.rol); navigate(r.ruta); setVistaAbierto(false) }}
                    style={{
                      padding: '9px 14px', fontSize: 13, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 9,
                      background: usuario?.rol === r.rol ? '#F4F5F7' : 'transparent',
                      fontWeight: usuario?.rol === r.rol ? 600 : 400,
                      color: '#1a1a1a'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#F4F5F7'}
                    onMouseLeave={e => e.currentTarget.style.background = usuario?.rol === r.rol ? '#F4F5F7' : 'transparent'}
                  >
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: r.color, flexShrink: 0 }} />
                    {r.label}
                    {usuario?.rol === r.rol && <span style={{ marginLeft: 'auto', fontSize: 10, color: '#AAA' }}>actual</span>}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Avatar con menú */}
        <div style={{ position: 'relative' }}>
          <div className="avatar"
            style={{ background: avatarColors[usuario?.rol] || '#F5A623', cursor: 'pointer' }}
            onClick={() => { setMenuAbierto(!menuAbierto); setNotifAbierto(false) }}
            title="Opciones de cuenta"
          >
            {iniciales}
          </div>

          {menuAbierto && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setMenuAbierto(false)} />
              <div style={{
                position: 'absolute', top: 42, right: 0, zIndex: 100,
                background: 'white', borderRadius: 10, border: '0.5px solid #E8E8E8',
                boxShadow: '0 4px 16px rgba(0,0,0,0.12)', minWidth: 200, overflow: 'hidden'
              }}>
                <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #E8E8E8', background: '#F9F9F9' }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{usuario?.nombre}</div>
                  <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{usuario?.identificador}</div>
                  {usuario?.sede_nombre && <div style={{ fontSize: 11, color: '#888' }}>{usuario.sede_nombre}</div>}
                </div>
                {[
                  { icon: 'lucide:user', label: 'Mis datos', path: '/mis-datos' },
                  { icon: 'lucide:lock', label: 'Cambiar contraseña', path: '/cambiar-password' },
                ].map(item => (
                  <div key={item.label}
                    style={{ padding: '10px 16px', fontSize: 13, color: '#1a1a1a', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                    onClick={() => { setMenuAbierto(false); navigate(item.path) }}
                    onMouseEnter={e => e.currentTarget.style.background = '#F4F5F7'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <Icon icon={item.icon} width={14} /> {item.label}
                  </div>
                ))}
                <div
                  style={{ padding: '10px 16px', fontSize: 13, color: '#E8505B', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, borderTop: '0.5px solid #E8E8E8' }}
                  onClick={handleLogout}
                  onMouseEnter={e => e.currentTarget.style.background = '#FFF0F0'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E8505B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                  Cerrar sesión
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
