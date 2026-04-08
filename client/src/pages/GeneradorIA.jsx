import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Topbar from '../components/Topbar'
import Sidebar from '../components/Sidebar'
import api from '../services/api'

// ── buildSlides: usa diapositivas IA si existen, sino fallback legacy ──────────
function buildSlides(mod, pres) {
  // Nuevo formato: pres.diapositivas generadas por la IA
  if (Array.isArray(pres.diapositivas) && pres.diapositivas.length > 0) {
    return pres.diapositivas
  }
  // Fallback legacy (presentaciones antiguas sin diapositivas)
  const slides = []
  slides.push({ tipo: 'portada', titulo: mod.titulo, subtitulo: pres.objetivo || mod.descripcion })
  if (pres.puntos_clave?.length > 0)
    slides.push({ tipo: 'puntos', titulo: 'Puntos clave', items: pres.puntos_clave })
  if (pres.conceptos_importantes?.length > 0)
    slides.push({ tipo: 'conceptos', titulo: 'Conceptos importantes', items: pres.conceptos_importantes })
  if (pres.procedimientos?.length > 0)
    slides.push({ tipo: 'procedimientos', titulo: 'Procedimiento', items: pres.procedimientos })
  if (pres.advertencias?.length > 0)
    slides.push({ tipo: 'advertencias', titulo: 'Puntos críticos', items: pres.advertencias })
  if (pres.resumen || pres.cierre)
    slides.push({ tipo: 'cierre', titulo: 'Resumen', texto: pres.resumen || pres.cierre })
  return slides
}

// ── SlideEditor: edita el contenido de una diapositiva ───────────────────────
function SlideEditor({ slide, onChange }) {
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

      {slide.tipo === 'portada' && (<>
        <div><label style={lbl}>Título</label>
          <input style={fld} value={slide.titulo || ''} onChange={e => upd('titulo', e.target.value)} /></div>
        <div><label style={lbl}>Subtítulo</label>
          <textarea style={ta} rows={2} value={slide.subtitulo || ''} onChange={e => upd('subtitulo', e.target.value)} /></div>
      </>)}

      {slide.tipo === 'definicion' && (<>
        <div><label style={lbl}>Concepto</label>
          <input style={fld} value={slide.concepto || ''} onChange={e => upd('concepto', e.target.value)} /></div>
        <div><label style={lbl}>Definición completa</label>
          <textarea style={ta} rows={3} value={slide.definicion_completa || ''} onChange={e => upd('definicion_completa', e.target.value)} /></div>
        <div><label style={lbl}>Ejemplo real</label>
          <textarea style={ta} rows={2} value={slide.ejemplo_real || ''} onChange={e => upd('ejemplo_real', e.target.value)} /></div>
      </>)}

      {slide.tipo === 'caso' && (<>
        <div><label style={lbl}>Título</label>
          <input style={fld} value={slide.titulo || ''} onChange={e => upd('titulo', e.target.value)} /></div>
        <div><label style={lbl}>Situación</label>
          <textarea style={ta} rows={3} value={slide.situacion || ''} onChange={e => upd('situacion', e.target.value)} /></div>
        <div><label style={lbl}>¿Cómo actuar? (un paso por campo)</label>
          {(slide.como_actuar || []).map((paso, k) => (
            <input key={k} style={{ ...fld, marginBottom: 4 }} value={paso} onChange={e => updArr('como_actuar', k, e.target.value)} />
          ))}</div>
      </>)}

      {slide.tipo === 'importante' && (<>
        <div><label style={lbl}>Título</label>
          <input style={fld} value={slide.titulo || ''} onChange={e => upd('titulo', e.target.value)} /></div>
        <div><label style={lbl}>Puntos importantes</label>
          {(slide.puntos || []).map((punto, k) => (
            <input key={k} style={{ ...fld, marginBottom: 4 }} value={punto} onChange={e => updArr('puntos', k, e.target.value)} />
          ))}</div>
      </>)}

      {slide.tipo === 'reflexion' && (<>
        <div><label style={lbl}>Pregunta de reflexión</label>
          <textarea style={ta} rows={3} value={slide.pregunta || ''} onChange={e => upd('pregunta', e.target.value)} /></div>
        <div><label style={lbl}>Pista</label>
          <textarea style={ta} rows={2} value={slide.pista || ''} onChange={e => upd('pista', e.target.value)} /></div>
      </>)}

      {!['portada', 'definicion', 'caso', 'importante', 'reflexion'].includes(slide.tipo) && (
        <div style={{ fontSize: 12, color: '#888', textAlign: 'center', padding: '2rem 0' }}>
          El tipo "{slide.tipo}" no tiene campos editables en esta vista.
        </div>
      )}
    </div>
  )
}

