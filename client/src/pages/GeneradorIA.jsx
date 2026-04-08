import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Topbar from '../components/Topbar'
import Sidebar from '../components/Sidebar'
import api from '../services/api'

// ── buildSlides: usa diapositivas IA si existen ──────────────────────────────
function buildSlides(mod, pres) {
  if (Array.isArray(pres.diapositivas) && pres.diapositivas.length > 0) {
    return pres.diapositivas
  }
  return []
}

// ── SlideEditor: edita el contenido de una diapositiva ───────────────────────
function SlideEditor({ slide, onChange, imagenes = [] }) {
  const upd = (key, val) => onChange({ ...slide, [key]: val })
  const updArr = (key, idx, val) => {
    const arr = [...(slide[key] || [])]
    arr[idx] = val
    onChange({ ...slide, [key]: arr })
  }
  const fld = { fontSize: 12, padding: '6px 10px', borderRadius: 6, border: '1px solid #CCC', width: '100%', boxSizing: 'border-box' }
  const ta = { ...fld, resize: 'none' }
  const lbl = { fontSize: 11, color: '#555', marginBottom: 4, display: 'block' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '16px 20px', maxHeight: '55vh', overflowY: 'auto' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#2B4BA0', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>
        Editando slide: {slide.tipo}
      </div>

      {slide.tipo === 'objetivos' && (<>
        <div><label style={lbl}>Título</label>
          <input style={fld} value={slide.titulo || ''} onChange={e => upd('titulo', e.target.value)} /></div>
        <div><label style={lbl}>Objetivos (uno por campo)</label>
          {(slide.lista || []).map((obj, k) => (
            <input key={k} style={{ ...fld, marginBottom: 4 }} value={obj} onChange={e => updArr('lista', k, e.target.value)} />
          ))}</div>
      </>)}

      {slide.tipo === 'desempeno' && (<>
        <div><label style={lbl}>Título</label>
          <input style={fld} value={slide.titulo || ''} onChange={e => upd('titulo', e.target.value)} /></div>
        <div><label style={lbl}>Descripción del objetivo</label>
          <textarea style={ta} rows={4} value={slide.descripcion || ''} onChange={e => upd('descripcion', e.target.value)} /></div>
      </>)}

      {slide.tipo === 'introduccion' && (<>
        <div><label style={lbl}>Título</label>
          <input style={fld} value={slide.titulo || ''} onChange={e => upd('titulo', e.target.value)} /></div>
        <div><label style={lbl}>Texto introductorio</label>
          <textarea style={ta} rows={5} value={slide.texto || ''} onChange={e => upd('texto', e.target.value)} /></div>
      </>)}

      {slide.tipo === 'puntos_clave' && (<>
        <div><label style={lbl}>Título</label>
          <input style={fld} value={slide.titulo || ''} onChange={e => upd('titulo', e.target.value)} /></div>
        <div><label style={lbl}>Puntos claves (uno por campo)</label>
          {(slide.puntos || []).map((p, k) => (
            <input key={k} style={{ ...fld, marginBottom: 4 }} value={p} onChange={e => updArr('puntos', k, e.target.value)} />
          ))}</div>
      </>)}

      {slide.tipo === 'importante' && (<>
        <div><label style={lbl}>Título</label>
          <input style={fld} value={slide.titulo || ''} onChange={e => upd('titulo', e.target.value)} /></div>
        <div><label style={lbl}>Cosas importantes (una por campo)</label>
          {(slide.puntos || []).map((p, k) => (
            <input key={k} style={{ ...fld, marginBottom: 4 }} value={p} onChange={e => updArr('puntos', k, e.target.value)} />
          ))}</div>
      </>)}

      {slide.tipo === 'conclusion' && (<>
        <div><label style={lbl}>Título</label>
          <input style={fld} value={slide.titulo || ''} onChange={e => upd('titulo', e.target.value)} /></div>
        <div><label style={lbl}>Texto de cierre</label>
          <textarea style={ta} rows={4} value={slide.texto || ''} onChange={e => upd('texto', e.target.value)} /></div>
        <div><label style={lbl}>Mensaje motivacional</label>
          <input style={fld} value={slide.mensaje || ''} onChange={e => upd('mensaje', e.target.value)} /></div>
      </>)}

      {!['objetivos', 'desempeno', 'introduccion', 'puntos_clave', 'importante', 'conclusion'].includes(slide.tipo) && (
        <div style={{ fontSize: 12, color: '#888', textAlign: 'center', padding: '2rem 0' }}>
          El tipo "{slide.tipo}" no tiene campos editables en esta vista.
        </div>
      )}

      {/* ── Selector de imagen del protocolo ── */}
      {imagenes.length > 0 && (
        <div style={{ marginTop: 8, borderTop: '1px solid #EEE', paddingTop: 10 }}>
          <label style={lbl}>Imagen del protocolo (opcional)</label>
          {slide.imagen && (
            <div style={{ marginBottom: 8, position: 'relative', display: 'inline-block' }}>
              <img src={slide.imagen} alt="seleccionada" style={{ height: 80, borderRadius: 6, border: '2px solid #2B4BA0', objectFit: 'cover' }} />
              <button onClick={() => upd('imagen', null)} style={{
                position: 'absolute', top: -6, right: -6, width: 18, height: 18,
                borderRadius: '50%', background: '#E8505B', color: '#fff', border: 'none',
                fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>✕</button>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
            {imagenes.map((url, k) => (
              <img key={k} src={url} alt={`pág ${k + 1}`}
                onClick={() => upd('imagen', url)}
                style={{
                  width: '100%', height: 60, objectFit: 'cover', borderRadius: 5, cursor: 'pointer',
                  border: slide.imagen === url ? '2px solid #2B4BA0' : '1.5px solid #DDD',
                  opacity: slide.imagen === url ? 1 : 0.8
                }} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Slide: renderiza cada tipo de diapositiva ─────────────────────────────────
export function Slide({ slide, total, actual }) {
  if (!slide || typeof slide !== 'object') return null

  // Paleta institucional ONG
  const paletas = {
    objetivos:   { bg: '#191B0E', color: '#EFEDE3', accent: '#F26B43' },
    desempeno:   { bg: '#EFEDE3', color: '#191B0E', accent: '#F26B43' },
    introduccion:{ bg: '#fff',    color: '#191B0E', accent: '#897B61' },
    puntos_clave:{ bg: '#EFEDE3', color: '#191B0E', accent: '#8DAB8E' },
    importante:  { bg: '#191B0E', color: '#EFEDE3', accent: '#E6C069' },
    conclusion:  { bg: '#F26B43', color: '#fff',    accent: 'rgba(255,255,255,0.2)' },
  }
  const p = paletas[slide.tipo] || { bg: '#EFEDE3', color: '#191B0E', accent: '#F26B43' }

  return (
    <div style={{
      background: p.bg, borderRadius: 12, padding: '36px 40px',
      minHeight: 340, display: 'flex', flexDirection: 'column', justifyContent: 'center',
      position: 'relative', overflow: 'hidden'
    }}>
      <div style={{ position: 'absolute', right: -40, top: -40, width: 180, height: 180, borderRadius: '50%', background: p.accent, opacity: 0.25, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', left: -30, bottom: -30, width: 120, height: 120, borderRadius: '50%', background: p.accent, opacity: 0.2, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: 14, right: 18, fontSize: 11, color: p.color, opacity: 0.45 }}>{actual + 1} / {total}</div>

      {/* ── OBJETIVOS DE APRENDIZAJE ── */}
      {slide.tipo === 'objetivos' && (
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: p.accent, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>Módulo</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: p.color, marginBottom: 20 }}>{slide.titulo}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {slide.lista?.map((obj, k) => (
              <div key={k} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: p.accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{k + 1}</div>
                <div style={{ fontSize: 13, color: p.color, lineHeight: 1.5, paddingTop: 4 }}>{obj}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── OBJETIVO DE DESEMPEÑO ── */}
      {slide.tipo === 'desempeno' && (
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: p.accent, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>Objetivo de desempeño</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: p.color, marginBottom: 20 }}>{slide.titulo}</div>
          <div style={{ fontSize: 15, color: p.color, lineHeight: 1.8, borderLeft: `4px solid ${p.accent}`, paddingLeft: 16, fontStyle: 'italic' }}>
            {slide.descripcion}
          </div>
        </div>
      )}

      {/* ── INTRODUCCIÓN ── */}
      {slide.tipo === 'introduccion' && (
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: p.accent, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>Introducción</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: p.color, marginBottom: 16 }}>{slide.titulo}</div>
          <div style={{ fontSize: 14, color: '#444', lineHeight: 1.8 }}>{slide.texto}</div>
        </div>
      )}

      {/* ── PUNTOS CLAVES DEL PROTOCOLO ── */}
      {slide.tipo === 'puntos_clave' && (
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: p.accent, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>Puntos claves del protocolo</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: p.color, marginBottom: 16 }}>{slide.titulo}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {slide.puntos?.map((punto, k) => (
              <div key={k} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.accent, flexShrink: 0, marginTop: 5 }} />
                <div style={{ fontSize: 13, color: p.color, lineHeight: 1.5 }}>{punto}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── COSAS IMPORTANTES ── */}
      {slide.tipo === 'importante' && (
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: p.accent, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>Cosas importantes</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: p.color, marginBottom: 18 }}>{slide.titulo}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {slide.puntos?.map((punto, k) => (
              <div key={k} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: p.accent, color: '#191B0E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>!</div>
                <div style={{ fontSize: 14, color: p.color, lineHeight: 1.5, paddingTop: 4 }}>{punto}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── IMAGEN DEL PROTOCOLO (en cualquier slide) ── */}
      {slide.imagen && (
        <div style={{ marginTop: 16, borderRadius: 8, overflow: 'hidden', maxHeight: 180, display: 'flex', justifyContent: 'center' }}>
          <img src={slide.imagen} alt="Imagen del protocolo" style={{ maxHeight: 180, maxWidth: '100%', objectFit: 'contain', borderRadius: 8 }} />
        </div>
      )}

      {/* ── CONCLUSIÓN ── */}
      {slide.tipo === 'conclusion' && (
        <div style={{ textAlign: 'center', position: 'relative' }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12 }}>Conclusión</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 20 }}>{slide.titulo}</div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.9)', lineHeight: 1.8, maxWidth: 480, margin: '0 auto 24px' }}>{slide.texto}</div>
          {slide.mensaje && (
            <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.15)', borderRadius: 8, padding: '10px 20px', fontSize: 13, color: '#fff', fontStyle: 'italic' }}>
              "{slide.mensaje}"
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Componente principal ───────────────────────────────────────────────────────
export default function GeneradorIA() {
  const navigate = useNavigate()
  const [archivo, setArchivo] = useState(null)
  const [form, setForm] = useState({ nombre_curso: '', area: '', contexto: '', num_modulos: '' })
  const [fuentePDF, setFuentePDF] = useState('subir')   // 'subir' | 'biblioteca'
  const [protocolos, setProtocolos] = useState([])
  const [protocoloSeleccionado, setProtocoloSeleccionado] = useState(null)
  const [resultado, setResultado] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  const [modoEdicion, setModoEdicion] = useState(false)
  const [borradorEdit, setBorradorEdit] = useState(null)
  const [guardando, setGuardando] = useState(false)

  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [moduloExpandido, setModuloExpandido] = useState(null)
  const [preguntasExpandidas, setPreguntasExpandidas] = useState({})

  // Modal presentación
  const [presentacionActiva, setPresentacionActiva] = useState(null)
  const [presentaciones, setPresentaciones] = useState({})   // índice → datos | 'cargando' | 'error'
  const [modoPPT, setModoPPT] = useState(false)
  const [slideActual, setSlideActual] = useState(0)
  const [editandoPPT, setEditandoPPT] = useState(false)
  const [pptEditData, setPptEditData] = useState({})  // módulo idx → presentacion editada
  const [contenidos, setContenidos] = useState({})    // módulo idx → contenido | 'cargando' | 'error'
  const [contenidoActivo, setContenidoActivo] = useState(null)

  const abrirPresentacion = async (i) => {
    setPresentacionActiva(i)
    setModoPPT(false)
    setSlideActual(0)
    if (presentaciones[i]) return
    setPresentaciones(prev => ({ ...prev, [i]: 'cargando' }))
    try {
      const mod = resultado.modulos[i]
      const res = await api.post('/ia/generar-presentacion', {
        titulo: mod.titulo,
        descripcion: mod.descripcion,
        contexto: form.contexto
      })
      setPresentaciones(prev => ({ ...prev, [i]: res.data.presentacion }))
    } catch {
      setPresentaciones(prev => ({ ...prev, [i]: 'error' }))
    }
  }

  const cerrarModal = () => { setPresentacionActiva(null); setModoPPT(false); setSlideActual(0); setEditandoPPT(false) }

  const abrirContenido = async (i) => {
    setContenidoActivo(i)
    if (contenidos[i]) return
    setContenidos(prev => ({ ...prev, [i]: 'cargando' }))
    try {
      const mod = resultado.modulos[i]
      const res = await api.post('/ia/generar-contenido', {
        modulo_id: mod.id,
        titulo: mod.titulo,
        descripcion: mod.descripcion,
        contexto: form.contexto
      })
      setContenidos(prev => ({ ...prev, [i]: res.data.contenido }))
    } catch {
      setContenidos(prev => ({ ...prev, [i]: 'error' }))
    }
  }
  const cerrarContenido = () => setContenidoActivo(null)

  // Cargar biblioteca de protocolos al montar
  useState(() => {
    api.get('/protocolos').then(r => setProtocolos(r.data)).catch(() => {})
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (fuentePDF === 'subir' && !archivo) return setError('Selecciona un archivo PDF')
    if (fuentePDF === 'biblioteca' && !protocoloSeleccionado) return setError('Selecciona un protocolo de la biblioteca')
    if (!form.nombre_curso) return setError('El nombre del curso es obligatorio')
    setCargando(true); setError('')
    try {
      const data = new FormData()
      data.append('nombre_curso', form.nombre_curso)
      data.append('area', form.area)
      data.append('contexto', form.contexto)
      if (form.num_modulos) data.append('num_modulos', form.num_modulos)
      if (fuentePDF === 'subir') {
        data.append('protocolo', archivo)
      } else {
        data.append('protocolo_id', protocoloSeleccionado.id)
      }
      const res = await api.post('/ia/generar-curso', data, { headers: { 'Content-Type': 'multipart/form-data' } })
      setResultado(res.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Error al generar el curso')
    } finally { setCargando(false) }
  }

  const guardarEdicion = async () => {
    setGuardando(true)
    try {
      const preguntas = borradorEdit.modulos.flatMap(m => m.preguntas || [])
      const modulos = borradorEdit.modulos.map((m, i) => {
        const base = { id: m.id, titulo: m.titulo, descripcion: m.descripcion }
        if (pptEditData[i]) base.contenido_presentacion = pptEditData[i]
        return base
      })
      await api.put(`/cursos/${resultado.curso_id}`, {
        nombre: borradorEdit.nombre,
        descripcion: borradorEdit.descripcion,
        modulos,
        preguntas
      })
      if (Object.keys(pptEditData).length > 0) {
        setPresentaciones(prev => {
          const next = { ...prev }
          Object.entries(pptEditData).forEach(([i, pres]) => { next[Number(i)] = pres })
          return next
        })
        setPptEditData({})
      }
      setResultado(prev => ({ ...prev, nombre: borradorEdit.nombre, descripcion: borradorEdit.descripcion, modulos: borradorEdit.modulos }))
      setModoEdicion(false)
    } catch {
      alert('Error al guardar los cambios')
    } finally { setGuardando(false) }
  }

  const descartarBorrador = async () => {
    if (!confirm('¿Seguro que deseas descartar este borrador? Se eliminará permanentemente.')) return
    try {
      await api.delete(`/cursos/${resultado.curso_id}`)
      setResultado(null)
    } catch {
      alert('Error al descartar el borrador')
    }
  }

  // ── Slides activos para el módulo en el modal ──
  const pres = presentacionActiva !== null ? presentaciones[presentacionActiva] : null
  const mod  = presentacionActiva !== null ? resultado?.modulos?.[presentacionActiva] : null
  // Usa datos editados si existen, de lo contrario usa los originales
  const activePres = (presentacionActiva !== null && pptEditData[presentacionActiva]) ? pptEditData[presentacionActiva] : pres
  let slides = []
  try {
    if (activePres && activePres !== 'cargando' && activePres !== 'error' && mod) {
      slides = buildSlides(mod, activePres)
    }
  } catch { slides = [] }

  return (
    <div className="app-shell">
      <Topbar seccion="Panel de jefatura — Generador de cursos" />
      <div className="app-body">

        <Sidebar />

        <main className="main-content" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          <div>
            <div className="page-title">Generador de cursos con IA</div>
            <div className="page-sub">Sube un protocolo institucional en PDF y genera un borrador de curso automáticamente</div>
          </div>

          <div style={{ background: '#1E3A6E', borderRadius: 12, padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: 24 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 22 }}>✨</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 500, color: '#fff', marginBottom: 3 }}>Generación automática de cursos</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
                La IA analiza el protocolo, extrae los conceptos clave y genera módulos con preguntas y presentaciones estilo PPT.
              </div>
            </div>
            <span className="ia-badge">Beta</span>
          </div>

          <div className="three-col">
            {[
              { num: 1, color: '#2B4BA0', title: 'Sube el protocolo', desc: 'Selecciona el PDF del protocolo institucional a digitalizar.' },
              { num: 2, color: '#F5A623', title: 'La IA genera el borrador', desc: 'El sistema extrae módulos, preguntas y presentaciones PPT.' },
              { num: 3, color: '#7BC67A', title: 'El profesor valida', desc: 'El contenido generado es revisado y aprobado antes de publicarse.' },
            ].map(s => (
              <div key={s.num} className="card" style={{ position: 'relative' }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 500, color: '#fff', marginBottom: 10 }}>{s.num}</div>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>{s.title}</div>
                <div style={{ fontSize: 11, color: '#888', lineHeight: 1.6 }}>{s.desc}</div>
              </div>
            ))}
          </div>

          <div className="two-col">
            {/* Formulario */}
            <div className="card">
              <div className="card-title" style={{ marginBottom: 16 }}>Subir protocolo</div>
              <form onSubmit={handleSubmit}>
                {/* Toggle fuente PDF */}
                <div style={{ display: 'flex', background: '#F0F2F5', borderRadius: 8, padding: 3, gap: 2, marginBottom: 14 }}>
                  {[['subir','📤 Subir PDF'],['biblioteca','📁 Desde biblioteca']].map(([val, lbl]) => (
                    <button key={val} type="button" onClick={() => setFuentePDF(val)} style={{
                      flex: 1, height: 32, borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: fuentePDF === val ? 600 : 400,
                      background: fuentePDF === val ? '#fff' : 'transparent',
                      color: fuentePDF === val ? '#1E3A6E' : '#888',
                      boxShadow: fuentePDF === val ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                    }}>{lbl}</button>
                  ))}
                </div>

                {fuentePDF === 'subir' ? (
                  <div className="upload-zone" style={{ marginBottom: 16 }} onClick={() => document.getElementById('input-pdf').click()}>
                    <input id="input-pdf" type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => setArchivo(e.target.files[0])} />
                    {archivo ? (
                      <><div style={{ fontSize: 20, marginBottom: 4 }}>✓</div>
                        <div style={{ fontSize: 12, fontWeight: 500, color: '#1A7A45' }}>{archivo.name}</div>
                        <span className="format-tag tag-pdf" style={{ marginTop: 6, display: 'inline-block' }}>PDF</span></>
                    ) : (
                      <><div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Arrastra o selecciona un PDF</div>
                        <div style={{ fontSize: 11, color: '#888' }}>Protocolo institucional en formato PDF</div></>
                    )}
                  </div>
                ) : (
                  <div style={{ marginBottom: 16 }}>
                    {protocolos.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '1.5rem', background: '#F4F5F7', borderRadius: 8, fontSize: 12, color: '#888' }}>
                        No hay protocolos guardados. <a href="/jefatura/protocolos" style={{ color: '#1E3A6E' }}>Ir a la biblioteca →</a>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
                        {protocolos.map(p => (
                          <div key={p.id} onClick={() => setProtocoloSeleccionado(p)} style={{
                            padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
                            border: `1.5px solid ${protocoloSeleccionado?.id === p.id ? '#1E3A6E' : '#E8E8E8'}`,
                            background: protocoloSeleccionado?.id === p.id ? '#F0F4FF' : '#fff',
                            display: 'flex', alignItems: 'center', gap: 10
                          }}>
                            <span style={{ fontSize: 16 }}>📄</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 500, color: '#222' }}>{p.nombre}</div>
                              {p.descripcion && <div style={{ fontSize: 10, color: '#888' }}>{p.descripcion}</div>}
                            </div>
                            {protocoloSeleccionado?.id === p.id && <span style={{ color: '#1E3A6E', fontSize: 14 }}>✓</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div className="field">
                  <label>Nombre del curso *</label>
                  <input type="text" placeholder="Ej: Alimentación del adulto mayor en cama"
                    value={form.nombre_curso} onChange={e => setForm({ ...form, nombre_curso: e.target.value })} />
                </div>
                <div className="field">
                  <label>Área</label>
                  <select value={form.area} onChange={e => setForm({ ...form, area: e.target.value })}>
                    <option value="">Seleccionar área</option>
                    <option>Cuidado clínico</option>
                    <option>Alimentación</option>
                    <option>Seguridad y emergencias</option>
                    <option>Higiene y cuidado personal</option>
                    <option>Movilización y posicionamiento</option>
                  </select>
                </div>
                <div className="field">
                  <label>Número de módulos</label>
                  <select value={form.num_modulos} onChange={e => setForm({ ...form, num_modulos: e.target.value })}>
                    <option value="">Automático (según el protocolo)</option>
                    {[3,4,5,6,7,8].map(n => <option key={n} value={n}>{n} módulos</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Contexto adicional (opcional)</label>
                  <textarea rows={3} placeholder="Ej: Aplica especialmente para residentes con movilidad reducida..."
                    value={form.contexto} onChange={e => setForm({ ...form, contexto: e.target.value })}
                    style={{ resize: 'none' }} />
                </div>
                {error && <p style={{ color: '#E8505B', fontSize: 12, marginBottom: 8 }}>{error}</p>}
                <button type="submit" disabled={cargando} style={{
                  width: '100%', height: 42, background: '#1E3A6E', color: '#fff', border: 'none',
                  borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                }}>
                  {cargando ? '⏳ Generando...' : '✨ Generar curso con IA'}
                </button>
              </form>
            </div>

            {/* Preview */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Borrador generado</span>
                {resultado && <span className="preview-badge">Listo para revisar</span>}
              </div>

              {cargando && (
                <div style={{ textAlign: 'center', padding: '3rem 0', color: '#888' }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
                  <div style={{ fontSize: 13 }}>Analizando el protocolo...</div>
                  <div style={{ fontSize: 11, marginTop: 6 }}>Esto puede tomar 30–60 segundos</div>
                </div>
              )}

              {!resultado && !cargando && (
                <div style={{ textAlign: 'center', padding: '3rem 0', color: '#CCC' }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🤖</div>
                  <div style={{ fontSize: 13 }}>El borrador aparecerá aquí</div>
                </div>
              )}

              {resultado && (
                <>
                  {/* ── MODAL CONTENIDO DE APRENDIZAJE ────────────── */}
                  {contenidoActivo !== null && resultado?.modulos?.[contenidoActivo] && (
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={cerrarContenido}>
                      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 680, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 12px 48px rgba(0,0,0,0.3)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
                        <div style={{ background: '#F4F5F7', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #E8E8E8' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>📖 {resultado.modulos[contenidoActivo].titulo}</div>
                            <div style={{ fontSize: 11, color: '#888' }}>Contenido de aprendizaje</div>
                          </div>
                          {contenidos[contenidoActivo] && contenidos[contenidoActivo] !== 'cargando' && contenidos[contenidoActivo] !== 'error' && (
                            <button onClick={() => { setContenidos(prev => { const n={...prev}; delete n[contenidoActivo]; return n }) }} style={{ fontSize: 10, padding: '3px 10px', borderRadius: 6, border: '0.5px solid #CCC', background: 'none', cursor: 'pointer', color: '#888' }}>↺ Regenerar</button>
                          )}
                          <button onClick={cerrarContenido} style={{ background: 'none', border: 'none', fontSize: 18, color: '#AAA', cursor: 'pointer' }}>✕</button>
                        </div>
                        <div style={{ overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                          {contenidos[contenidoActivo] === 'cargando' && (
                            <div style={{ textAlign: 'center', padding: '3rem 0', color: '#888' }}>
                              <div style={{ fontSize: 28, marginBottom: 10 }}>⏳</div>
                              <div style={{ fontSize: 13 }}>Generando contenido educativo...</div>
                              <div style={{ fontSize: 11, marginTop: 4, color: '#AAA' }}>Puede tomar hasta 2 minutos</div>
                            </div>
                          )}
                          {contenidos[contenidoActivo] === 'error' && (
                            <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                              <div style={{ fontSize: 13, color: '#E8505B', marginBottom: 10 }}>No se pudo generar el contenido</div>
                              <button onClick={() => { setContenidos(prev => { const n={...prev}; delete n[contenidoActivo]; return n }); abrirContenido(contenidoActivo) }} style={{ fontSize: 12, background: '#1E3A6E', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer' }}>Reintentar</button>
                            </div>
                          )}
                          {contenidos[contenidoActivo] && contenidos[contenidoActivo] !== 'cargando' && contenidos[contenidoActivo] !== 'error' && (() => {
                            const c = contenidos[contenidoActivo]
                            return (<>
                              {c.introduccion && (
                                <div style={{ background: '#EFEDE3', borderRadius: 8, padding: '12px 16px', borderLeft: '4px solid #F26B43', fontSize: 13, color: '#191B0E', lineHeight: 1.7 }}>
                                  {c.introduccion}
                                </div>
                              )}
                              {c.secciones?.map((sec, k) => (
                                <div key={k}>
                                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1E3A6E', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#1E3A6E', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, flexShrink: 0 }}>{k+1}</div>
                                    {sec.titulo}
                                  </div>
                                  <div style={{ fontSize: 13, color: '#444', lineHeight: 1.7, marginBottom: 10 }}>{sec.texto}</div>
                                  {sec.puntos?.length > 0 && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                      {sec.puntos.map((p, j) => (
                                        <div key={j} style={{ display: 'flex', gap: 8, fontSize: 12, color: '#333' }}>
                                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#8DAB8E', flexShrink: 0, marginTop: 5 }} />
                                          {p}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                              {c.caso_practico && (
                                <div style={{ background: '#F0F4FF', borderRadius: 8, padding: '12px 16px' }}>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: '#1E3A6E', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Caso práctico</div>
                                  <div style={{ fontSize: 13, color: '#333', lineHeight: 1.6, marginBottom: 10 }}>{c.caso_practico.descripcion}</div>
                                  {c.caso_practico.pasos?.map((p, k) => (
                                    <div key={k} style={{ display: 'flex', gap: 8, fontSize: 12, color: '#333', marginBottom: 6 }}>
                                      <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#1E3A6E', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, flexShrink: 0 }}>{k+1}</span>
                                      {p}
                                    </div>
                                  ))}
                                </div>
                              )}
                              {c.recuerda?.length > 0 && (
                                <div style={{ background: '#191B0E', borderRadius: 8, padding: '12px 16px' }}>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: '#E6C069', marginBottom: 8 }}>Recuerda</div>
                                  {c.recuerda.map((p, k) => (
                                    <div key={k} style={{ fontSize: 12, color: '#EFEDE3', padding: '3px 0', display: 'flex', gap: 8 }}>
                                      <span style={{ color: '#F26B43', fontWeight: 700 }}>!</span> {p}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </>)
                          })()}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── MODAL PRESENTACIÓN ────────────────────────── */}
                  {presentacionActiva !== null && mod && (
                    <div style={{
                      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1000,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
                    }} onClick={cerrarModal}>
                      <div style={{
                        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 720,
                        boxShadow: '0 12px 48px rgba(0,0,0,0.3)', overflow: 'hidden'
                      }} onClick={e => e.stopPropagation()}>

                        {/* Cabecera modal */}
                        <div style={{ background: '#F4F5F7', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #E8E8E8' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#222' }}>{mod.titulo}</div>
                            <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>Módulo {presentacionActiva + 1} de {resultado.modulos?.length ?? '?'}</div>
                          </div>
                          {/* Tabs */}
                          {pres && pres !== 'cargando' && pres !== 'error' && (
                            <div style={{ display: 'flex', background: '#E8E8E8', borderRadius: 8, padding: 3, gap: 2 }}>
                              <button onClick={() => setModoPPT(false)} style={{
                                fontSize: 11, padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                                background: !modoPPT ? '#fff' : 'transparent',
                                color: !modoPPT ? '#1E3A6E' : '#888',
                                fontWeight: !modoPPT ? 600 : 400,
                                boxShadow: !modoPPT ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                              }}>Resumen</button>
                              <button onClick={() => { setModoPPT(true); setSlideActual(0) }} style={{
                                fontSize: 11, padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                                background: modoPPT ? '#1E3A6E' : 'transparent',
                                color: modoPPT ? '#fff' : '#888',
                                fontWeight: modoPPT ? 600 : 400
                              }}>▶ Presentación</button>
                            </div>
                          )}
                          {modoPPT && pres && pres !== 'cargando' && pres !== 'error' && (
                            <button
                              onClick={() => {
                                if (!editandoPPT) {
                                  setPptEditData(prev => ({
                                    ...prev,
                                    [presentacionActiva]: JSON.parse(JSON.stringify(presentaciones[presentacionActiva]))
                                  }))
                                }
                                setEditandoPPT(e => !e)
                              }}
                              style={{
                                fontSize: 11, padding: '4px 10px', borderRadius: 6,
                                border: `1px solid ${editandoPPT ? '#2B4BA0' : '#CCC'}`,
                                background: editandoPPT ? '#2B4BA0' : 'transparent',
                                color: editandoPPT ? '#fff' : '#555',
                                cursor: 'pointer', fontWeight: 500
                              }}>
                              {editandoPPT ? '← Vista previa' : '✎ Editar slides'}
                            </button>
                          )}
                          <button onClick={cerrarModal} style={{ background: 'none', border: 'none', fontSize: 18, color: '#AAA', cursor: 'pointer' }}>✕</button>
                        </div>

                        {/* Cuerpo modal */}
                        <div style={{ padding: modoPPT ? '0' : '20px 24px' }}>

                          {/* Estado cargando */}
                          {(!pres || pres === 'cargando') && (
                            <div style={{ textAlign: 'center', padding: '3rem 0', color: '#888' }}>
                              <div style={{ fontSize: 28, marginBottom: 10 }}>⏳</div>
                              <div style={{ fontSize: 13 }}>Generando presentación con IA...</div>
                              <div style={{ fontSize: 11, marginTop: 4 }}>Puede tomar unos segundos</div>
                            </div>
                          )}

                          {/* Estado error */}
                          {pres === 'error' && (
                            <div style={{ textAlign: 'center', padding: '3rem 0' }}>
                              <div style={{ fontSize: 13, color: '#E8505B', marginBottom: 12 }}>No se pudo generar la presentación</div>
                              <button onClick={() => { setPresentaciones(prev => { const n = { ...prev }; delete n[presentacionActiva]; return n }); abrirPresentacion(presentacionActiva) }}
                                style={{ fontSize: 12, background: '#1E3A6E', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer' }}>
                                Reintentar
                              </button>
                            </div>
                          )}

                          {/* ── MODO RESUMEN ── construido desde las diapositivas */}
                          {pres && pres !== 'cargando' && pres !== 'error' && !modoPPT && (() => {
                            const diaps       = activePres?.diapositivas || []
                            const objetivos   = diaps.find(d => d.tipo === 'objetivos')
                            const desempeno   = diaps.find(d => d.tipo === 'desempeno')
                            const introduccion= diaps.find(d => d.tipo === 'introduccion')
                            const puntos_clave= diaps.find(d => d.tipo === 'puntos_clave')
                            const importante  = diaps.find(d => d.tipo === 'importante')
                            const conclusion  = diaps.find(d => d.tipo === 'conclusion')
                            return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '60vh', overflowY: 'auto' }}>
                              {objetivos?.lista?.length > 0 && (
                                <div>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: '#F26B43', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Objetivos de aprendizaje</div>
                                  {objetivos.lista.map((obj, k) => (
                                    <div key={k} style={{ display: 'flex', gap: 8, fontSize: 12, color: '#191B0E', marginBottom: 5 }}>
                                      <span style={{ width: 18, height: 18, borderRadius: '50%', background: '#F26B43', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, flexShrink: 0 }}>{k + 1}</span>
                                      {obj}
                                    </div>
                                  ))}
                                </div>
                              )}
                              {desempeno?.descripcion && (
                                <div style={{ background: '#EFEDE3', borderRadius: 8, padding: '10px 14px', borderLeft: '4px solid #F26B43' }}>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: '#F26B43', marginBottom: 4 }}>Objetivo de desempeño</div>
                                  <div style={{ fontSize: 12, color: '#191B0E', lineHeight: 1.6, fontStyle: 'italic' }}>{desempeno.descripcion}</div>
                                </div>
                              )}
                              {introduccion?.texto && (
                                <div>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: '#897B61', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Introducción</div>
                                  <div style={{ fontSize: 12, color: '#555', lineHeight: 1.7 }}>{introduccion.texto}</div>
                                </div>
                              )}
                              {puntos_clave?.puntos?.length > 0 && (
                                <div>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: '#8DAB8E', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Puntos claves del protocolo</div>
                                  {puntos_clave.puntos.map((p, k) => (
                                    <div key={k} style={{ display: 'flex', gap: 8, fontSize: 12, color: '#191B0E', marginBottom: 5, alignItems: 'flex-start' }}>
                                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#8DAB8E', flexShrink: 0, marginTop: 4 }} />
                                      {p}
                                    </div>
                                  ))}
                                </div>
                              )}
                              {importante?.puntos?.length > 0 && (
                                <div style={{ background: '#191B0E', borderRadius: 8, padding: '10px 14px' }}>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: '#E6C069', marginBottom: 6 }}>Cosas importantes</div>
                                  {importante.puntos.map((p, k) => (
                                    <div key={k} style={{ fontSize: 12, color: '#EFEDE3', padding: '2px 0' }}>! {p}</div>
                                  ))}
                                </div>
                              )}
                              {conclusion?.texto && (
                                <div style={{ background: '#F26B43', borderRadius: 8, padding: '10px 14px' }}>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.8)', marginBottom: 4 }}>Conclusión</div>
                                  <div style={{ fontSize: 12, color: '#fff', lineHeight: 1.6 }}>{conclusion.texto}</div>
                                  {conclusion.mensaje && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 6, fontStyle: 'italic' }}>"{conclusion.mensaje}"</div>}
                                </div>
                              )}
                              {diaps.length === 0 && (
                                <div style={{ textAlign: 'center', color: '#AAA', padding: '2rem 0', fontSize: 13 }}>
                                  Sin contenido de resumen disponible
                                </div>
                              )}
                              {/* ── Galería de imágenes del protocolo ── */}
                              {resultado?.imagenes_protocolo?.length > 0 && (
                                <div>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: '#897B61', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                                    Imágenes del protocolo ({resultado.imagenes_protocolo.length})
                                  </div>
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
                                    {resultado.imagenes_protocolo.map((url, k) => (
                                      <a key={k} href={url} target="_blank" rel="noreferrer">
                                        <img src={url} alt={`Imagen ${k + 1}`} style={{
                                          width: '100%', borderRadius: 6, border: '0.5px solid #E8E8E8',
                                          objectFit: 'cover', maxHeight: 120, cursor: 'pointer'
                                        }} />
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )})()}

                          {/* ── MODO PPT ── */}
                          {pres && pres !== 'cargando' && pres !== 'error' && modoPPT && slides.length > 0 && (
                            <div>
                              {/* Barra de progreso */}
                              <div style={{ height: 3, background: '#E8E8E8' }}>
                                <div style={{ height: 3, background: '#1E3A6E', width: `${((slideActual + 1) / slides.length) * 100}%`, transition: 'width 0.3s ease' }} />
                              </div>

                              {/* Slide */}
                              <div style={{ padding: editandoPPT ? '0' : '24px 28px' }}>
                                {editandoPPT ? (
                                  <SlideEditor
                                    slide={(pptEditData[presentacionActiva]?.diapositivas || slides)[slideActual]}
                                    imagenes={resultado?.imagenes_protocolo || []}
                                    onChange={newSlide => {
                                      setPptEditData(prev => {
                                        const base = prev[presentacionActiva] || JSON.parse(JSON.stringify(presentaciones[presentacionActiva]))
                                        const diapositivas = [...(base.diapositivas || slides)]
                                        diapositivas[slideActual] = newSlide
                                        return { ...prev, [presentacionActiva]: { ...base, diapositivas } }
                                      })
                                    }}
                                  />
                                ) : (
                                  <Slide slide={slides[slideActual]} total={slides.length} actual={slideActual} />
                                )}
                              </div>

                              {/* Navegación */}
                              <div style={{ padding: '0 28px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <button
                                  onClick={() => setSlideActual(s => Math.max(0, s - 1))}
                                  disabled={slideActual === 0}
                                  style={{
                                    height: 36, padding: '0 16px', borderRadius: 8, border: '1px solid #E8E8E8',
                                    background: slideActual === 0 ? '#F4F5F7' : '#fff', color: slideActual === 0 ? '#CCC' : '#333',
                                    fontSize: 12, cursor: slideActual === 0 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 6
                                  }}>
                                  ← Anterior
                                </button>

                                {/* Puntos indicadores */}
                                <div style={{ display: 'flex', gap: 6 }}>
                                  {slides.map((_, k) => (
                                    <div key={k} onClick={() => setSlideActual(k)} style={{
                                      width: k === slideActual ? 20 : 8, height: 8, borderRadius: 4,
                                      background: k === slideActual ? '#1E3A6E' : '#D0D5E0',
                                      cursor: 'pointer', transition: 'all 0.2s'
                                    }} />
                                  ))}
                                </div>

                                <button
                                  onClick={() => setSlideActual(s => Math.min(slides.length - 1, s + 1))}
                                  disabled={slideActual === slides.length - 1}
                                  style={{
                                    height: 36, padding: '0 16px', borderRadius: 8, border: 'none',
                                    background: slideActual === slides.length - 1 ? '#CCC' : '#1E3A6E',
                                    color: '#fff', fontSize: 12,
                                    cursor: slideActual === slides.length - 1 ? 'default' : 'pointer',
                                    display: 'flex', alignItems: 'center', gap: 6
                                  }}>
                                  Siguiente →
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── CABECERA RESULTADO ── */}
                  <div style={{ background: '#F4F5F7', borderRadius: 8, padding: '8px 12px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 12, color: '#555' }}>Fuente: <strong>{archivo?.name}</strong></div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span style={{ fontSize: 11, color: '#1E3A6E', fontWeight: 500 }}>{resultado.modulos?.length} módulos</span>
                      <span style={{ fontSize: 11, color: '#888' }}>•</span>
                      <span style={{ fontSize: 11, color: '#555' }}>{resultado.modulos?.reduce((acc, m) => acc + (m.preguntas?.length || 0), 0)} preguntas</span>
                    </div>
                  </div>

                  {/* ── AVISO DE MÓDULOS ── */}
                  {resultado.aviso && (
                    <div style={{
                      display: 'flex', gap: 10, alignItems: 'flex-start',
                      background: resultado.aviso.tipo === 'menos' ? '#FFF3F3' : '#FFF8E0',
                      border: `1px solid ${resultado.aviso.tipo === 'menos' ? '#F5C6C6' : '#E6C069'}`,
                      borderRadius: 8, padding: '10px 14px', marginBottom: 10
                    }}>
                      <span style={{ fontSize: 16, flexShrink: 0 }}>{resultado.aviso.tipo === 'menos' ? '⚠️' : '💡'}</span>
                      <span style={{ fontSize: 12, color: resultado.aviso.tipo === 'menos' ? '#C0392B' : '#7D6000', lineHeight: 1.5 }}>
                        {resultado.aviso.mensaje}
                      </span>
                    </div>
                  )}

                  {/* ── LISTA DE MÓDULOS ── */}
                  {resultado.modulos?.map((m, i) => (
                    <div key={i} style={{ border: '0.5px solid #E8E8E8', borderRadius: 10, marginBottom: 8, overflow: 'hidden' }}>
                      <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', background: moduloExpandido === i ? '#F0F4FF' : '#fff' }}
                        onClick={() => setModuloExpandido(moduloExpandido === i ? null : i)}>
                        <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#1E3A6E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff', flexShrink: 0 }}>{i + 1}</div>
                        <span style={{ fontSize: 12, fontWeight: 500, flex: 1 }}>{m.titulo}</span>
                        <button onClick={e => { e.stopPropagation(); abrirPresentacion(i) }} style={{
                          fontSize: 10, background: '#1E3A6E', color: '#fff', border: 'none',
                          borderRadius: 5, padding: '3px 8px', cursor: 'pointer', flexShrink: 0,
                          display: 'flex', alignItems: 'center', gap: 4
                        }}>▶ PPT</button>
                        <button onClick={e => { e.stopPropagation(); abrirContenido(i) }} style={{
                          fontSize: 10, background: '#7BC67A', color: '#fff', border: 'none',
                          borderRadius: 5, padding: '3px 8px', cursor: 'pointer', flexShrink: 0,
                          display: 'flex', alignItems: 'center', gap: 4
                        }}>📖 Contenido</button>
                        <span style={{ fontSize: 11, color: '#888', flexShrink: 0 }}>{m.preguntas?.length || 0} preg.</span>
                        <span className="format-tag tag-borrador" style={{ flexShrink: 0 }}>Módulo</span>
                        <span style={{ fontSize: 12, color: '#AAA', flexShrink: 0 }}>{moduloExpandido === i ? '▲' : '▼'}</span>
                      </div>

                      {moduloExpandido === i && (
                        <div style={{ borderTop: '0.5px solid #E8E8E8', padding: '10px 12px' }}>
                          <div style={{ fontSize: 11, color: '#666', lineHeight: 1.5, marginBottom: 10 }}>{m.descripcion}</div>
                          <div style={{ fontSize: 10, fontWeight: 600, color: '#1E3A6E', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                            Preguntas de evaluación ({m.preguntas?.length || 0})
                          </div>
                          {m.preguntas?.map((p, j) => (
                            <div key={j} style={{ marginBottom: 8, border: '0.5px solid #EEE', borderRadius: 7, overflow: 'hidden' }}>
                              <div style={{ display: 'flex', gap: 6, padding: '7px 10px', cursor: 'pointer', background: preguntasExpandidas[`${i}-${j}`] ? '#F7F8FF' : '#FAFAFA' }}
                                onClick={() => setPreguntasExpandidas(prev => ({ ...prev, [`${i}-${j}`]: !prev[`${i}-${j}`] }))}>
                                <span style={{ width: 16, height: 16, borderRadius: '50%', background: '#E8E8E8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#666', flexShrink: 0 }}>{j + 1}</span>
                                <span style={{ fontSize: 11, color: '#333', flex: 1 }}>{p.texto}</span>
                                <span style={{ fontSize: 10, color: '#AAA' }}>{preguntasExpandidas[`${i}-${j}`] ? '▲' : '▼'}</span>
                              </div>
                              {preguntasExpandidas[`${i}-${j}`] && (
                                <div style={{ padding: '6px 10px 8px 32px', background: '#F7F8FF', borderTop: '0.5px solid #EEE' }}>
                                  {p.alternativas?.map((alt, k) => (
                                    <div key={k} style={{ display: 'flex', gap: 6, fontSize: 11, padding: '3px 0', color: alt.correcta ? '#1A7A45' : '#555' }}>
                                      <span style={{ width: 14, height: 14, borderRadius: '50%', border: alt.correcta ? '2px solid #1A7A45' : '1.5px solid #CCC', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, flexShrink: 0, background: alt.correcta ? '#E8F5ED' : 'transparent' }}>
                                        {alt.correcta ? '✓' : ''}
                                      </span>
                                      {alt.texto}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Modo edición */}
                  {modoEdicion && borradorEdit && (
                    <div style={{ border: '1.5px solid #2B4BA0', borderRadius: 10, padding: 14, marginBottom: 12, background: '#F7F9FF' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#1E3A6E', marginBottom: 10 }}>Editando borrador</div>
                      <div className="field" style={{ marginBottom: 10 }}>
                        <label style={{ fontSize: 11 }}>Nombre del curso</label>
                        <input type="text" value={borradorEdit.nombre}
                          onChange={e => setBorradorEdit(prev => ({ ...prev, nombre: e.target.value }))}
                          style={{ fontSize: 12, padding: '6px 10px', borderRadius: 6, border: '1px solid #CCC', width: '100%' }} />
                      </div>
                      <div className="field" style={{ marginBottom: 10 }}>
                        <label style={{ fontSize: 11 }}>Descripción general del curso</label>
                        <textarea rows={3} value={borradorEdit.descripcion || ''}
                          onChange={e => setBorradorEdit(prev => ({ ...prev, descripcion: e.target.value }))}
                          style={{ fontSize: 12, padding: '6px 10px', borderRadius: 6, border: '1px solid #CCC', width: '100%', resize: 'none', color: '#555' }} />
                      </div>
                      {borradorEdit.modulos?.map((mod, i) => (
                        <div key={i} style={{ marginBottom: 8, background: '#fff', borderRadius: 8, padding: '10px 12px', border: '0.5px solid #E8E8E8' }}>
                          <div style={{ fontSize: 10, color: '#888', marginBottom: 4 }}>Módulo {i + 1}</div>
                          <input type="text" value={mod.titulo}
                            onChange={e => setBorradorEdit(prev => {
                              const mods = [...prev.modulos]; mods[i] = { ...mods[i], titulo: e.target.value }; return { ...prev, modulos: mods }
                            })}
                            style={{ fontSize: 12, fontWeight: 500, padding: '5px 8px', borderRadius: 6, border: '1px solid #CCC', width: '100%', marginBottom: 6 }} />
                          <textarea value={mod.descripcion} rows={2}
                            onChange={e => setBorradorEdit(prev => {
                              const mods = [...prev.modulos]; mods[i] = { ...mods[i], descripcion: e.target.value }; return { ...prev, modulos: mods }
                            })}
                            style={{ fontSize: 11, padding: '5px 8px', borderRadius: 6, border: '1px solid #CCC', width: '100%', resize: 'none', color: '#555' }} />
                          {mod.preguntas?.length > 0 && (
                            <div style={{ marginTop: 10 }}>
                              <div style={{ fontSize: 10, fontWeight: 600, color: '#1E3A6E', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                                Preguntas de evaluación
                              </div>
                              {mod.preguntas.map((preg, j) => (
                                <div key={j} style={{ marginBottom: 8, background: '#F0F4FF', borderRadius: 7, padding: '8px 10px' }}>
                                  <div style={{ fontSize: 10, color: '#888', marginBottom: 4 }}>Pregunta {j + 1}</div>
                                  <textarea rows={2} value={preg.texto}
                                    onChange={e => setBorradorEdit(prev => {
                                      const mods = [...prev.modulos]
                                      const pregs = [...(mods[i].preguntas || [])]
                                      pregs[j] = { ...pregs[j], texto: e.target.value }
                                      mods[i] = { ...mods[i], preguntas: pregs }
                                      return { ...prev, modulos: mods }
                                    })}
                                    style={{ fontSize: 11, padding: '5px 8px', borderRadius: 6, border: '1px solid #CCC', width: '100%', resize: 'none', marginBottom: 6 }} />
                                  <div style={{ fontSize: 10, color: '#888', marginBottom: 4 }}>Alternativas (● = correcta)</div>
                                  {preg.alternativas?.map((alt, k) => (
                                    <div key={k} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                                      <input type="radio" name={`correcta-${i}-${j}`} checked={!!alt.correcta}
                                        onChange={() => setBorradorEdit(prev => {
                                          const mods = [...prev.modulos]
                                          const pregs = [...(mods[i].preguntas || [])]
                                          const alts = pregs[j].alternativas.map((a, ki) => ({ ...a, correcta: ki === k }))
                                          pregs[j] = { ...pregs[j], alternativas: alts }
                                          mods[i] = { ...mods[i], preguntas: pregs }
                                          return { ...prev, modulos: mods }
                                        })} />
                                      <input type="text" value={alt.texto}
                                        onChange={e => setBorradorEdit(prev => {
                                          const mods = [...prev.modulos]
                                          const pregs = [...(mods[i].preguntas || [])]
                                          const alts = [...pregs[j].alternativas]
                                          alts[k] = { ...alts[k], texto: e.target.value }
                                          pregs[j] = { ...pregs[j], alternativas: alts }
                                          mods[i] = { ...mods[i], preguntas: pregs }
                                          return { ...prev, modulos: mods }
                                        })}
                                        style={{ flex: 1, fontSize: 11, padding: '4px 8px', borderRadius: 5, border: '1px solid #CCC' }} />
                                      {alt.correcta && <span style={{ fontSize: 10, color: '#1A7A45', fontWeight: 700 }}>✓</span>}
                                    </div>
                                  ))}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button onClick={guardarEdicion} disabled={guardando}
                          style={{ flex: 1, height: 36, background: '#1E3A6E', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                          {guardando ? 'Guardando...' : 'Guardar cambios'}
                        </button>
                        <button onClick={() => setModoEdicion(false)}
                          style={{ height: 36, padding: '0 16px', background: 'none', color: '#888', border: '0.5px solid #E8E8E8', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Botones de acción */}
                  {!modoEdicion && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <button
                        disabled={enviando || enviado}
                        style={{ flex: 1, height: 38, background: enviado ? '#4CAF50' : '#7BC67A', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: enviando || enviado ? 'default' : 'pointer' }}
                        onClick={async () => {
                          setEnviando(true)
                          try {
                            await api.post('/ia/notificar-profesor', {
                              curso_id: resultado.curso_id,
                              curso_nombre: resultado.nombre,
                              modulos_count: resultado.modulos?.length,
                              preguntas_count: resultado.preguntas_count,
                              nombre_archivo: resultado.nombre_archivo
                            })
                            setEnviado(true)
                            setTimeout(() => navigate('/jefatura'), 1500)
                          } catch {
                            alert('No se pudo enviar la notificación. Verifica la configuración de email.')
                          } finally { setEnviando(false) }
                        }}>
                        {enviando ? '⏳ Enviando...' : enviado ? '✓ Enviado' : 'Enviar al profesor'}
                      </button>
                      <button
                        style={{ flex: 1, height: 38, background: 'none', color: '#1E3A6E', border: '0.5px solid #1E3A6E', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}
                        onClick={() => { setBorradorEdit(JSON.parse(JSON.stringify(resultado))); setModoEdicion(true) }}>
                        Editar
                      </button>
                      <button
                        style={{ flex: 1, height: 38, background: 'none', color: '#E8505B', border: '0.5px solid #E8505B', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}
                        onClick={descartarBorrador}>
                        Descartar
                      </button>
                    </div>
                  )}

                  <p style={{ fontSize: 10, color: '#F5A623', textAlign: 'center', marginTop: 10 }}>
                    ⚠ El contenido no se publica sin validación del profesor
                  </p>
                </>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
