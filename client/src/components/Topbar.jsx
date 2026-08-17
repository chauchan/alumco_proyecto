import { useState, useEffect } from 'react'
import { Icon } from '@iconify/react'
import { useAuth } from '../context/AuthContext'
import { useNavigate, useLocation } from 'react-router-dom'
import { LOGO_SIMBOLO, LOGO_LETRAS } from '../assets/logo'
import api from '../services/api'
import { useAccesibilidad } from '../hooks/useAccesibilidad'
import { resolverAyuda } from '../utils/ayudaPorRuta'
import BuscadorGlobal from './BuscadorGlobal'

const avatarColors = {
  colaborador: 'var(--amarillo)', profesor: 'var(--rojo)',
  admin_sede: 'var(--verde)', jefatura: 'var(--amarillo)',
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
  const entidad = n.entidad || n.tipo;
  if (entidad === 'practico' || entidad === 'practico_asignado') return '/practicos';
  if (entidad === 'curso' || entidad === 'evaluacion') return n.entidad_id ? `/capacitaciones/${n.entidad_id}` : (rutaInicio[rol] || '/');
  if (entidad === 'certificado') return '/mis-certificados';
  return rutaInicio[rol] || '/';
}

const ROLES_VISTA = [
  { rol: 'colaborador', label: 'Colaborador', color: 'var(--amarillo)', ruta: '/colaborador' },
  { rol: 'profesor',    label: 'Profesor',    color: 'var(--rojo)', ruta: '/profesor' },
  { rol: 'admin_sede',  label: 'Admin sede',  color: 'var(--verde)', ruta: '/admin' },
  { rol: 'jefatura',    label: 'Jefatura',    color: 'var(--azul)', ruta: '/jefatura' },
]

