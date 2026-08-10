import { useState, useEffect } from 'react'
import { Icon } from '@iconify/react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { LOGO_SIMBOLO, LOGO_LETRAS } from '../assets/logo'
import api from '../services/api'
import { useAccesibilidad } from '../hooks/useAccesibilidad'

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
  if (n.entidad === 'practico' || n.tipo === 'practico_asignado') return '/practicos';
  return rutaInicio[rol] || '/';
}

/* Ayuda contextual por rol (Fase 2 del plan). El análisis heurístico marcó
   "no hay ningún punto de ayuda en la plataforma" como una de las cuatro
   brechas que atraviesan las 5 pantallas, así que vive en el topbar y no
   dentro de una vista concreta. */
const AYUDA_POR_ROL = {
  colaborador: [
    'Tus cursos pendientes aparecen en el panel de inicio, con la fecha en que vencen.',
    'Para obtener el certificado tienes que revisar todo el contenido y aprobar la evaluación.',
    'Si repruebas dos veces seguidas, el curso queda bloqueado y tu administrador de sede coordina un refuerzo presencial.',
    'Tus certificados quedan guardados en “Mis certificados” y se descargan en PDF.',
  ],
  profesor: [
    'En “Certificados por validar” ves la nota y el número de intento de cada evaluación antes de aprobar o rechazar.',
    'Un curso solo es visible para los colaboradores una vez que lo publicas; mientras tanto queda como borrador.',
    'Doble fallo significa que el colaborador reprobó dos veces seguidas la evaluación de un curso.',
  ],
  admin_sede: [
    '“Alertas y acciones requeridas” agrupa a los colaboradores con doble fallo o con certificación vencida.',
    '“Capacitados al día” son quienes tienen aprobadas todas sus capacitaciones obligatorias, sin ninguna vencida.',
    'Puedes buscar y filtrar la lista de colaboradores, y seleccionar varios para gestionarlos de una vez.',
  ],
  jefatura: [
    'La cobertura es el porcentaje de colaboradores con todas sus capacitaciones obligatorias al día.',
    'Doble fallo significa que el colaborador reprobó dos veces seguidas la evaluación de un curso.',
    'Puedes exportar el resumen, las sedes y los cursos a Excel desde el botón “Exportar a Excel”.',
  ],
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
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [notifAbierto, setNotifAbierto] = useState(false)
  const [vistaAbierto, setVistaAbierto] = useState(false)
  const [ayudaAbierta, setAyudaAbierta] = useState(false)
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

        {/* Ayuda contextual */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => { setAyudaAbierta(v => !v); setMenuAbierto(false); setNotifAbierto(false); setVistaAbierto(false) }}
            aria-label="Ayuda"
            aria-expanded={ayudaAbierta}
            style={{
              width: 30, height: 30, borderRadius: '50%',
              background: ayudaAbierta ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.3)', cursor: 'pointer', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
            <Icon icon="lucide:help-circle" width={16} />
          </button>
          {ayudaAbierta && (
            <>
              <div style={{ position:'fixed', inset:0, zIndex:1 }} onClick={() => setAyudaAbierta(false)} />
              <div style={{
                position:'absolute', top:40, right:0, width:320, zIndex:2,
                background:'white', borderRadius:10, border:'0.5px solid var(--gris-borde)',
                boxShadow:'0 8px 28px rgba(20,30,60,0.18)', overflow:'hidden',
              }}>
                <div style={{ padding:'12px 16px', borderBottom:'0.5px solid var(--gris-borde)', background:'var(--gris-fondo)' }}>
                  <div style={{ fontSize:13, fontWeight:600, color:'var(--texto)' }}>Ayuda de esta sección</div>
                </div>
                <ul style={{ listStyle:'none', margin:0, padding:'6px 0' }}>
                  {(AYUDA_POR_ROL[usuario?.rol] || []).map((linea, i) => (
                    <li key={i} style={{
                      display:'flex', gap:9, padding:'9px 16px',
                      fontSize:13, color:'var(--texto-sec)', lineHeight:1.55,
                    }}>
                      <Icon icon="lucide:dot" width={16} style={{ flexShrink:0, marginTop:2, color:'var(--azul)' }} />
                      <span>{linea}</span>
                    </li>
                  ))}
                </ul>
                <div style={{
                  padding:'10px 16px', borderTop:'0.5px solid var(--gris-borde)',
                  background:'var(--gris-fondo)', fontSize:12, color:'var(--texto-muted)', lineHeight:1.5,
                }}>
                  Los botones <b>A+</b> y <b>contraste</b>, aquí arriba, agrandan el texto y activan un modo de alto contraste.
                </div>
              </div>
            </>
          )}
        </div>

        {/* Botones accesibilidad */}
        <div style={{ display:'flex', gap:4, marginRight:2 }}>
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
              <div style={{
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
              <div style={{
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
              <div style={{
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
