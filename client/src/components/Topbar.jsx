import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { LOGO_SIMBOLO, LOGO_LETRAS } from '../assets/logo'
import api from '../services/api'

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

export default function Topbar({ seccion }) {
  const { usuario, logout } = useAuth()
  const navigate = useNavigate()
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [notifAbierto, setNotifAbierto] = useState(false)
  const [notificaciones, setNotificaciones] = useState([])
  const [noLeidas, setNoLeidas] = useState(0)

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
                        navigate('/practicos')
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
                  { icon: '📅', label: 'Calendario de prácticos', path: '/practicos' },
                  { icon: '🔒', label: 'Cambiar contraseña', path: '/cambiar-password' },
                ].map(item => (
                  <div key={item.label}
                    style={{ padding: '10px 16px', fontSize: 13, color: '#1a1a1a', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                    onClick={() => { setMenuAbierto(false); navigate(item.path) }}
                    onMouseEnter={e => e.currentTarget.style.background = '#F4F5F7'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <span>{item.icon}</span> {item.label}
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