export default function Topbar({ seccion }) {
  const { usuario, logout, simularRol } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [notifAbierto, setNotifAbierto] = useState(false)
  const [vistaAbierto, setVistaAbierto] = useState(false)
  const [ayudaAbierto, setAyudaAbierto] = useState(false)
  const [contactoSoporte, setContactoSoporte] = useState(undefined) // undefined = sin cargar, null = sin admin
  const [notificaciones, setNotificaciones] = useState([])
  const [noLeidas, setNoLeidas] = useState(0)
  const { acc, toggle } = useAccesibilidad()

  const abrirAyuda = () => {
    setAyudaAbierto(!ayudaAbierto)
    setMenuAbierto(false); setNotifAbierto(false); setVistaAbierto(false)
    if (contactoSoporte === undefined) {
      api.get('/sedes/mi-admin')
        .then(r => setContactoSoporte(r.data?.contacto || null))
        .catch(() => setContactoSoporte(null))
    }
  }

  useEffect(() => {
    if (!ayudaAbierto) return
    const onKey = e => { if (e.key === 'Escape') setAyudaAbierto(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [ayudaAbierto])

  const mailtoSoporte = contactoSoporte
    ? `mailto:${contactoSoporte.email}?subject=${encodeURIComponent(`[ALUMCO] Ayuda — ${rolesLabel[usuario?.rol] || usuario?.rol}`)}&body=${encodeURIComponent(`Hola ${contactoSoporte.nombre},\n\nNecesito ayuda con:\n\n---\nRol: ${usuario?.rol}\nSede: ${usuario?.sede_nombre || ''}\nPágina: ${location.pathname}`)}`
    : null

  const ayudaContenido = resolverAyuda(location.pathname, usuario?.rol)

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
        {/* El logotipo de letras mide ~78px: con él, la fila del topbar pasa de
            los 360px de un móvil corriente y el logo terminaba solapado con los
            botones de accesibilidad. El isotipo de al lado ya identifica la marca. */}
        <img src={LOGO_LETRAS} alt="alumco" className="topbar-hide-mobile"
          style={{ height: 18, filter: 'brightness(0) invert(1)', cursor: 'pointer' }}
          onClick={() => navigate(rutaInicio[usuario?.rol] || '/')} />
        <div className="topbar-divider topbar-hide-mobile" />
        <span className="topbar-section topbar-hide-mobile">{seccion}</span>
      </div>

      <div className="topbar-right" style={{ position: 'relative' }}>
        {rolesLabel[usuario?.rol] && <span className="role-badge topbar-hide-mobile">{rolesLabel[usuario?.rol]}</span>}
        <span className="topbar-name topbar-hide-mobile">{usuario?.nombre}</span>

        {/* Botones accesibilidad */}
        <div className="topbar-a11y" style={{ display:'flex', gap:4, marginRight:2 }}>
          <button
            onClick={() => toggle('textoGrande')}
            title="Texto grande"
            style={{
              background: acc.textoGrande ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.15)',
              border: acc.textoGrande ? '1.5px solid #fff' : '1px solid rgba(255,255,255,0.3)',
              borderRadius: 6, padding: '3px 8px', cursor: 'pointer',
              color: acc.textoGrande ? 'var(--azul-oscuro)' : 'rgba(255,255,255,0.85)',
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
            <span className="topbar-hide-mobile">{acc.altoContraste ? 'ON' : 'contraste'}</span>
          </button>
        </div>

        <BuscadorGlobal />

        {/* Campana de notificaciones */}
        <div style={{ position: 'relative' }}>
          <div
            onClick={() => { setNotifAbierto(!notifAbierto); setMenuAbierto(false) }}
            style={{ cursor: 'pointer', position: 'relative', padding: 4 }}
            title="Notificaciones"
          >
            <Icon icon="lucide:bell" width={20} style={{ color: 'rgba(255,255,255,0.85)', display: 'block' }} />
            {noLeidas > 0 && (
              <div style={{
                position: 'absolute', top: 0, right: 0,
                width: 16, height: 16, borderRadius: '50%',
                background: 'var(--rojo)', color: 'white',
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
              <div className="topbar-dropdown" style={{
                position: 'absolute', top: 42, right: 0, zIndex: 100,
                background: 'white', borderRadius: 10, border: '0.5px solid var(--gris-borde)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.12)', width: 320, overflow: 'hidden'
              }}>
                <div style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--gris-borde)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>Notificaciones</span>
                  {noLeidas > 0 && (
                    <button onClick={handleLeerTodas}
                      style={{ fontSize: 11, color: 'var(--azul)', background: 'none', border: 'none', cursor: 'pointer' }}>
                      Marcar todas como leídas
                    </button>
                  )}
                </div>
                <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                  {notificaciones.length === 0 ? (
                    <div style={{ padding: 24, textAlign: 'center', color: 'var(--texto-muted)', fontSize: 13 }}>
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
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: n.leida ? '#CCC' : 'var(--azul)', marginTop: 4, flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--texto)', marginBottom: 2 }}>{n.titulo}</div>
                          <div style={{ fontSize: 11, color: '#666', lineHeight: 1.5 }}>{n.mensaje}</div>
                          <div style={{ fontSize: 10, color: 'var(--texto-muted)', marginTop: 4 }}>
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

        {/* Ayuda / contacto de soporte */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={abrirAyuda}
            title="Ayuda"
            aria-label="Ayuda"
            aria-expanded={ayudaAbierto}
            style={{
              background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: 7, padding: '4px 10px', cursor: 'pointer', color: '#fff',
              fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 5,
              letterSpacing: '0.03em'
            }}>
            <Icon icon="lucide:circle-help" width={14} /> <span className="topbar-hide-mobile">Ayuda</span>
          </button>
          {ayudaAbierto && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setAyudaAbierto(false)} />
              <div role="dialog" aria-label="Ayuda" className="topbar-dropdown" style={{
                position: 'absolute', top: 42, right: 0, zIndex: 100,
                background: 'white', borderRadius: 10, border: '0.5px solid var(--gris-borde)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.14)', width: 300, overflow: 'hidden', padding: 16
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--texto)' }}>{ayudaContenido.titulo}</div>
                {ayudaContenido.pasos.length > 0 ? (
                  <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--texto-sec)', lineHeight: 1.7 }}>
                    {ayudaContenido.pasos.map((paso, i) => <li key={i}>{paso}</li>)}
                  </ol>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--texto-muted)' }}>Sin ayuda específica para esta pantalla todavía.</div>
                )}

                <div style={{ height: 1, background: 'var(--gris-borde)', margin: '14px 0' }} />

                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--texto)' }}>¿Necesitas más ayuda?</div>
                {contactoSoporte === undefined ? (
                  <div style={{ fontSize: 12, color: 'var(--texto-muted)' }}>Buscando a tu administrador de sede...</div>
                ) : contactoSoporte ? (
                  <>
                    <div style={{ fontSize: 12, color: 'var(--texto-sec)', marginBottom: 8, lineHeight: 1.5 }}>
                      Escribe a <strong>{contactoSoporte.nombre}</strong>, administrador(a) de tu ELEAM.
                    </div>
                    <a href={mailtoSoporte}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--azul)', fontWeight: 500, textDecoration: 'none' }}>
                      <Icon icon="lucide:mail" width={14} /> {contactoSoporte.email}
                    </a>
                  </>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--texto-muted)', lineHeight: 1.5 }}>
                    No encontramos un administrador de sede asociado a tu cuenta todavía. Contacta directamente a ALUMCO.
                  </div>
                )}

                {/* Rescatado del panel anterior: en el test, la participante solo
                    encontró estos botones recorriendo el topbar con la vista. */}
                <div style={{ height: 1, background: 'var(--gris-borde)', margin: '14px 0' }} />
                <div style={{ fontSize: 12, color: 'var(--texto-muted)', lineHeight: 1.5 }}>
                  Los botones <b>A+</b> y <b>contraste</b>, aquí arriba, agrandan el texto y activan un modo de alto contraste.
                </div>
              </div>
            </>
          )}
        </div>

        {/* Switcher de vista rápida (solo en desarrollo) */}
        {import.meta.env.DEV && (
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
              <div className="topbar-dropdown" style={{
                position: 'absolute', top: 42, right: 0, zIndex: 100,
                background: 'white', borderRadius: 10, border: '0.5px solid var(--gris-borde)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.14)', minWidth: 170, overflow: 'hidden'
              }}>
                <div style={{ padding: '9px 14px', borderBottom: '0.5px solid #EEE', fontSize: 10, fontWeight: 700, color: 'var(--texto-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Cambiar vista
                </div>
                {ROLES_VISTA.map(r => (
                  <div key={r.rol}
                    onClick={() => { simularRol(r.rol); navigate(r.ruta); setVistaAbierto(false) }}
                    style={{
                      padding: '9px 14px', fontSize: 13, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 9,
                      background: usuario?.rol === r.rol ? 'var(--gris-fondo)' : 'transparent',
                      fontWeight: usuario?.rol === r.rol ? 600 : 400,
                      color: 'var(--texto)'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--gris-fondo)'}
                    onMouseLeave={e => e.currentTarget.style.background = usuario?.rol === r.rol ? 'var(--gris-fondo)' : 'transparent'}
                  >
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: r.color, flexShrink: 0 }} />
                    {r.label}
                    {usuario?.rol === r.rol && <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--texto-muted)' }}>actual</span>}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        )}

        {/* Avatar con menú */}
        <div style={{ position: 'relative' }}>
          <div className="avatar"
            style={{ background: avatarColors[usuario?.rol] || 'var(--amarillo)', cursor: 'pointer' }}
            onClick={() => { setMenuAbierto(!menuAbierto); setNotifAbierto(false) }}
            title="Opciones de cuenta"
          >
            {iniciales}
          </div>

          {menuAbierto && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setMenuAbierto(false)} />
              <div className="topbar-dropdown" style={{
                position: 'absolute', top: 42, right: 0, zIndex: 100,
                background: 'white', borderRadius: 10, border: '0.5px solid var(--gris-borde)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.12)', minWidth: 200, overflow: 'hidden'
              }}>
                <div style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--gris-borde)', background: '#F9F9F9' }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{usuario?.nombre}</div>
                  <div style={{ fontSize: 11, color: 'var(--texto-muted)', marginTop: 2 }}>{usuario?.identificador}</div>
                  {usuario?.sede_nombre && <div style={{ fontSize: 11, color: 'var(--texto-muted)' }}>{usuario.sede_nombre}</div>}
                </div>
                {[
                  { icon: 'lucide:user', label: 'Mis datos', path: '/mis-datos' },
                  { icon: 'lucide:lock', label: 'Cambiar contraseña', path: '/cambiar-password' },
                ].map(item => (
                  <div key={item.label}
                    style={{ padding: '10px 16px', fontSize: 13, color: 'var(--texto)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                    onClick={() => { setMenuAbierto(false); navigate(item.path) }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--gris-fondo)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <Icon icon={item.icon} width={14} /> {item.label}
                  </div>
                ))}
                <div
                  style={{ padding: '10px 16px', fontSize: 13, color: 'var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, borderTop: '0.5px solid var(--gris-borde)' }}
                  onClick={handleLogout}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--danger-bg)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <Icon icon="lucide:log-out" width={14} style={{ color: 'var(--danger)' }} />
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
