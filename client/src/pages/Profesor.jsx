import { useState, useEffect } from 'react'
import Topbar from '../components/Topbar'
import api from '../services/api'

export default function Profesor() {
  const [cursos, setCursos] = useState([])
  const [certificados, setCertificados] = useState([])

  useEffect(() => {
    Promise.all([api.get('/cursos'), api.get('/certificados')])
      .then(([c, cert]) => { setCursos(c.data); setCertificados(cert.data) })
      .catch(() => {})
  }, [])

  const pendientes = certificados.filter(c => c.estado === 'pendiente')

  const navItems = [
    { label:'Mis cursos', active:true },
    { label:'Validar certificados', active:false, badge: pendientes.length || null },
    { label:'Subir material', active:false },
    { label:'Evaluaciones', active:false },
    { label:'Mi perfil', active:false },
  ]

  const tagClass = (tipo) => ({ pdf:'tag-pdf', video:'tag-video', ppt:'tag-ppt' }[tipo] || 'tag-pdf')

  return (
    <div className="app-shell">
      <Topbar seccion="Panel del profesor" />
      <div className="app-body">

        <aside className="sidebar">
          <div className="nav-section-label">Docencia</div>
          {navItems.map(item => (
            <div key={item.label} className={`nav-item ${item.active?'active':''}`}>
              <span style={{ flex:1 }}>{item.label}</span>
              {item.badge > 0 && <span className="nav-badge">{item.badge}</span>}
            </div>
          ))}
        </aside>

        <main className="main-content" style={{ display:'flex', flexDirection:'column', gap:16 }}>

          {/* Header */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
            <div>
              <div className="page-title">Panel del Profesor</div>
              <div className="page-sub">Gestión de cursos y validación de certificados</div>
            </div>
            <button className="btn-primary">+ Nuevo curso</button>
          </div>

          {/* Stats */}
          <div className="stats-grid-4">
            {[
              { val: cursos.filter(c=>c.publicado).length, label:'Cursos publicados', color:'#7BC67A' },
              { val: cursos.filter(c=>!c.publicado).length, label:'Borradores', color:'#888' },
              { val: pendientes.length, label:'Por validar', color:'#E8505B' },
              { val: certificados.filter(c=>c.estado==='aprobado').length, label:'Certificados emitidos', color:'#2B4BA0' },
            ].map(s => (
              <div key={s.label} className="stat-card">
                <div className="stat-label">{s.label}</div>
                <div className="stat-value" style={{ color:s.color }}>{s.val}</div>
              </div>
            ))}
          </div>

          <div className="two-col">
            {/* Mis cursos */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Mis cursos</span>
                <span className="card-link">Ver todos →</span>
              </div>
              {cursos.slice(0,4).map(c => (
                <div key={c.id} className="row-divider" style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0' }}>
                  <div style={{ width:28, height:28, background:'#FFEEEC', borderRadius:6, flexShrink:0 }} />
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:12, fontWeight:500 }}>{c.nombre}</div>
                    <div style={{ display:'flex', gap:6, marginTop:4 }}>
                      <span className={`format-tag tag-pdf`}>PDF</span>
                      <span className={`format-tag ${c.publicado ? 'tag-publicado' : 'tag-borrador'}`}>
                        {c.publicado ? 'Publicado' : 'Borrador'}
                      </span>
                    </div>
                  </div>
                  {!c.publicado
                    ? <button className="btn-sm btn-sm-primary" onClick={() => api.patch(`/cursos/${c.id}/publicar`, { publicado:true }).then(() => window.location.reload())}>Publicar</button>
                    : <button className="btn-sm btn-sm-outline">Editar</button>
                  }
                </div>
              ))}
            </div>

            {/* Certificados por validar */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Certificados por validar</span>
                {pendientes.length > 0 && (
                  <span style={{ fontSize:10, background:'#FFF0F0', color:'#C0392B', borderRadius:20, padding:'2px 8px' }}>
                    {pendientes.length}
                  </span>
                )}
              </div>
              {pendientes.length === 0 ? (
                <div style={{ textAlign:'center', color:'#888', padding:24, fontSize:13 }}>No hay certificados pendientes</div>
              ) : pendientes.slice(0,4).map(cert => (
                <div key={cert.id} className="row-divider" style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0' }}>
                  <div className="avatar" style={{ width:30, height:30, fontSize:11, background:'#2B4BA0', flexShrink:0 }}>
                    {cert.usuario_nombre?.split(' ').map(n=>n[0]).slice(0,2).join('')}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:12, fontWeight:500 }}>{cert.usuario_nombre}</div>
                    <div style={{ fontSize:11, color:'#888', marginTop:2 }}>{cert.curso_nombre}</div>
                  </div>
                  <div style={{ display:'flex', gap:6 }}>
                    <button className="btn-aprobar" onClick={() => api.patch(`/certificados/${cert.id}/validar`, { estado:'aprobado' }).then(() => window.location.reload())}>Aprobar</button>
                    <button className="btn-rechazar" onClick={() => api.patch(`/certificados/${cert.id}/validar`, { estado:'rechazado' }).then(() => window.location.reload())}>Rechazar</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Zona subida */}
          <div className="card">
            <div className="card-title" style={{ marginBottom:12 }}>Subir material formativo</div>
            <div className="upload-zone">
              <div style={{ fontSize:13, fontWeight:500, marginBottom:4 }}>Arrastra o selecciona un archivo</div>
              <div style={{ fontSize:11, color:'#888', marginBottom:12 }}>Formatos aceptados: PDF, Video (MP4, máx 5 min), PPT</div>
              <div style={{ display:'flex', gap:8, justifyContent:'center' }}>
                <span className="format-tag tag-pdf">PDF</span>
                <span className="format-tag tag-video">Video</span>
                <span className="format-tag tag-ppt">PPT</span>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
