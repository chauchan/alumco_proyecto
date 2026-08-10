import { useState, useEffect } from 'react'
import { Icon } from '@iconify/react'
import { useNavigate } from 'react-router-dom'
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
  const navigate = useNavigate()
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

  const ultimoAcceso = (() => {
    const fecha = usuario?.ultimo_acceso
    if (!fecha) return 'Primera sesión'
    return new Date(fecha).toLocaleString('es-CL', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
  })()

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
                Hola, {usuario?.nombre?.split(' ')[0]}
              </div>
              <div style={{ fontSize:12, color:'rgba(255,255,255,0.7)', marginTop:4, textTransform:'capitalize' }}>
                {new Date().toLocaleDateString('es-CL', { weekday:'long', day:'numeric', month:'long' })}
              </div>
            </div>
            <div className="greeting-badge">
              <div style={{ fontSize:22, fontWeight:500, color:'var(--warning)' }}>{pendientes.length}</div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,0.7)' }}>cursos pendientes</div>
            </div>
          </div>

          {/* Stats */}
          <div className="stats-grid-3">
            {[
              { val: completados, label:'Cursos completados', sub:'este período' },
              { val: certAprobados.length, label:'Certificados obtenidos', sub:'disponibles para descarga' },
              { val: ultimoAcceso, label:'Último acceso', sub:'sesión activa' },
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
              <span className="card-link" onClick={() => navigate('/capacitaciones')} style={{ cursor:'pointer' }}>Ver todos <Icon icon="lucide:arrow-right" width={12} style={{verticalAlign:"middle"}} /></span>
            </div>
            {cargando ? (
              <div className="card" style={{ textAlign:'center', color:'var(--texto-muted)', padding:24 }}>Cargando cursos...</div>
            ) : pendientes.length === 0 ? (
              <div className="card" style={{ textAlign:'center', color:'var(--texto-muted)', padding:24 }}>
                ¡Estás al día con todos tus cursos!
              </div>
            ) : pendientes.map(curso => (
              <div key={curso.id} className="card" style={{ display:'flex', alignItems:'center', gap:14, marginBottom:8 }}>
                <div style={{ width:36, height:36, borderRadius:8, background:'#FFF0EC', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <Icon icon="lucide:book-open" width={18} style={{ color:'var(--rojo)' }} />
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:500, display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                    {curso.nombre}
                    {curso.obligatorio ? (
                      <span style={{ fontSize:9, background:'var(--rojo)', color:'#fff', borderRadius:4, padding:'2px 6px', fontWeight:700, letterSpacing:'0.04em' }}>OBLIGATORIO</span>
                    ) : (
                      <span className="badge-nuevo">Nuevo</span>
                    )}
                  </div>
                  <div style={{ fontSize:11, color:'var(--texto-muted)', marginTop:3 }}>{curso.area || 'General'}</div>
                  <div className="progress-bar-wrap" style={{ marginTop:6 }}>
                    <div className="progress-bar-fill" style={{ width:`${curso.progreso||0}%` }} />
                  </div>
                </div>
                <button className={curso.progreso > 0 ? 'btn-sm btn-sm-outline' : 'btn-primary'} style={{ fontSize:12 }}
                  onClick={() => navigate(`/capacitaciones/${curso.id}`)}>
                  {curso.progreso > 0 ? 'Continuar' : 'Iniciar'}
                </button>
              </div>
            ))}
          </div>

          {/* Certificados */}
          <div>
            <div className="card-header" style={{ marginBottom:10 }}>
              <span className="card-title" style={{ fontSize:14 }}>Certificados recientes</span>
              <span className="card-link" onClick={() => navigate('/mis-certificados')} style={{ cursor:'pointer' }}>Ver todos <Icon icon="lucide:arrow-right" width={12} style={{verticalAlign:"middle"}} /></span>
            </div>
            {certAprobados.slice(0,3).map(cert => (
              <div key={cert.id} className="card" style={{ display:'flex', alignItems:'center', gap:12, marginBottom:8 }}>
                <div style={{ width:32, height:32, background:'var(--azul-claro)', borderRadius:8, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <Icon icon="lucide:award" width={16} style={{ color:'var(--azul)' }} />
                </div>
                <span style={{ flex:1, fontSize:13 }}>{cert.curso_nombre}</span>
                <span style={{ fontSize:11, color:'var(--texto-muted)' }}>
                  {cert.fecha_emision ? new Date(cert.fecha_emision).toLocaleDateString('es-CL') : ''}
                </span>
                <a href={`/api/certificados/${cert.id}/descargar`} style={{
                  fontSize:11, color:'var(--azul)', border:'0.5px solid var(--gris-borde)',
                  borderRadius:8, padding:'5px 10px', display:'flex', alignItems:'center', gap:4
                }}>
                  <><Icon icon="lucide:download" width={12} style={{verticalAlign:"middle",marginRight:2}} /> Descargar</>
                </a>
              </div>
            ))}
          </div>
        </main>
      </div>


    </div>
  )
}
