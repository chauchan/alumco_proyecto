import { useState, useEffect } from 'react'
import { Icon } from '@iconify/react'
import { useNavigate } from 'react-router-dom'
import Topbar from '../components/Topbar'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import { useToast } from '../context/ToastContext'

export default function AdminSede() {
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [resumen, setResumen] = useState(null)
  const [enviandoRecordatorios, setEnviandoRecordatorios] = useState(false)
  const [usuarios, setUsuarios] = useState([])
  const [cursos, setCursos] = useState([])
  const [notificaciones, setNotificaciones] = useState([])
  const [doblesFallos, setDoblesFallos] = useState([])
  const [enviandoCorreo, setEnviandoCorreo] = useState(false)
  const [msgCorreo, setMsgCorreo] = useState('')

  useEffect(() => {
    Promise.all([
      api.get('/reportes/resumen'),
      api.get('/usuarios'),
      api.get('/reportes/cursos'),
      api.get('/notificaciones'),
      api.get('/evaluaciones/dobles-fallos').catch(() => ({ data: [] })),
    ])
      .then(([r, u, c, n, df]) => {
        setResumen(r.data)
        setUsuarios(u.data)
        setCursos(c.data)
        setNotificaciones(n.data.notificaciones || [])
        setDoblesFallos(df.data || [])
      })
      .catch(() => {})
  }, [])

  const marcarLeida = (id) => {
    api.patch(`/notificaciones/${id}/leer`).catch(() => {})
    setNotificaciones(prev => prev.map(n => n.id === id ? { ...n, leida: true } : n))
  }

  const marcarTodasLeidas = () => {
    api.patch('/notificaciones/leer-todas').catch(() => {})
    setNotificaciones(prev => prev.map(n => ({ ...n, leida: true })))
  }

  const tiempoRelativo = (fecha) => {
    const diff = Date.now() - new Date(fecha).getTime()
    const dias = Math.floor(diff / 86400000)
    if (dias === 0) return 'Hoy'
    if (dias === 1) return 'Ayer'
    if (dias < 7) return `Hace ${dias} días`
    return new Date(fecha).toLocaleDateString('es-CL')
  }

  const noLeidas = notificaciones.filter(n => !n.leida).length

  const enviarRecordatoriosAhora = async () => {
    setEnviandoRecordatorios(true)
    try {
      const { data } = await api.post('/reportes/enviar-recordatorios')
      toast.success(`Recordatorios enviados: ${data.enviados} de ${data.total}${data.errores > 0 ? ` (${data.errores} errores)` : ''}`)
    } catch {
      toast.error('Error al enviar recordatorios')
    } finally {
      setEnviandoRecordatorios(false)
    }
  }

  const navItems = [
    { label:'Resumen', active:true, badge:null },
    { label:'Colaboradores', active:false, badge:'3' },
    { label:'Certificados', active:false, badge:null },
    { label:'Métricas', active:false, badge:null },
    { label:'Reportes', active:false, badge:null },
    { label:'Configuración', active:false, badge:null },
  ]

  const statusClass = (u) => {
    if (u.status === 'fallo') return 'status-fallo'
    if (u.tipo_contrato === 'reemplazo') return 'status-pend'
    return 'status-ok'
  }
  const statusLabel = (u) => {
    if (u.status === 'fallo') return 'Doble fallo'
    if (u.tipo_contrato === 'reemplazo') return 'Reemplazo'
    return 'Al día'
  }

  const avatarBg = ['#2B4BA0','#F5A623','#E8505B','#7BC67A']

  return (
    <div className="app-shell">
      <Topbar seccion={`Administración · ${usuario?.sede_nombre || 'Sede'}`} />
      <div className="app-body">

        <Sidebar />

        <main className="main-content" style={{ display:'flex', flexDirection:'column', gap:16 }}>

          {/* Header */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
            <div>
              <div className="page-title">Resumen de sede</div>
              <div className="page-sub">{usuario?.sede_nombre} · {new Date().toLocaleDateString('es-CL',{month:'long',year:'numeric'})}</div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button className="btn-outline-dark" onClick={enviarRecordatoriosAhora} disabled={enviandoRecordatorios}>
                <><Icon icon="lucide:bell" width={13} style={{verticalAlign:"middle",marginRight:4}} /> {enviandoRecordatorios ? 'Enviando…' : 'Enviar recordatorios'}</>
              </button>
              <button className="btn-primary" onClick={() => navigate('/jefatura/usuarios')}>
                <span>+</span> Agregar colaborador
              </button>
            </div>
          </div>
          {msgCorreo && (
            <div style={{ background:'#EEF2FF', border:'0.5px solid #2B4BA0', borderRadius:8, padding:'10px 14px', fontSize:13, color:'#1E3A6E' }}>
              <Icon icon="lucide:mail" width={13} style={{verticalAlign:'middle',marginRight:4}} /> {msgCorreo}
            </div>
          )}

          {/* Stats */}
          <div className="stats-grid-4">
            {[
              { val: resumen?.total_colaboradores ?? '—', label:'Colaboradores activos', sub:'en esta sede', color:'#7BC67A' },
              { val: resumen?.capacitados_al_dia ?? '—', label:'Capacitados al día', sub:'con todos sus cursos', color:'#F5A623' },
              { val: resumen?.certificados_emitidos ?? '—', label:'Certificados emitidos', sub:'este trimestre', color:'#2B4BA0' },
              { val: resumen?.requieren_atencion ?? '—', label:'Requieren atención', sub:'doble fallo o vencidos', color:'#E8505B' },
            ].map(s => (
              <div key={s.label} className="stat-card">
                <div className="stat-label">{s.label}</div>
                <div className="stat-value" style={{ color:s.color }}>{s.val}</div>
                <div className="stat-sub">{s.sub}</div>
              </div>
            ))}
          </div>

          {/* Dos columnas */}
          <div className="two-col">
            {/* Colaboradores */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Colaboradores — estado</span>
                <span className="card-link">Ver todos <Icon icon="lucide:arrow-right" width={12} style={{verticalAlign:"middle",marginLeft:3}} /></span>
              </div>
              {usuarios.slice(0,5).map((u, i) => (
                <div key={u.id} className="row-divider" style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0' }}>
                  <div className="avatar" style={{ width:30, height:30, fontSize:11, background:avatarBg[i%4], flexShrink:0 }}>
                    {u.nombre.split(' ').map(n=>n[0]).slice(0,2).join('')}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:12, fontWeight:500 }}>{u.nombre}</div>
                    <div style={{ fontSize:11, color:'#888' }}>{u.tipo_contrato || 'Fijo'}</div>
                  </div>
                  <span className={`status-pill ${statusClass(u)}`}>{statusLabel(u)}</span>
                </div>
              ))}
            </div>

            {/* Progreso cursos */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Progreso por curso</span>
                <span className="card-link">Detalle <Icon icon="lucide:arrow-right" width={12} style={{verticalAlign:"middle",marginLeft:3}} /></span>
              </div>
              {cursos.slice(0,5).map(c => (
                <div key={c.id} style={{ marginBottom:14 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4 }}>
                    <span>{c.nombre}</span>
                    <span style={{ color:'#888' }}>{c.pct_completado || 0}%</span>
                  </div>
                  <div className="progress-bar-wrap" style={{ height:5 }}>
                    <div className="progress-bar-fill" style={{ width:`${c.pct_completado||0}%`, background:'#2B4BA0' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Dobles fallos activos */}
          {doblesFallos.length > 0 && (
            <div className="card" style={{ borderLeft:'3px solid #E8505B' }}>
              <div className="card-header">
                <span className="card-title" style={{ color:'#E8505B' }}>
                  <Icon icon="lucide:alert-triangle" width={14} style={{verticalAlign:'middle',marginRight:4}} />
                  Colaboradores bloqueados por doble fallo
                  <span style={{ marginLeft:8, background:'#E8505B', color:'#fff', borderRadius:10, fontSize:10, fontWeight:700, padding:'2px 7px' }}>
                    {doblesFallos.length}
                  </span>
                </span>
              </div>
              {doblesFallos.map(df => (
                <div key={`${df.usuario_id}-${df.curso_id}`} className="row-divider" style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0' }}>
                  <div style={{ width:32, height:32, borderRadius:'50%', background:'#FFF0F0', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <Icon icon="lucide:user-x" width={15} style={{ color:'#E8505B' }} />
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:12, fontWeight:500 }}>{df.usuario_nombre}</div>
                    <div style={{ fontSize:11, color:'#888' }}>Bloqueado en: {df.curso_nombre}</div>
                  </div>
                  <span style={{ fontSize:10, color:'#E8505B', background:'#FFF0F0', borderRadius:6, padding:'2px 8px', fontWeight:600 }}>
                    Doble fallo
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Alertas / Notificaciones */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">
                Alertas y acciones requeridas
                {noLeidas > 0 && (
                  <span style={{ marginLeft:8, background:'#E8505B', color:'#fff', borderRadius:10, fontSize:10, fontWeight:700, padding:'2px 7px' }}>
                    {noLeidas}
                  </span>
                )}
              </span>
              {noLeidas > 0 && (
                <button onClick={marcarTodasLeidas}
                  style={{ fontSize:11, color:'#2B4BA0', background:'none', border:'none', cursor:'pointer' }}>
                  Marcar todas como leídas
                </button>
              )}
            </div>
            {notificaciones.length === 0 ? (
              <div style={{ padding:'20px 0', textAlign:'center', color:'#aaa', fontSize:12 }}>
                <Icon icon="lucide:check-circle" width={20} style={{display:'block',margin:'0 auto 8px',color:'#22C55E'}} />
                Sin alertas pendientes
              </div>
            ) : notificaciones.map(n => (
              <div key={n.id}
                className="row-divider"
                style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'10px 0', cursor:'pointer', opacity: n.leida ? 0.55 : 1 }}
                onClick={() => marcarLeida(n.id)}
              >
                <div style={{
                  width:8, height:8, borderRadius:'50%', marginTop:4, flexShrink:0,
                  background: n.leida ? '#CCC' : '#E8505B'
                }} />
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, fontWeight: n.leida ? 400 : 600, color:'#1a1a1a', marginBottom:2 }}>{n.titulo}</div>
                  <div style={{ fontSize:11, color:'#666', lineHeight:1.5 }}>{n.mensaje}</div>
                </div>
                <span style={{ fontSize:11, color:'#AAA', whiteSpace:'nowrap' }}>{tiempoRelativo(n.created_at)}</span>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  )
}
