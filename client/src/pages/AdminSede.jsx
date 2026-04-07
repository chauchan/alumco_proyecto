import { useState, useEffect } from 'react'
import Topbar from '../components/Topbar'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

export default function AdminSede() {
  const { usuario } = useAuth()
  const [resumen, setResumen] = useState(null)
  const [usuarios, setUsuarios] = useState([])
  const [cursos, setCursos] = useState([])

  useEffect(() => {
    Promise.all([api.get('/reportes/resumen'), api.get('/usuarios'), api.get('/reportes/cursos')])
      .then(([r, u, c]) => { setResumen(r.data); setUsuarios(u.data); setCursos(c.data) })
      .catch(() => {})
  }, [])

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
            <button className="btn-primary">
              <span>+</span> Agregar colaborador
            </button>
          </div>

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
                <span className="card-link">Ver todos →</span>
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
                <span className="card-link">Detalle →</span>
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

          {/* Alertas */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Alertas y acciones requeridas</span>
              <span className="card-link">Gestionar →</span>
            </div>
            {[
              { color:'#E8505B', text:"Un colaborador falló 2 veces en 'Plan de emergencia' — requiere refuerzo presencial", time:'Hoy' },
              { color:'#F5A623', text:'Certificado de Protocolo de caídas vence próximamente para varios colaboradores', time:'En 14 días' },
            ].map((a,i) => (
              <div key={i} className="row-divider" style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'8px 0' }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:a.color, marginTop:4, flexShrink:0 }} />
                <span style={{ fontSize:12, flex:1 }}>{a.text}</span>
                <span style={{ fontSize:11, color:'#888', whiteSpace:'nowrap' }}>{a.time}</span>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  )
}
