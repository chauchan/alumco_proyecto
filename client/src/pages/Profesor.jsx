import { useState, useEffect } from 'react'
import { Icon } from '@iconify/react'
import Topbar from '../components/Topbar'
import Sidebar from '../components/Sidebar'
import api from '../services/api'
import { Slide, SlideEditor } from './GeneradorIA'

const ESTAMENTOS = [
  'Equipo Directivo',
  'Personal de Administración',
  'Profesionales de Salud',
  'Equipo de Atención Directa No Profesional',
  'TENS Intermedios',
  'Auxiliares de Servicio',
  'Manipuladoras de Alimento',
  'Personal No Contratado',
]

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
  const [pptEditando, setPptEditando] = useState(false)
  const [pptEditData, setPptEditData] = useState({})   // idx → slides[]
  const [pptGuardando, setPptGuardando] = useState(false)
  // targeting (estamento + obligatorio)
  const [targeting, setTargeting] = useState({ estamento_objetivo: null, obligatorio: false })
  const [guardandoTargeting, setGuardandoTargeting] = useState(false)
  // edición de módulos
  const [editandoModulos, setEditandoModulos] = useState(false)
  const [modulosEdit, setModulosEdit] = useState([])
  const [guardandoModulos, setGuardandoModulos] = useState(false)
  // edición de preguntas
  const [editandoPreguntas, setEditandoPreguntas] = useState(false)
  const [preguntasEdit, setPreguntasEdit] = useState([])
  const [guardandoPreguntas, setGuardandoPreguntas] = useState(false)
  // selección masiva de cursos
  const [modoSeleccion, setModoSeleccion] = useState(false)
  const [seleccionados, setSeleccionados] = useState(new Set())
  const [eliminandoMasivo, setEliminandoMasivo] = useState(false)

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
    setPptEditando(false); setPptEditData({})
    setEditandoModulos(false); setModulosEdit([])
    setEditandoPreguntas(false); setPreguntasEdit([])
    setTargeting({ estamento_objetivo: null, obligatorio: false })
  }

  const guardarTargeting = async () => {
    setGuardandoTargeting(true)
    try {
      await api.patch(`/cursos/${cursoDetalle.id}/targeting`, targeting)
      setCursoDetalle(prev => ({ ...prev, ...targeting }))
    } catch { alert('Error al guardar la configuración') }
    finally { setGuardandoTargeting(false) }
  }

  const guardarModulos = async () => {
    setGuardandoModulos(true)
    try {
      await api.put(`/cursos/${cursoDetalle.id}`, { modulos: modulosEdit.map(m => ({ id: m.id, titulo: m.titulo, descripcion: m.descripcion })) })
      setCursoDetalle(prev => ({ ...prev, modulos: modulosEdit }))
      setEditandoModulos(false)
    } catch { alert('Error al guardar módulos') }
    finally { setGuardandoModulos(false) }
  }

  const guardarPreguntas = async () => {
    setGuardandoPreguntas(true)
    try {
      await api.put(`/cursos/${cursoDetalle.id}`, { preguntas: preguntasEdit })
      setCursoDetalle(prev => ({ ...prev, preguntas: preguntasEdit }))
      setEditandoPreguntas(false)
    } catch { alert('Error al guardar preguntas') }
    finally { setGuardandoPreguntas(false) }
  }

  const iniciarEdicion = (idx, slides) => {
    setPptEditData(prev => ({ ...prev, [idx]: JSON.parse(JSON.stringify(slides)) }))
    setPptEditando(true)
  }

  const guardarEdicion = async (idx, mod) => {
    const slides = pptEditData[idx]
    if (!slides || !cursoDetalle) return
    setPptGuardando(true)
    try {
      await api.put(`/cursos/${cursoDetalle.id}`, {
        modulos: [{ id: mod.id, contenido_presentacion: { diapositivas: slides } }]
      })
      // actualizar la presentación en memoria
      setPptPresentaciones(prev => ({
        ...prev,
        [idx]: { ...(prev[idx] || {}), diapositivas: slides }
      }))
      setPptEditando(false)
    } catch {
      alert('Error al guardar los cambios')
    } finally {
      setPptGuardando(false)
    }
  }

  const eliminarMasivo = async () => {
    if (!seleccionados.size) return
    if (!confirm(`¿Eliminar ${seleccionados.size} curso(s)? Esta acción no se puede deshacer.`)) return
    setEliminandoMasivo(true)
    try {
      await Promise.all([...seleccionados].map(id => api.delete(`/cursos/${id}`)))
      setSeleccionados(new Set())
      setModoSeleccion(false)
      recargar()
    } catch {
      alert('Error al eliminar algunos cursos')
    } finally {
      setEliminandoMasivo(false)
    }
  }

  const toggleSeleccion = (id) => {
    setSeleccionados(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
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
                    <button onClick={cerrarDetalle} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.7)', cursor:'pointer', display:'flex', alignItems:'center' }}><Icon icon="lucide:x" width={18} /></button>
                  </div>
                  {/* Tabs */}
                  <div style={{ display:'flex', gap:4, marginTop:14 }}>
                    {[['modulos','Módulos'],['preguntas','Preguntas'],['ppt','Presentación PPT'],['audiencia','Audiencia']].map(([key, label]) => (
                      <button key={key} onClick={() => { setTabDetalle(key); setPptModuloIdx(null); setPptEditando(false) }} style={{
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
                      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:10, gap:6 }}>
                        {editandoModulos ? (
                          <>
                            <button onClick={() => setEditandoModulos(false)} style={{ fontSize:11, padding:'4px 12px', borderRadius:6, border:'1px solid #CCC', background:'#fff', cursor:'pointer', color:'#555' }}>Cancelar</button>
                            <button onClick={guardarModulos} disabled={guardandoModulos} style={{ fontSize:11, padding:'4px 12px', borderRadius:6, border:'none', background:'#1A7A45', color:'#fff', cursor:'pointer', fontWeight:500 }}>
                              {guardandoModulos ? 'Guardando...' : <><Icon icon="lucide:check" width={13} style={{verticalAlign:'middle',marginRight:4}} /> Guardar cambios</>}
                            </button>
                          </>
                        ) : (
                          <button onClick={() => { setModulosEdit(JSON.parse(JSON.stringify(cursoDetalle.modulos))); setEditandoModulos(true) }}
                            style={{ fontSize:11, padding:'4px 12px', borderRadius:6, border:'1px solid #1E3A6E', background:'#fff', color:'#1E3A6E', cursor:'pointer' }}>
                            <><Icon icon="lucide:pencil" width={12} style={{verticalAlign:"middle",marginRight:3}} /> Editar módulos</>
                          </button>
                        )}
                      </div>
                      {(editandoModulos ? modulosEdit : cursoDetalle.modulos)?.map((mod, i) => (
                        <div key={i} style={{ border: editandoModulos ? '1px solid #C5D3F0' : '0.5px solid #E8E8E8', borderRadius:8, padding:'10px 14px', marginBottom:8, background: editandoModulos ? '#F7F9FF' : '#fff' }}>
                          <div style={{ display:'flex', gap:8, alignItems:'flex-start', marginBottom: editandoModulos ? 8 : 4 }}>
                            <div style={{ width:20, height:20, borderRadius:'50%', background:'#1E3A6E', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, color:'#fff', flexShrink:0, marginTop:2 }}>{i+1}</div>
                            {editandoModulos ? (
                              <input value={mod.titulo} onChange={e => { const arr=[...modulosEdit]; arr[i]={...arr[i],titulo:e.target.value}; setModulosEdit(arr) }}
                                style={{ flex:1, fontSize:12, fontWeight:500, padding:'5px 8px', borderRadius:6, border:'1px solid #CCC', outline:'none' }} />
                            ) : (
                              <span style={{ fontSize:12, fontWeight:500, flex:1 }}>{mod.titulo}</span>
                            )}
                          </div>
                          {editandoModulos ? (
                            <textarea value={mod.descripcion || ''} rows={3}
                              onChange={e => { const arr=[...modulosEdit]; arr[i]={...arr[i],descripcion:e.target.value}; setModulosEdit(arr) }}
                              style={{ width:'100%', fontSize:11, padding:'5px 8px', borderRadius:6, border:'1px solid #CCC', resize:'none', lineHeight:1.5, boxSizing:'border-box', marginLeft:28 }} />
                          ) : (
                            <div style={{ fontSize:11, color:'#888', lineHeight:1.5, paddingLeft:28 }}>{mod.descripcion}</div>
                          )}
                        </div>
                      ))}
                    </>
                  )}

                  {/* ── TAB PREGUNTAS ── */}
                  {tabDetalle === 'preguntas' && (
                    <>
                      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:10, gap:6 }}>
                        {editandoPreguntas ? (
                          <>
                            <button onClick={() => setEditandoPreguntas(false)} style={{ fontSize:11, padding:'4px 12px', borderRadius:6, border:'1px solid #CCC', background:'#fff', cursor:'pointer', color:'#555' }}>Cancelar</button>
                            <button onClick={guardarPreguntas} disabled={guardandoPreguntas} style={{ fontSize:11, padding:'4px 12px', borderRadius:6, border:'none', background:'#1A7A45', color:'#fff', cursor:'pointer', fontWeight:500 }}>
                              {guardandoPreguntas ? 'Guardando...' : <><Icon icon="lucide:check" width={13} style={{verticalAlign:'middle',marginRight:4}} /> Guardar cambios</>}
                            </button>
                          </>
                        ) : (
                          <button onClick={() => {
                            setPreguntasEdit(cursoDetalle.preguntas.map(p => ({
                              ...p,
                              alternativas: typeof p.alternativas === 'string' ? JSON.parse(p.alternativas) : p.alternativas
                            })))
                            setEditandoPreguntas(true)
                          }} style={{ fontSize:11, padding:'4px 12px', borderRadius:6, border:'1px solid #1E3A6E', background:'#fff', color:'#1E3A6E', cursor:'pointer' }}>
                            <><Icon icon="lucide:pencil" width={12} style={{verticalAlign:"middle",marginRight:3}} /> Editar preguntas</>
                          </button>
                        )}
                      </div>

                      {cursoDetalle.preguntas?.length === 0 && (
                        <div style={{ textAlign:'center', color:'#888', padding:32, fontSize:13 }}>No hay preguntas cargadas</div>
                      )}

                      {(editandoPreguntas ? preguntasEdit : cursoDetalle.preguntas)?.map((preg, j) => {
                        const alts = typeof preg.alternativas === 'string' ? JSON.parse(preg.alternativas) : preg.alternativas
                        return editandoPreguntas ? (
                          <div key={j} style={{ border:'1px solid #C5D3F0', borderRadius:8, marginBottom:10, padding:'10px 12px', background:'#F7F9FF' }}>
                            <div style={{ display:'flex', gap:8, alignItems:'flex-start', marginBottom:8 }}>
                              <span style={{ width:18, height:18, borderRadius:'50%', background:'#1E3A6E', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, color:'#fff', flexShrink:0, marginTop:3 }}>{j+1}</span>
                              <textarea value={preg.texto} rows={2}
                                onChange={e => { const arr=[...preguntasEdit]; arr[j]={...arr[j],texto:e.target.value}; setPreguntasEdit(arr) }}
                                style={{ flex:1, fontSize:12, padding:'5px 8px', borderRadius:6, border:'1px solid #CCC', resize:'none', lineHeight:1.5, boxSizing:'border-box' }} />
                            </div>
                            <div style={{ paddingLeft:26, display:'flex', flexDirection:'column', gap:6 }}>
                              {alts?.map((alt, k) => (
                                <div key={k} style={{ display:'flex', gap:8, alignItems:'center' }}>
                                  <div onClick={() => {
                                    const arr = JSON.parse(JSON.stringify(preguntasEdit))
                                    arr[j].alternativas = arr[j].alternativas.map((a, ki) => ({ ...a, correcta: ki === k }))
                                    setPreguntasEdit(arr)
                                  }} style={{ width:16, height:16, borderRadius:'50%', border: alt.correcta ? '2px solid #1A7A45' : '1.5px solid #CCC', background: alt.correcta ? '#E8F5ED' : '#fff', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }}>
                                    {alt.correcta && <div style={{ width:8, height:8, borderRadius:'50%', background:'#1A7A45' }} />}
                                  </div>
                                  <input value={alt.texto} onChange={e => {
                                    const arr = JSON.parse(JSON.stringify(preguntasEdit))
                                    arr[j].alternativas[k].texto = e.target.value
                                    setPreguntasEdit(arr)
                                  }} style={{ flex:1, fontSize:11, padding:'4px 7px', borderRadius:5, border:'1px solid #CCC', color: alt.correcta ? '#1A7A45' : '#333' }} />
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
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
                                      {alt.correcta ? <Icon icon="lucide:check" color="#1A7A45" width={9} /> : null}
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
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                            <div style={{ fontSize:12, color:'#888' }}>Selecciona un módulo para ver su presentación:</div>
                            <button onClick={generarTodosPPT} disabled={generandoTodosPPT}
                              style={{ fontSize:11, padding:'5px 12px', borderRadius:7, border:'none', cursor: generandoTodosPPT ? 'not-allowed' : 'pointer',
                                background: generandoTodosPPT ? '#ccc' : '#1E3A6E', color:'#fff', fontWeight:500, flexShrink:0 }}>
                              {generandoTodosPPT
                                ? `Generando ${progresoPPT.hecho}/${progresoPPT.total}...`
                                : <><Icon icon="lucide:sparkles" width={13} style={{verticalAlign:'middle',marginRight:4}} /> Generar todos los PPT</>}
                            </button>
                          </div>
                          {cursoDetalle.modulos?.map((mod, i) => {
                            const tienePPT = (() => {
                              if (pptPresentaciones[i] && pptPresentaciones[i] !== 'error' && pptPresentaciones[i] !== 'cargando') return true
                              const cp = mod.contenido_presentacion
                              if (!cp) return false
                              try {
                                const p = typeof cp === 'string' ? JSON.parse(cp) : cp
                                const slides = Array.isArray(p) ? p : p?.diapositivas || []
                                return slides.length > 0
                              } catch { return false }
                            })()
                            return (
                            <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', border:`0.5px solid ${tienePPT ? '#BBF7D0' : '#E8E8E8'}`, borderRadius:8, marginBottom:8, background: tienePPT ? '#F0FDF4' : '#fff' }}>
                              <div style={{ width:22, height:22, borderRadius:'50%', background: tienePPT ? '#22C55E' : '#1E3A6E', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, color:'#fff', flexShrink:0 }}>{tienePPT ? <Icon icon="lucide:check" color="#fff" width={12} /> : i+1}</div>
                              <span style={{ fontSize:12, fontWeight:500, flex:1 }}>{mod.titulo}</span>
                              <button onClick={() => abrirPPTModulo(mod, i)} style={{
                                fontSize:11, background:'#1E3A6E', color:'#fff', border:'none', borderRadius:6, padding:'4px 12px', cursor:'pointer'
                              }}>
                                {pptPresentaciones[i] === 'cargando' ? <Icon icon="lucide:loader-circle" width={13} /> : tienePPT ? <><Icon icon="lucide:play" width={11} style={{verticalAlign:'middle',marginRight:3}} /> Ver</> : <><Icon icon="lucide:play" width={11} style={{verticalAlign:'middle',marginRight:3}} /> Generar</>}
                              </button>
                            </div>
                          )
                          })}
                        </>
                      ) : (() => {
                        const mod  = cursoDetalle.modulos[pptModuloIdx]
                        const ppres = pptPresentaciones[pptModuloIdx]
                        const slides = ppres && ppres !== 'cargando' && ppres !== 'error'
                          ? buildSlidesProfesor(mod, ppres) : []
                        return (
                          <div>
                            <button onClick={() => { setPptModuloIdx(null); setPptSlide(0); setPptEditando(false) }}
                              style={{ fontSize:11, color:'#1E3A6E', background:'none', border:'none', cursor:'pointer', marginBottom:12, display:'flex', alignItems:'center', gap:4 }}>
                              <><Icon icon="lucide:arrow-left" width={13} style={{verticalAlign:"middle",marginRight:4}} /> Volver a módulos</>
                            </button>
                            {ppres === 'cargando' && (
                              <div style={{ textAlign:'center', padding:'2rem 0', color:'#888' }}>
                                <Icon icon="lucide:loader-circle" width={28} style={{marginBottom:8,display:"block",color:"#888"}} />
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
                            {slides.length > 0 && (() => {
                              const editSlides = pptEditData[pptModuloIdx] || slides
                              const curSlide = editSlides[pptSlide]
                              return (
                                <>
                                  {/* Barra de edición */}
                                  <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginBottom:8 }}>
                                    {pptEditando ? (
                                      <>
                                        <button onClick={() => setPptEditando(false)}
                                          style={{ fontSize:11, padding:'4px 12px', borderRadius:6, border:'1px solid #CCC', background:'#fff', cursor:'pointer', color:'#555' }}>
                                          Cancelar
                                        </button>
                                        <button onClick={() => guardarEdicion(pptModuloIdx, mod)} disabled={pptGuardando}
                                          style={{ fontSize:11, padding:'4px 12px', borderRadius:6, border:'none', background:'#1A7A45', color:'#fff', cursor:'pointer', fontWeight:500 }}>
                                          {pptGuardando ? 'Guardando...' : <><Icon icon="lucide:check" width={13} style={{verticalAlign:'middle',marginRight:4}} /> Guardar</>}
                                        </button>
                                      </>
                                    ) : (
                                      <button onClick={() => iniciarEdicion(pptModuloIdx, slides)}
                                        style={{ fontSize:11, padding:'4px 12px', borderRadius:6, border:'1px solid #1E3A6E', background:'#fff', color:'#1E3A6E', cursor:'pointer' }}>
                                        <><Icon icon="lucide:pencil" width={12} style={{verticalAlign:"middle",marginRight:3}} /> Editar slides</>
                                      </button>
                                    )}
                                  </div>

                                  {/* Barra de progreso */}
                                  <div style={{ height:3, background:'#E8E8E8', marginBottom:0 }}>
                                    <div style={{ height:3, background:'#1E3A6E', width:`${((pptSlide+1)/editSlides.length)*100}%`, transition:'width 0.3s' }} />
                                  </div>

                                  {/* Slide o Editor */}
                                  {pptEditando ? (
                                    <SlideEditor
                                      slide={curSlide}
                                      imagenes={cursoDetalle.imagenes_protocolo || []}
                                      onChange={updated => {
                                        const arr = [...editSlides]
                                        arr[pptSlide] = updated
                                        setPptEditData(prev => ({ ...prev, [pptModuloIdx]: arr }))
                                      }}
                                    />
                                  ) : (
                                    <div style={{ padding:'16px 0' }}>
                                      <Slide slide={curSlide} total={editSlides.length} actual={pptSlide} />
                                    </div>
                                  )}

                                  {/* Navegación */}
                                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                                    <button onClick={() => setPptSlide(s => Math.max(0,s-1))} disabled={pptSlide===0}
                                      style={{ height:34, padding:'0 14px', borderRadius:8, border:'1px solid #E8E8E8', background: pptSlide===0?'#F4F5F7':'#fff', color: pptSlide===0?'#CCC':'#333', fontSize:12, cursor: pptSlide===0?'default':'pointer' }}>
                                      <><Icon icon="lucide:arrow-left" width={13} style={{verticalAlign:"middle",marginRight:4}} /> Anterior</>
                                    </button>
                                    <div style={{ display:'flex', gap:5 }}>
                                      {editSlides.map((_,k) => (
                                        <div key={k} onClick={() => setPptSlide(k)} style={{ width: k===pptSlide?18:7, height:7, borderRadius:4, background: k===pptSlide?'#1E3A6E':'#D0D5E0', cursor:'pointer', transition:'all 0.2s' }} />
                                      ))}
                                    </div>
                                    <button onClick={() => setPptSlide(s => Math.min(editSlides.length-1,s+1))} disabled={pptSlide===editSlides.length-1}
                                      style={{ height:34, padding:'0 14px', borderRadius:8, border:'none', background: pptSlide===editSlides.length-1?'#CCC':'#1E3A6E', color:'#fff', fontSize:12, cursor: pptSlide===editSlides.length-1?'default':'pointer' }}>
                                      <>Siguiente <Icon icon="lucide:arrow-right" width={13} style={{verticalAlign:"middle",marginLeft:4}} /></>
                                    </button>
                                  </div>
                                </>
                              )
                            })()}
                          </div>
                        )
                      })()}
                    </>
                  )}
                  {/* ── TAB AUDIENCIA ── */}
                  {tabDetalle === 'audiencia' && (
                    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

                      {/* Obligatorio */}
                      <div style={{ border:'0.5px solid #E8E8E8', borderRadius:10, padding:'14px 16px' }}>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                          <div>
                            <div style={{ fontSize:13, fontWeight:600, color:'#222', marginBottom:3 }}>Curso obligatorio</div>
                            <div style={{ fontSize:11, color:'#888', lineHeight:1.5 }}>
                              Los colaboradores verán una etiqueta de obligatorio y tendrá prioridad en su lista.
                            </div>
                          </div>
                          <div onClick={() => setTargeting(t => ({ ...t, obligatorio: !t.obligatorio }))}
                            style={{ width:44, height:24, borderRadius:12, background: targeting.obligatorio ? '#E8505B' : '#CCC', cursor:'pointer', position:'relative', transition:'background 0.2s', flexShrink:0 }}>
                            <div style={{ width:18, height:18, borderRadius:'50%', background:'#fff', position:'absolute', top:3, left: targeting.obligatorio ? 23 : 3, transition:'left 0.2s', boxShadow:'0 1px 4px rgba(0,0,0,0.2)' }} />
                          </div>
                        </div>
                      </div>

                      {/* Audiencia */}
                      <div style={{ border:'0.5px solid #E8E8E8', borderRadius:10, padding:'14px 16px' }}>
                        <div style={{ fontSize:13, fontWeight:600, color:'#222', marginBottom:6 }}>¿A quién va dirigido?</div>
                        <div style={{ fontSize:11, color:'#888', marginBottom:12 }}>
                          Elige un estamento específico o déjalo en "Todos" para que todos los colaboradores lo vean.
                        </div>

                        {/* Opción Todos */}
                        <div onClick={() => setTargeting(t => ({ ...t, estamento_objetivo: null }))}
                          style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', borderRadius:8, marginBottom:6, cursor:'pointer',
                            border: targeting.estamento_objetivo === null ? '2px solid #1E3A6E' : '1px solid #E8E8E8',
                            background: targeting.estamento_objetivo === null ? '#F0F4FF' : '#FAFAFA' }}>
                          <div style={{ width:16, height:16, borderRadius:'50%', border: targeting.estamento_objetivo === null ? '2px solid #1E3A6E' : '1.5px solid #CCC', background: targeting.estamento_objetivo === null ? '#1E3A6E' : '#fff', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                            {targeting.estamento_objetivo === null && <div style={{ width:7, height:7, borderRadius:'50%', background:'#fff' }} />}
                          </div>
                          <div>
                            <div style={{ fontSize:12, fontWeight: targeting.estamento_objetivo === null ? 600 : 400, color:'#222' }}>Todos los colaboradores</div>
                            <div style={{ fontSize:10, color:'#888' }}>Curso global — visible para todos los estamentos</div>
                          </div>
                        </div>

                        {/* Estamentos específicos */}
                        {ESTAMENTOS.map(est => (
                          <div key={est} onClick={() => setTargeting(t => ({ ...t, estamento_objetivo: est }))}
                            style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', borderRadius:8, marginBottom:4, cursor:'pointer',
                              border: targeting.estamento_objetivo === est ? '2px solid #1E3A6E' : '1px solid #E8E8E8',
                              background: targeting.estamento_objetivo === est ? '#F0F4FF' : '#FAFAFA' }}>
                            <div style={{ width:16, height:16, borderRadius:'50%', border: targeting.estamento_objetivo === est ? '2px solid #1E3A6E' : '1.5px solid #CCC', background: targeting.estamento_objetivo === est ? '#1E3A6E' : '#fff', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                              {targeting.estamento_objetivo === est && <div style={{ width:7, height:7, borderRadius:'50%', background:'#fff' }} />}
                            </div>
                            <span style={{ fontSize:12, fontWeight: targeting.estamento_objetivo === est ? 600 : 400, color:'#222' }}>{est}</span>
                          </div>
                        ))}
                      </div>

                      {/* Resumen + Guardar */}
                      <div style={{ background:'#F4F5F7', borderRadius:8, padding:'10px 14px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
                        <div style={{ fontSize:12, color:'#555' }}>
                          {targeting.estamento_objetivo
                            ? <>Dirigido a: <strong>{targeting.estamento_objetivo}</strong></>
                            : <><strong>Todos</strong> los colaboradores</>}
                          {targeting.obligatorio && <span style={{ marginLeft:8, background:'#E8505B', color:'#fff', borderRadius:4, fontSize:10, padding:'2px 7px', fontWeight:600 }}>OBLIGATORIO</span>}
                        </div>
                        <button onClick={guardarTargeting} disabled={guardandoTargeting}
                          style={{ fontSize:12, padding:'6px 16px', borderRadius:7, border:'none', background:'#1E3A6E', color:'#fff', cursor:'pointer', fontWeight:500, flexShrink:0 }}>
                          {guardandoTargeting ? 'Guardando...' : <><Icon icon="lucide:check" width={13} style={{verticalAlign:'middle',marginRight:4}} /> Guardar configuración</>}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ── Tab Video Intro ── */}
                  {tabDetalle === 'video' && (
                    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                      <div style={{ fontSize:13, color:'#555' }}>
                        El video introductorio se muestra al colaborador <strong>antes</strong> de que pueda acceder a los módulos del curso.
                        Acepta archivos MP4 o WebM (máx. 500 MB).
                      </div>

                      {videoIntroUrl ? (
                        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                          <video controls style={{ width:'100%', borderRadius:10, background:'#000', maxHeight:320 }}>
                            <source src={videoIntroUrl} type="video/mp4" />
                            <source src={videoIntroUrl} type="video/webm" />
                          </video>
                          <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
                            <label style={{ background:'#2B4BA0', color:'#fff', borderRadius:8, padding:'8px 16px', fontSize:12, cursor:'pointer', fontWeight:500 }}>
                              {subiendoVideo ? 'Subiendo...' : <><Icon icon="lucide:upload" width={13} style={{verticalAlign:'middle',marginRight:4}} /> Reemplazar video</>}
                              <input type="file" accept="video/mp4,video/webm" style={{ display:'none' }} onChange={subirVideoIntro} disabled={subiendoVideo} />
                            </label>
                            <button onClick={eliminarVideoIntro} disabled={eliminandoVideo}
                              style={{ background:'none', color:'#E8505B', border:'1px solid #E8505B', borderRadius:8, padding:'8px 16px', fontSize:12, cursor:'pointer', fontWeight:500 }}>
                              {eliminandoVideo ? 'Eliminando...' : <><Icon icon="lucide:x" width={13} style={{verticalAlign:'middle',marginRight:3}} /> Quitar video</>}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <label style={{
                          display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                          border:'2px dashed #D0D5DD', borderRadius:12, padding:'40px 24px', cursor:'pointer',
                          background: subiendoVideo ? '#F9FAFB' : '#FAFAFA', gap:10
                        }}>
                          <Icon icon="lucide:video" width={36} style={{marginBottom:8,display:"block",color:"#888"}} />
                          <div style={{ fontSize:13, fontWeight:500, color:'#444' }}>
                            {subiendoVideo ? 'Subiendo video...' : 'Arrastra o haz click para subir un video'}
                          </div>
                          <div style={{ fontSize:11, color:'#888' }}>MP4 o WebM · máx. 500 MB</div>
                          <input type="file" accept="video/mp4,video/webm" style={{ display:'none' }} onChange={subirVideoIntro} disabled={subiendoVideo} />
                        </label>
                      )}
                    </div>
                  )}
                </div>

                {/* Botones aprobar/rechazar */}
                <div style={{ padding:'14px 24px', borderTop:'0.5px solid #E8E8E8', display:'flex', gap:10, flexShrink:0 }}>
                  <button style={{ flex:1, height:40, background:'#1A7A45', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer' }}
                    onClick={async () => {
                      try { await api.patch(`/cursos/${cursoDetalle.id}/aprobar`); cerrarDetalle(); recargar() }
                      catch { alert('Error al aprobar el curso') }
                    }}>
                    <><Icon icon="lucide:check" width={13} style={{verticalAlign:"middle",marginRight:4}} /> Aprobar y publicar</>
                  </button>
                  <button style={{ flex:1, height:40, background:'none', color:'#E8505B', border:'1px solid #E8505B', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer' }}
                    onClick={async () => {
                      if (!confirm('¿Rechazar este borrador? Se eliminará permanentemente.')) return
                      try { await api.delete(`/cursos/${cursoDetalle.id}`); cerrarDetalle(); recargar() }
                      catch { alert('Error al rechazar el curso') }
                    }}>
                    <><Icon icon="lucide:x" width={13} style={{verticalAlign:"middle",marginRight:3}} /> Rechazar</>
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
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: '#FFF8E8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon icon="lucide:sparkles" width={18} style={{color:'#F5A623'}} /></div>
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
                      setCursoDetalle({ ...curso, modulos: detalle.data.modulos, preguntas: detalle.data.preguntas, imagenes_protocolo: detalle.data.imagenes_protocolo || [] })
                      setTargeting({ estamento_objetivo: detalle.data.estamento_objetivo || null, obligatorio: !!detalle.data.obligatorio })
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
              <div className="card-header" style={{ flexWrap:'wrap', gap:6 }}>
                <span className="card-title">Mis cursos ({cursos.length})</span>
                <div style={{ display:'flex', gap:6, marginLeft:'auto' }}>
                  {modoSeleccion ? (
                    <>
                      <button style={{ fontSize:11, padding:'3px 10px', borderRadius:6, border:'1px solid #CCC', background:'#fff', cursor:'pointer', color:'#555' }}
                        onClick={() => { setModoSeleccion(false); setSeleccionados(new Set()) }}>
                        Cancelar
                      </button>
                      <button style={{ fontSize:11, padding:'3px 10px', borderRadius:6, border:'none', background: seleccionados.size===cursos.length?'#555':'#EEE', color: seleccionados.size===cursos.length?'#fff':'#333', cursor:'pointer' }}
                        onClick={() => setSeleccionados(seleccionados.size===cursos.length ? new Set() : new Set(cursos.map(c=>c.id)))}>
                        {seleccionados.size===cursos.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
                      </button>
                      {seleccionados.size > 0 && (
                        <button style={{ fontSize:11, padding:'3px 10px', borderRadius:6, border:'none', background:'#E8505B', color:'#fff', cursor:'pointer', fontWeight:500 }}
                          onClick={eliminarMasivo} disabled={eliminandoMasivo}>
                          {eliminandoMasivo ? 'Eliminando...' : `Eliminar (${seleccionados.size})`}
                        </button>
                      )}
                    </>
                  ) : (
                    <button style={{ fontSize:11, padding:'3px 10px', borderRadius:6, border:'1px solid #E8E8E8', background:'#fff', cursor:'pointer', color:'#666' }}
                      onClick={() => setModoSeleccion(true)}>
                      Seleccionar
                    </button>
                  )}
                </div>
              </div>
              <div style={{ maxHeight: modoSeleccion ? 340 : 'none', overflowY: modoSeleccion ? 'auto' : 'visible' }}>
                {(modoSeleccion ? cursos : cursos.slice(0,4)).map(c => (
                  <div key={c.id} className="row-divider" style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', cursor: modoSeleccion ? 'pointer' : 'default' }}
                    onClick={modoSeleccion ? () => toggleSeleccion(c.id) : undefined}>
                    {modoSeleccion && (
                      <div style={{ width:18, height:18, borderRadius:4, border: seleccionados.has(c.id) ? '2px solid #1E3A6E' : '1.5px solid #CCC', background: seleccionados.has(c.id) ? '#1E3A6E' : '#fff', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        {seleccionados.has(c.id) && <Icon icon="lucide:check" color="#fff" width={11} />}
                      </div>
                    )}
                    {!modoSeleccion && <div style={{ width:28, height:28, background:'#FFEEEC', borderRadius:6, flexShrink:0 }} />}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{c.nombre}</div>
                      <div style={{ display:'flex', gap:6, marginTop:4, flexWrap:'wrap' }}>
                        <span className={`format-tag ${c.publicado ? 'tag-publicado' : 'tag-borrador'}`}>
                          {c.publicado ? 'Publicado' : 'Borrador'}
                        </span>
                        {c.obligatorio ? <span style={{ fontSize:9, background:'#E8505B', color:'#fff', borderRadius:4, padding:'2px 6px', fontWeight:700, letterSpacing:'0.04em' }}>OBLIGATORIO</span> : null}
                        {c.estamento_objetivo
                          ? <span style={{ fontSize:9, background:'#EEF2FF', color:'#2B4BA0', borderRadius:4, padding:'2px 6px', fontWeight:500 }}>{c.estamento_objetivo.split(' ').slice(0,2).join(' ')}</span>
                          : <span style={{ fontSize:9, background:'#F0FBF4', color:'#1A7A45', borderRadius:4, padding:'2px 6px', fontWeight:500 }}>Todos</span>
                        }
                      </div>
                    </div>
                    {!modoSeleccion && (
                      !c.publicado
                        ? <button className="btn-sm btn-sm-primary" onClick={() => api.patch(`/cursos/${c.id}/publicar`, { publicado:true }).then(recargar)}>Publicar</button>
                        : <button className="btn-sm btn-sm-outline">Editar</button>
                    )}
                  </div>
                ))}
                {!modoSeleccion && cursos.length > 4 && (
                  <div style={{ fontSize:11, color:'#888', textAlign:'center', paddingTop:8, cursor:'pointer' }}
                    onClick={() => setModoSeleccion(true)}>
                    +{cursos.length - 4} más · Ver todos
                  </div>
                )}
              </div>
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