// ── Slide: renderiza cada tipo de diapositiva ─────────────────────────────────
export function Slide({ slide, total, actual }) {
  // Paleta basada en el diseño institucional de la ONG (tema "Crop")
  // Colores: crema #EFEDE3 · oscuro #191B0E · naranja #F26B43 · dorado #E6C069 · verde salvia #8DAB8E · azul acero #77A2BB
  const paletas = {
    portada:        { bg: '#191B0E', color: '#EFEDE3', accent: '#F26B43' },
    puntos:         { bg: '#EFEDE3', color: '#191B0E', accent: '#F26B43' },
    conceptos:      { bg: '#fff',    color: '#191B0E', accent: '#897B61' },
    procedimientos: { bg: '#EFEDE3', color: '#191B0E', accent: '#8DAB8E' },
    advertencias:   { bg: '#FFF8E0', color: '#191B0E', accent: '#E6C069' },
    cierre:         { bg: '#F26B43', color: '#fff',    accent: 'rgba(255,255,255,0.2)' },
    // nuevos
    definicion:     { bg: '#fff',    color: '#191B0E', accent: '#F26B43' },
    caso:           { bg: '#EFEDE3', color: '#191B0E', accent: '#8DAB8E' },
    importante:     { bg: '#191B0E', color: '#EFEDE3', accent: '#E6C069' },
    reflexion:      { bg: '#F26B43', color: '#fff',    accent: 'rgba(255,255,255,0.18)' },
  }
  const p = paletas[slide.tipo] || paletas.puntos

  return (
    <div style={{
      background: p.bg, borderRadius: 12, padding: '36px 40px',
      minHeight: 340, display: 'flex', flexDirection: 'column', justifyContent: 'center',
      position: 'relative', overflow: 'hidden'
    }}>
      <div style={{ position: 'absolute', right: -40, top: -40, width: 180, height: 180, borderRadius: '50%', background: p.accent, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', left: -30, bottom: -30, width: 120, height: 120, borderRadius: '50%', background: p.accent, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: 14, right: 18, fontSize: 11, color: p.color, opacity: 0.45 }}>{actual + 1} / {total}</div>

      {/* ── PORTADA ── */}
      {slide.tipo === 'portada' && (
        <div style={{ textAlign: 'center', position: 'relative' }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>Módulo</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#fff', lineHeight: 1.3, marginBottom: 16 }}>{slide.titulo}</div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', lineHeight: 1.6, maxWidth: 480, margin: '0 auto' }}>{slide.subtitulo}</div>
        </div>
      )}

      {/* ── DEFINICION ── */}
      {slide.tipo === 'definicion' && (
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: p.accent, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Definición</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: p.accent, marginBottom: 14 }}>{slide.concepto}</div>
          <div style={{ fontSize: 14, color: '#333', lineHeight: 1.7, marginBottom: 16, borderLeft: `4px solid ${p.accent}`, paddingLeft: 14 }}>
            {slide.definicion_completa}
          </div>
          {slide.ejemplo_real && (
            <div style={{ background: '#F0F4FF', borderRadius: 8, padding: '12px 16px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: p.accent, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>En la práctica</div>
              <div style={{ fontSize: 13, color: '#333', lineHeight: 1.6 }}>{slide.ejemplo_real}</div>
            </div>
          )}
        </div>
      )}

      {/* ── CASO PRÁCTICO ── */}
      {slide.tipo === 'caso' && (
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: p.accent, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Caso práctico</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: p.color, marginBottom: 12 }}>{slide.titulo}</div>
          <div style={{ fontSize: 13, color: p.color, lineHeight: 1.6, background: 'rgba(26,122,69,0.08)', borderRadius: 8, padding: '10px 14px', marginBottom: 14 }}>
            {slide.situacion}
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, color: p.accent, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>¿Cómo actuar?</div>
          {slide.como_actuar?.map((paso, k) => (
            <div key={k} style={{ display: 'flex', gap: 10, fontSize: 13, color: p.color, marginBottom: 6 }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: p.accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{k + 1}</div>
              {paso}
            </div>
          ))}
        </div>
      )}

      {/* ── IMPORTANTE ── */}
      {slide.tipo === 'importante' && (
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: p.accent, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Importante</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: p.color, marginBottom: 18 }}>{slide.titulo}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {slide.puntos?.map((punto, k) => (
              <div key={k} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: p.accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>✓</div>
                <div style={{ fontSize: 14, color: p.color, lineHeight: 1.5, paddingTop: 4 }}>{punto}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── REFLEXIÓN ── */}
      {slide.tipo === 'reflexion' && (
        <div style={{ textAlign: 'center', position: 'relative' }}>
          <div style={{ fontSize: 36, marginBottom: 16 }}>💭</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>Reflexiona</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#fff', lineHeight: 1.5, marginBottom: 20, maxWidth: 480, margin: '0 auto 20px' }}>{slide.pregunta}</div>
          {slide.pista && (
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontStyle: 'italic', lineHeight: 1.6, maxWidth: 420, margin: '0 auto' }}>
              Pista: {slide.pista}
            </div>
          )}
        </div>
      )}

      {/* ── LEGACY: puntos, conceptos, procedimientos, advertencias, cierre ── */}
      {slide.tipo === 'puntos' && (
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: p.accent, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 18 }}>{slide.titulo}</div>
          {slide.items?.map((item, k) => (
            <div key={k} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 10 }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: p.accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{k + 1}</div>
              <div style={{ fontSize: 14, color: p.color, lineHeight: 1.5, paddingTop: 4 }}>{item}</div>
            </div>
          ))}
        </div>
      )}
      {slide.tipo === 'conceptos' && (
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: p.accent, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 18 }}>{slide.titulo}</div>
          {slide.items?.map((c, k) => (
            <div key={k} style={{ borderLeft: `4px solid ${p.accent}`, paddingLeft: 14, marginBottom: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: p.accent, marginBottom: 4 }}>{c.termino}</div>
              <div style={{ fontSize: 13, color: '#555', lineHeight: 1.5 }}>{c.definicion}</div>
            </div>
          ))}
        </div>
      )}
      {slide.tipo === 'procedimientos' && (
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: p.accent, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 18 }}>{slide.titulo}</div>
          {slide.items?.map((paso, k) => (
            <div key={k} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: p.accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{k + 1}</div>
              <div style={{ fontSize: 13, color: p.color, lineHeight: 1.6, paddingTop: 5 }}>{paso}</div>
            </div>
          ))}
        </div>
      )}
      {slide.tipo === 'advertencias' && (
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: p.accent, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>⚠</span> {slide.titulo}
          </div>
          {slide.items?.map((adv, k) => (
            <div key={k} style={{ display: 'flex', gap: 10, fontSize: 13, color: p.color, background: 'rgba(245,166,35,0.12)', borderRadius: 8, padding: '10px 12px', marginBottom: 6 }}>
              <span style={{ flexShrink: 0, fontWeight: 700 }}>•</span> {adv}
            </div>
          ))}
        </div>
      )}
      {slide.tipo === 'cierre' && (
        <div style={{ textAlign: 'center', position: 'relative' }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>✓</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 16 }}>{slide.titulo}</div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 1.7, maxWidth: 480, margin: '0 auto' }}>{slide.texto}</div>
        </div>
      )}
    </div>
  )
}

