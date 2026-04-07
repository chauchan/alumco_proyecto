import { useState, useEffect } from 'react'
import Topbar from '../components/Topbar'
import Sidebar from '../components/Sidebar'
import api from '../services/api'
import { Slide } from './GeneradorIA'

function buildSlidesProfesor(mod, pres) {
  if (Array.isArray(pres?.diapositivas) && pres.diapositivas.length > 0) return pres.diapositivas
  const r = pres?.resumen && typeof pres.resumen === 'object' ? pres.resumen : pres
  if (!r) return []
  const slides = []
  slides.push({ tipo: 'portada', titulo: mod.titulo, subtitulo: r.objetivo || mod.descripcion })
  if (r.puntos_clave?.length)   slides.push({ tipo: 'puntos',    titulo: 'Puntos clave',  items: r.puntos_clave })
  if (r.conceptos_importantes?.length) slides.push({ tipo: 'conceptos', titulo: 'Conceptos',    items: r.conceptos_importantes })
  if (r.procedimientos?.length) slides.push({ tipo: 'procedimientos', titulo: 'Procedimiento', items: r.procedimientos })
  if (r.advertencias?.length)   slides.push({ tipo: 'advertencias',  titulo: 'Puntos críticos', items: r.advertencias })
  if (r.cierre || (r.resumen && typeof r.resumen === 'string'))
    slides.push({ tipo: 'cierre', titulo: 'Resumen', texto: r.cierre || r.resumen })
  return slides
}

