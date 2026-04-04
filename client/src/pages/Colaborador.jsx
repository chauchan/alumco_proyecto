import { useState, useEffect } from 'react'
import Topbar from '../components/Topbar'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

const NavIcon = ({ d }) => (
  <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {d}
  </svg>
)

export default function Colaborador() {
  const { usuario } = useAuth()
  const [cursos, setCursos] = useState([])
  const [certificados, setCertificados] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    Promise.all([api.get('/cursos'), api.get('/certificados')])
      .then(([c, cert]) => { setCursos(c.data); setCertificados(cert.data) })
      .catch(() => {})
      .finally(() => setCargando(false))
  }, [])

  const pendientes = cursos.filter(c => !c.completado)
  const completados = cursos.filter(c => c.completado).length
  const certAprobados = certificados.filter(c => c.estado === 'aprobado')

  return (
    <div className="app-shell">
      <Topbar seccion="Mi capacitación" />
      <div className="app-body">

        {/* Sidebar */}
        <Sidebar />

        {/* Main */}
        <main className="main-content" style={{ display:'flex', flexDirection:'column', gap:16 }}>

          {/* Saludo */}
          <div className="greeting-bar">
            <div>
              <div className="greeting-name" style={{ fontSize:17, fontWeight:500, color:'#fff' }}>
                Hola, {usuario?.nombre?.split(' ')[0]} 👋
              </div>
              <div style={{ fontSize:12, color:'rgba(255,255,255,0.7)', marginTop:3 }}>
                {usuario?.sede_nombre} · {usuario?.tipo_contrato === 'fijo' ? 'Funcionaria/o fija/o' : 'Reemplazo'}
              </div>
            </div>
            <div className="greeting-badge">
              <div style={{ fontSize:22, fontWeight:500, color:'#F5A623' }}>{pendientes.length}</div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,0.7)' }}>cursos pendientes</div>
            </div>
          </div>

          {/* Stats */}
          <div className="stats-grid-3">
            {[
              { val: completados, label:'Cursos completados', sub:'este período' },
              { val: certAprobados.length, label:'Certificados obtenidos', sub:'disponibles para descarga' },
              { val:'Hoy', label:'Último acceso', sub:'sesión activa' },
            ].map(s => (
              <div key={s.label} className="stat-card">
                <div className="stat-label">{s.label}</div>
                <div className="stat-value">{s.val}</div>
                <div className="stat-sub">{s.sub}</div>
              </div>
            ))}
          </div>

          {/* Cursos pendientes */}
          <div>
            <div className="card-header" style={{ marginBottom:10 }}>
              <span className="card-title" style={{ fontSize:14 }}>Cursos pendientes</span>
              <span className="card-link">Ver todos →</span>
            </div>
            {cargando ? (
              <div className="card" style={{ textAlign:'center', color:'#888', padding:24 }}>Cargando cursos...</div>
            ) : pendientes.length === 0 ? (
              <div className="card" style={{ textAlign:'center', color:'#888', padding:24 }}>
                ¡Estás al día con todos tus cursos!
              </div>
            ) : pendientes.map(curso => (
              <div key={curso.id} className="card" style={{ display:'flex', alignItems:'center', gap:14, marginBottom:8 }}>
                <div style={{ width:36, height:36, borderRadius:8, background:'#FFF0EC', flexShrink:0 }} />
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:500 }}>
                    {curso.nombre}
                    <span className="badge-nuevo" style={{ marginLeft:8 }}>Nuevo</span>
                  </div>
                  <div style={{ fontSize:11, color:'#888', marginTop:3 }}>{curso.area || 'General'}</div>
                  <div className="progress-bar-wrap" style={{ marginTop:6 }}>
                    <div className="progress-bar-fill" style={{ width:`${curso.progreso||0}%` }} />
                  </div>
                </div>
                <button className={curso.progreso > 0 ? 'btn-sm btn-sm-outline' : 'btn-primary'} style={{ fontSize:12 }}>
                  {curso.progreso > 0 ? 'Continuar' : 'Iniciar'}
                </button>
              </div>
            ))}
          </div>

          {/* Certificados */}
          <div>
            <div className="card-header" style={{ marginBottom:10 }}>
              <span className="card-title" style={{ fontSize:14 }}>Certificados recientes</span>
              <span className="card-link">Ver todos →</span>
            </div>
            {certAprobados.slice(0,3).map(cert => (
              <div key={cert.id} className="card" style={{ display:'flex', alignItems:'center', gap:12, marginBottom:8 }}>
                <div style={{ width:32, height:32, background:'#EEF2FF', borderRadius:8, flexShrink:0 }} />
                <span style={{ flex:1, fontSize:13 }}>{cert.curso_nombre}</span>
                <span style={{ fontSize:11, color:'#888' }}>
                  {cert.fecha_emision ? new Date(cert.fecha_emision).toLocaleDateString('es-CL') : ''}
                </span>
                <a href={`/api/certificados/${cert.id}/descargar`} style={{
                  fontSize:11, color:'#2B4BA0', border:'0.5px solid #E8E8E8',
                  borderRadius:8, padding:'5px 10px', display:'flex', alignItems:'center', gap:4
                }}>
                  ↓ Descargar
                </a>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  )
}