// ── Componente principal ───────────────────────────────────────────────────────
export default function GeneradorIA() {
  const navigate = useNavigate()
  const [archivo, setArchivo] = useState(null)
  const [form, setForm] = useState({ nombre_curso: '', area: '', contexto: '' })
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

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!archivo || !form.nombre_curso) return setError('El PDF y el nombre del curso son obligatorios')
    setCargando(true); setError('')
    try {
      const data = new FormData()
      data.append('protocolo', archivo)
      data.append('nombre_curso', form.nombre_curso)
      data.append('area', form.area)
      data.append('contexto', form.contexto)
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
  const slides = (activePres && activePres !== 'cargando' && activePres !== 'error' && mod)
    ? buildSlides(mod, activePres) : []

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
                <div className="upload-zone" style={{ marginBottom: 16 }} onClick={() => document.getElementById('input-pdf').click()}>
                  <input id="input-pdf" type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => setArchivo(e.target.files[0])} />
                  {archivo ? (
                    <>
                      <div style={{ fontSize: 20, marginBottom: 4 }}>✓</div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: '#1A7A45' }}>{archivo.name}</div>
                      <span className="format-tag tag-pdf" style={{ marginTop: 6, display: 'inline-block' }}>PDF</span>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Arrastra o selecciona un PDF</div>
                      <div style={{ fontSize: 11, color: '#888' }}>Protocolo institucional en formato PDF</div>
                    </>
                  )}
                </div>
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
                            <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>Módulo {presentacionActiva + 1} de {resultado.modulos.length}</div>
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

                          {/* ── MODO RESUMEN ── */}
                          {pres && pres !== 'cargando' && pres !== 'error' && !modoPPT && (() => {
                            // nuevo formato: pres.resumen es objeto; legacy: pres tiene los campos directamente
                            const r = pres.resumen && typeof pres.resumen === 'object' ? pres.resumen : pres
                            return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '60vh', overflowY: 'auto' }}>
                              {r.objetivo && (
                                <div style={{ background: '#EFEDE3', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#191B0E', lineHeight: 1.6, borderLeft: '4px solid #F26B43' }}>
                                  <strong>Objetivo:</strong> {r.objetivo}
                                </div>
                              )}
                              {r.puntos_clave?.length > 0 && (
                                <div>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: '#F26B43', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Puntos clave</div>
                                  {r.puntos_clave.map((pt, k) => (
                                    <div key={k} style={{ display: 'flex', gap: 8, fontSize: 12, color: '#191B0E', background: '#EFEDE3', borderRadius: 6, padding: '7px 10px', marginBottom: 5 }}>
                                      <span style={{ color: '#F26B43', fontWeight: 700 }}>→</span> {pt}
                                    </div>
                                  ))}
                                </div>
                              )}
                              {r.conceptos_importantes?.length > 0 && (
                                <div>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: '#F26B43', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Conceptos importantes</div>
                                  {r.conceptos_importantes.map((c, k) => (
                                    <div key={k} style={{ fontSize: 12, borderLeft: '3px solid #897B61', paddingLeft: 10, paddingTop: 3, paddingBottom: 3, marginBottom: 6 }}>
                                      <strong style={{ color: '#191B0E' }}>{c.termino}:</strong> <span style={{ color: '#555' }}>{c.definicion}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {r.procedimientos?.length > 0 && (
                                <div>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: '#F26B43', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Procedimiento</div>
                                  {r.procedimientos.map((paso, k) => (
                                    <div key={k} style={{ display: 'flex', gap: 8, fontSize: 12, color: '#191B0E', marginBottom: 6 }}>
                                      <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#8DAB8E', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{k + 1}</span>
                                      {paso}
                                    </div>
                                  ))}
                                </div>
                              )}
                              {r.advertencias?.length > 0 && (
                                <div style={{ background: '#FFF8E0', borderRadius: 8, padding: '10px 14px', border: '0.5px solid #E6C069' }}>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: '#897B61', marginBottom: 6 }}>⚠ Puntos críticos</div>
                                  {r.advertencias.map((adv, k) => (
                                    <div key={k} style={{ fontSize: 12, color: '#191B0E', padding: '2px 0' }}>• {adv}</div>
                                  ))}
                                </div>
                              )}
                              {(r.cierre || r.resumen) && typeof (r.cierre || r.resumen) === 'string' && (
                                <div style={{ background: '#F26B43', borderRadius: 8, padding: '10px 14px' }}>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.8)', marginBottom: 4 }}>Cierre</div>
                                  <div style={{ fontSize: 12, color: '#fff', lineHeight: 1.6 }}>{r.cierre || r.resumen}</div>
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
                        }}>
                          ▶ PPT
                        </button>
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