export default function Profesor() {
  const [cursos, setCursos] = useState([])
  const [certificados, setCertificados] = useState([])
  const [borradoresIA, setBorradoresIA] = useState([])
  const [cursoDetalle, setCursoDetalle] = useState(null)
  const [tabDetalle, setTabDetalle] = useState('modulos')       // 'modulos' | 'preguntas' | 'ppt'
  const [pregExpandida, setPregExpandida] = useState(null)
  // PPT por módulo dentro del modal del profesor
  const [pptModuloIdx, setPptModuloIdx] = useState(null)
  const [pptPresentaciones, setPptPresentaciones] = useState({})  // id_modulo → datos | 'cargando' | 'error'
  const [pptSlide, setPptSlide] = useState(0)

  useEffect(() => {
    Promise.all([api.get('/cursos'), api.get('/certificados'), api.get('/cursos/pendientes-ia')])
      .then(([c, cert, bIA]) => { setCursos(c.data); setCertificados(cert.data); setBorradoresIA(bIA.data) })
      .catch(() => {})
  }, [])

  const recargar = () => {
    Promise.all([api.get('/cursos'), api.get('/certificados'), api.get('/cursos/pendientes-ia')])
      .then(([c, cert, bIA]) => { setCursos(c.data); setCertificados(cert.data); setBorradoresIA(bIA.data) })
      .catch(() => {})
  }

  const abrirPPTModulo = async (mod, idx) => {
    setPptModuloIdx(idx)
    setPptSlide(0)
    if (pptPresentaciones[idx]) return
    setPptPresentaciones(prev => ({ ...prev, [idx]: 'cargando' }))
    try {
      const res = await api.post('/ia/generar-presentacion', { titulo: mod.titulo, descripcion: mod.descripcion })
      setPptPresentaciones(prev => ({ ...prev, [idx]: res.data.presentacion }))
    } catch {
      setPptPresentaciones(prev => ({ ...prev, [idx]: 'error' }))
    }
  }

  const cerrarDetalle = () => {
    setCursoDetalle(null); setTabDetalle('modulos'); setPregExpandida(null)
    setPptModuloIdx(null); setPptPresentaciones({}); setPptSlide(0)
  }

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

        <Sidebar />
        
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

          {/* ── MODAL DETALLE CURSO IA ── */}
          {cursoDetalle && (
            <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
              onClick={cerrarDetalle}>
              <div style={{ background:'#fff', borderRadius:14, width:'100%', maxWidth:680, maxHeight:'88vh', display:'flex', flexDirection:'column', boxShadow:'0 12px 48px rgba(0,0,0,0.28)' }}
                onClick={e => e.stopPropagation()}>

                {/* Cabecera */}
                <div style={{ background:'#1E3A6E', borderRadius:'14px 14px 0 0', padding:'18px 24px', flexShrink:0 }}>
                  <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:15, fontWeight:600, color:'#fff' }}>{cursoDetalle.nombre}</div>
                      <div style={{ fontSize:11, color:'rgba(255,255,255,0.65)', marginTop:3 }}>
                        {cursoDetalle.modulos_count} módulos · {cursoDetalle.preguntas_count} preguntas · Generado por IA
                      </div>
                    </div>
                    <button onClick={cerrarDetalle} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.7)', fontSize:18, cursor:'pointer' }}>✕</button>
                  </div>
                  {/* Tabs */}
                  <div style={{ display:'flex', gap:4, marginTop:14 }}>
                    {[['modulos','Módulos'],['preguntas','Preguntas'],['ppt','Presentación PPT']].map(([key, label]) => (
                      <button key={key} onClick={() => { setTabDetalle(key); setPptModuloIdx(null) }} style={{
                        fontSize:12, padding:'5px 14px', borderRadius:6, border:'none', cursor:'pointer',
                        background: tabDetalle === key ? '#fff' : 'rgba(255,255,255,0.12)',
                        color: tabDetalle === key ? '#1E3A6E' : 'rgba(255,255,255,0.8)',
                        fontWeight: tabDetalle === key ? 600 : 400
                      }}>{label}</button>
                    ))}
                  </div>
                </div>

                {/* Cuerpo scrollable */}
                <div style={{ overflowY:'auto', flex:1, padding:'20px 24px' }}>

                  {/* ── TAB MÓDULOS ── */}
                  {tabDetalle === 'modulos' && (
                    <>
                      <div style={{ fontSize:12, color:'#555', marginBottom:14, lineHeight:1.6 }}>{cursoDetalle.descripcion}</div>
                      {cursoDetalle.modulos?.map((mod, i) => (
                        <div key={i} style={{ border:'0.5px solid #E8E8E8', borderRadius:8, padding:'10px 14px', marginBottom:8 }}>
                          <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:4 }}>
                            <div style={{ width:20, height:20, borderRadius:'50%', background:'#1E3A6E', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, color:'#fff', flexShrink:0 }}>{i+1}</div>
                            <span style={{ fontSize:12, fontWeight:500, flex:1 }}>{mod.titulo}</span>
                          </div>
                          <div style={{ fontSize:11, color:'#888', lineHeight:1.5, paddingLeft:28 }}>{mod.descripcion}</div>
                        </div>
                      ))}
                    </>
                  )}

                  {/* ── TAB PREGUNTAS ── */}
                  {tabDetalle === 'preguntas' && (
                    <>
                      {cursoDetalle.preguntas?.length === 0 && (
                        <div style={{ textAlign:'center', color:'#888', padding:32, fontSize:13 }}>No hay preguntas cargadas</div>
                      )}
                      {cursoDetalle.preguntas?.map((preg, j) => {
                        const alts = typeof preg.alternativas === 'string' ? JSON.parse(preg.alternativas) : preg.alternativas
                        return (
                          <div key={j} style={{ border:'0.5px solid #EEE', borderRadius:8, marginBottom:8, overflow:'hidden' }}>
                            <div style={{ display:'flex', gap:8, padding:'9px 12px', cursor:'pointer', background: pregExpandida === j ? '#F7F8FF' : '#FAFAFA' }}
                              onClick={() => setPregExpandida(pregExpandida === j ? null : j)}>
                              <span style={{ width:18, height:18, borderRadius:'50%', background:'#E8E8E8', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, color:'#666', flexShrink:0 }}>{j+1}</span>
                              <span style={{ fontSize:12, color:'#333', flex:1 }}>{preg.texto}</span>
                              <span style={{ fontSize:10, color:'#AAA' }}>{pregExpandida === j ? '▲' : '▼'}</span>
                            </div>
                            {pregExpandida === j && (
                              <div style={{ padding:'8px 12px 10px 38px', background:'#F7F8FF', borderTop:'0.5px solid #EEE' }}>
                                {alts?.map((alt, k) => (
                                  <div key={k} style={{ display:'flex', gap:7, fontSize:12, padding:'4px 0', color: alt.correcta ? '#1A7A45' : '#555' }}>
                                    <span style={{ width:16, height:16, borderRadius:'50%', border: alt.correcta ? '2px solid #1A7A45' : '1.5px solid #CCC', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, flexShrink:0, background: alt.correcta ? '#E8F5ED' : 'transparent' }}>
                                      {alt.correcta ? '✓' : ''}
                                    </span>
                                    {alt.texto}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </>
                  )}

                  {/* ── TAB PPT ── */}
                  {tabDetalle === 'ppt' && (
                    <>
                      {pptModuloIdx === null ? (
                        <>
                          <div style={{ fontSize:12, color:'#888', marginBottom:14 }}>Selecciona un módulo para ver su presentación:</div>
                          {cursoDetalle.modulos?.map((mod, i) => (
                            <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', border:'0.5px solid #E8E8E8', borderRadius:8, marginBottom:8 }}>
                              <div style={{ width:22, height:22, borderRadius:'50%', background:'#1E3A6E', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, color:'#fff', flexShrink:0 }}>{i+1}</div>
                              <span style={{ fontSize:12, fontWeight:500, flex:1 }}>{mod.titulo}</span>
                              <button onClick={() => abrirPPTModulo(mod, i)} style={{
                                fontSize:11, background:'#1E3A6E', color:'#fff', border:'none', borderRadius:6, padding:'4px 12px', cursor:'pointer'
                              }}>
                                {pptPresentaciones[i] === 'cargando' ? '⏳' : pptPresentaciones[i] && pptPresentaciones[i] !== 'error' ? '▶ Ver' : '▶ Generar'}
                              </button>
                            </div>
                          ))}
                        </>
                      ) : (() => {
                        const mod  = cursoDetalle.modulos[pptModuloIdx]
                        const ppres = pptPresentaciones[pptModuloIdx]
                        const slides = ppres && ppres !== 'cargando' && ppres !== 'error'
                          ? buildSlidesProfesor(mod, ppres) : []
                        return (
                          <div>
                            <button onClick={() => { setPptModuloIdx(null); setPptSlide(0) }}
                              style={{ fontSize:11, color:'#1E3A6E', background:'none', border:'none', cursor:'pointer', marginBottom:12, display:'flex', alignItems:'center', gap:4 }}>
                              ← Volver a módulos
                            </button>
                            {ppres === 'cargando' && (
                              <div style={{ textAlign:'center', padding:'2rem 0', color:'#888' }}>
                                <div style={{ fontSize:28, marginBottom:8 }}>⏳</div>
                                <div style={{ fontSize:13 }}>Generando presentación...</div>
                              </div>
                            )}
                            {ppres === 'error' && (
                              <div style={{ textAlign:'center', padding:'2rem 0' }}>
                                <div style={{ fontSize:13, color:'#E8505B', marginBottom:10 }}>Error al generar</div>
                                <button onClick={() => { setPptPresentaciones(prev => { const n={...prev}; delete n[pptModuloIdx]; return n }); abrirPPTModulo(mod, pptModuloIdx) }}
                                  style={{ fontSize:12, background:'#1E3A6E', color:'#fff', border:'none', borderRadius:6, padding:'6px 14px', cursor:'pointer' }}>
                                  Reintentar
                                </button>
                              </div>
                            )}
                            {slides.length > 0 && (
                              <>
                                <div style={{ height:3, background:'#E8E8E8', marginBottom:0 }}>
                                  <div style={{ height:3, background:'#1E3A6E', width:`${((pptSlide+1)/slides.length)*100}%`, transition:'width 0.3s' }} />
                                </div>
                                <div style={{ padding:'16px 0' }}>
                                  <Slide slide={slides[pptSlide]} total={slides.length} actual={pptSlide} />
                                </div>
                                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                                  <button onClick={() => setPptSlide(s => Math.max(0,s-1))} disabled={pptSlide===0}
                                    style={{ height:34, padding:'0 14px', borderRadius:8, border:'1px solid #E8E8E8', background: pptSlide===0?'#F4F5F7':'#fff', color: pptSlide===0?'#CCC':'#333', fontSize:12, cursor: pptSlide===0?'default':'pointer' }}>
                                    ← Anterior
                                  </button>
                                  <div style={{ display:'flex', gap:5 }}>
                                    {slides.map((_,k) => (
                                      <div key={k} onClick={() => setPptSlide(k)} style={{ width: k===pptSlide?18:7, height:7, borderRadius:4, background: k===pptSlide?'#1E3A6E':'#D0D5E0', cursor:'pointer', transition:'all 0.2s' }} />
                                    ))}
                                  </div>
                                  <button onClick={() => setPptSlide(s => Math.min(slides.length-1,s+1))} disabled={pptSlide===slides.length-1}
                                    style={{ height:34, padding:'0 14px', borderRadius:8, border:'none', background: pptSlide===slides.length-1?'#CCC':'#1E3A6E', color:'#fff', fontSize:12, cursor: pptSlide===slides.length-1?'default':'pointer' }}>
                                    Siguiente →
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        )
                      })()}
                    </>
                  )}
                </div>

                {/* Botones aprobar/rechazar */}
                <div style={{ padding:'14px 24px', borderTop:'0.5px solid #E8E8E8', display:'flex', gap:10, flexShrink:0 }}>
                  <button style={{ flex:1, height:40, background:'#1A7A45', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer' }}
                    onClick={async () => {
                      try { await api.patch(`/cursos/${cursoDetalle.id}/aprobar`); cerrarDetalle(); recargar() }
                      catch { alert('Error al aprobar el curso') }
                    }}>
                    ✓ Aprobar y publicar
                  </button>
                  <button style={{ flex:1, height:40, background:'none', color:'#E8505B', border:'1px solid #E8505B', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer' }}
                    onClick={async () => {
                      if (!confirm('¿Rechazar este borrador? Se eliminará permanentemente.')) return
                      try { await api.delete(`/cursos/${cursoDetalle.id}`); cerrarDetalle(); recargar() }
                      catch { alert('Error al rechazar el curso') }
                    }}>
                    ✕ Rechazar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Borradores IA pendientes */}
          {borradoresIA.length > 0 && (
            <div className="card" style={{ borderLeft: '3px solid #F5A623' }}>
              <div className="card-header" style={{ marginBottom: 12 }}>
                <span className="card-title">Borradores IA pendientes de validación</span>
                <span style={{ fontSize: 11, background: '#FFF8E8', color: '#B8860B', borderRadius: 20, padding: '2px 10px', border: '1px solid #F5C842' }}>
                  {borradoresIA.length} pendiente{borradoresIA.length > 1 ? 's' : ''}
                </span>
              </div>
              {borradoresIA.map(curso => (
                <div key={curso.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '0.5px solid #F0F0F0' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: '#FFF8E8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>✨</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#222' }}>{curso.nombre}</div>
                    <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                      {curso.modulos_count} módulos · {curso.preguntas_count} preguntas
                    </div>
                  </div>
                  <button
                    style={{ height: 32, padding: '0 14px', background: '#1E3A6E', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, cursor: 'pointer' }}
                    onClick={async () => {
                      const detalle = await api.get(`/cursos/${curso.id}`)
                      setCursoDetalle({ ...curso, modulos: detalle.data.modulos, preguntas: detalle.data.preguntas })
                      setTabDetalle('modulos')
                    }}>
                    Revisar
                  </button>
                </div>
              ))}
            </div>
          )}

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
