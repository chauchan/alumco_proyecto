import { useState, useRef, useEffect } from 'react'
import { Icon } from '@iconify/react'
import { useNavigate } from 'react-router-dom'
import Topbar from '../components/Topbar'
import Sidebar from '../components/Sidebar'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'

// ── buildSlides: usa diapositivas IA si existen ──────────────────────────────
function buildSlides(mod, pres) {
  if (Array.isArray(pres.diapositivas) && pres.diapositivas.length > 0) {
    return pres.diapositivas
  }
  return []
}

// ── SlideEditor: edita el contenido de una diapositiva ───────────────────────
export function SlideEditor({ slide, onChange, imagenes = [] }) {
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

      {slide.tipo === 'seccion' && (<>
        <div><label style={lbl}>Título</label>
          <input style={fld} value={slide.titulo || ''} onChange={e => upd('titulo', e.target.value)} /></div>
        <div><label style={lbl}>Texto explicativo</label>
          <textarea style={ta} rows={4} value={slide.texto || ''} onChange={e => upd('texto', e.target.value)} /></div>
        <div><label style={lbl}>Puntos prácticos (uno por campo)</label>
          {(slide.puntos || []).map((p, k) => (
            <input key={k} style={{ ...fld, marginBottom: 4 }} value={p} onChange={e => updArr('puntos', k, e.target.value)} />
          ))}</div>
      </>)}

      {slide.tipo === 'caso_practico' && (<>
        <div><label style={lbl}>Título</label>
          <input style={fld} value={slide.titulo || ''} onChange={e => upd('titulo', e.target.value)} /></div>
        <div><label style={lbl}>Descripción de la situación</label>
          <textarea style={ta} rows={3} value={slide.descripcion || ''} onChange={e => upd('descripcion', e.target.value)} /></div>
        <div><label style={lbl}>Pasos para actuar (uno por campo)</label>
          {(slide.pasos || []).map((p, k) => (
            <input key={k} style={{ ...fld, marginBottom: 4 }} value={p} onChange={e => updArr('pasos', k, e.target.value)} />
          ))}</div>
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

      {!['objetivos', 'desempeno', 'introduccion', 'seccion', 'caso_practico', 'puntos_clave', 'importante', 'conclusion'].includes(slide.tipo) && (
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
              }}><Icon icon="lucide:x" width={18} /></button>
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
    objetivos:    { bg: '#191B0E', color: '#EFEDE3', accent: '#F26B43' },
    desempeno:    { bg: '#EFEDE3', color: '#191B0E', accent: '#F26B43' },
    introduccion: { bg: '#fff',    color: '#191B0E', accent: '#897B61' },
    seccion:      { bg: '#fff',    color: '#191B0E', accent: '#1E3A6E' },
    caso_practico:{ bg: '#EFEDE3', color: '#191B0E', accent: '#8DAB8E' },
    puntos_clave: { bg: '#EFEDE3', color: '#191B0E', accent: '#8DAB8E' },
    importante:   { bg: '#191B0E', color: '#EFEDE3', accent: '#E6C069' },
    conclusion:   { bg: '#F26B43', color: '#fff',    accent: 'rgba(255,255,255,0.2)' },
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

      {/* ── SECCIÓN DE CONTENIDO ── */}
      {slide.tipo === 'seccion' && (
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: p.accent, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>Contenido</div>
          <div style={{ fontSize: 17, fontWeight: 600, color: p.color, marginBottom: 14 }}>{slide.titulo}</div>
          <div style={{ fontSize: 13, color: '#444', lineHeight: 1.8, marginBottom: 16, borderLeft: `4px solid ${p.accent}`, paddingLeft: 14 }}>{slide.texto}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {slide.puntos?.map((punto, k) => (
              <div key={k} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: p.accent, flexShrink: 0, marginTop: 5 }} />
                <div style={{ fontSize: 13, color: p.color, lineHeight: 1.5 }}>{punto}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── CASO PRÁCTICO ── */}
      {slide.tipo === 'caso_practico' && (
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: p.accent, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>Caso práctico</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: p.color, marginBottom: 12 }}>{slide.titulo}</div>
          <div style={{ fontSize: 13, color: p.color, lineHeight: 1.6, background: 'rgba(141,171,142,0.12)', borderRadius: 8, padding: '10px 14px', marginBottom: 14 }}>{slide.descripcion}</div>
          <div style={{ fontSize: 10, fontWeight: 700, color: p.accent, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>¿Cómo actuar?</div>
          {slide.pasos?.map((paso, k) => (
            <div key={k} style={{ display: 'flex', gap: 10, fontSize: 13, color: p.color, marginBottom: 6 }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: p.accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{k + 1}</div>
              {paso}
            </div>
          ))}
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

// ── Carga/guarda resultado en sessionStorage para sobrevivir navegación ────────
const STORAGE_KEY = 'generadorIA_resultado'
const FORM_KEY    = 'generadorIA_form'

function leerStorage() {
  try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY)) } catch { return null }
}
function guardarStorage(data) {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data)) } catch {}
}
function leerFormStorage() {
  try { return JSON.parse(sessionStorage.getItem(FORM_KEY)) } catch { return null }
}
function guardarFormStorage(data) {
  try { sessionStorage.setItem(FORM_KEY, JSON.stringify(data)) } catch {}
}

// ── Componente principal ───────────────────────────────────────────────────────
export default function GeneradorIA() {
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const [archivo, setArchivo] = useState(null)
  const [form, setForm] = useState(() => {
    const s = leerFormStorage()
    return s ? { ...s, profesor_id: s.profesor_id || '' } : { nombre_curso: '', area: '', contexto: '', num_modulos: '', profesor_id: '' }
  })
  const [profesores, setProfesores] = useState([])
  const [fuentePDF, setFuentePDF] = useState('subir')   // 'subir' | 'biblioteca'
  const [protocolos, setProtocolos] = useState([])
  const [protocoloSeleccionado, setProtocoloSeleccionado] = useState(null)
  const [resultado, setResultado] = useState(() => leerStorage())
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const abortRef = useRef(null)   // controla la petición en curso

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

    const mod = resultado.modulos[i]

    // Usar presentacion ya generada (campo del servidor o contenido_presentacion del BD)
    const fuente = mod.presentacion || mod.contenido_presentacion
    if (fuente) {
      let cp = typeof fuente === 'string' ? (() => { try { return JSON.parse(fuente) } catch { return null } })() : fuente
      if (cp) {
        const diapositivas = Array.isArray(cp) ? cp : Array.isArray(cp.diapositivas) ? cp.diapositivas : []
        if (diapositivas.length > 0) {
          setPresentaciones(prev => ({ ...prev, [i]: { diapositivas } }))
          return
        }
      }
    }

    // Generar con IA si no hay contenido guardado
    setPresentaciones(prev => ({ ...prev, [i]: 'cargando' }))
    try {
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

  const cerrarModal = () => {
    // Auto-guardar si hay ediciones pendientes sin guardar
    if (editandoPPT && pptEditData[presentacionActiva]) {
      const editedPres = pptEditData[presentacionActiva]
      const mod = resultado?.modulos?.[presentacionActiva]
      if (mod?.id && resultado?.curso_id) {
        api.put(`/cursos/${resultado.curso_id}`, {
          modulos: [{ id: mod.id, titulo: mod.titulo, descripcion: mod.descripcion, contenido_presentacion: editedPres }]
        }).catch(() => {})
        setPresentaciones(prev => ({ ...prev, [presentacionActiva]: editedPres }))
        setResultado(prev => {
          if (!prev?.modulos) return prev
          const modulos = [...prev.modulos]
          modulos[presentacionActiva] = { ...modulos[presentacionActiva], contenido_presentacion: editedPres }
          return { ...prev, modulos }
        })
      }
    }
    setPresentacionActiva(null); setModoPPT(false); setSlideActual(0); setEditandoPPT(false)
  }


  // Persistir resultado en sessionStorage cuando cambia
  useEffect(() => { guardarStorage(resultado) }, [resultado])

  // Sincronizar con el servidor: obtener IDs de módulos y URLs firmadas de imágenes
  useEffect(() => {
    if (!resultado?.curso_id) return
    api.get(`/cursos/${resultado.curso_id}`).then(r => {
      const apiModulos = r.data.modulos || []
      const allHaveId = resultado.modulos?.every(m => m.id)
      const modulos = allHaveId
        ? resultado.modulos
        : resultado.modulos.map(m => {
            if (m.id) return m
            const found = apiModulos.find(am => am.titulo === m.titulo)
            return { ...m, id: found?.id }
          })
      const updates = { modulos }
      if (r.data.imagenes_protocolo?.length > 0) {
        updates.imagenes_protocolo = r.data.imagenes_protocolo
      }
      setResultado(prev => ({ ...prev, ...updates }))
    }).catch(() => {})
  }, [resultado?.curso_id])
  // Persistir form cuando cambia
  useEffect(() => { guardarFormStorage(form) }, [form])

  // Cargar biblioteca de protocolos y lista de profesores al montar
  useEffect(() => {
    api.get('/protocolos').then(r => setProtocolos(r.data)).catch(() => {})
    api.get('/usuarios')
      .then(r => setProfesores(r.data.filter(u => u.rol === 'profesor' && u.activo)))
      .catch(() => {})
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (fuentePDF === 'subir' && !archivo) return setError('Selecciona un archivo PDF')
    if (fuentePDF === 'biblioteca' && !protocoloSeleccionado) return setError('Selecciona un protocolo de la biblioteca')
    if (!form.nombre_curso) return setError('El nombre del curso es obligatorio')

    // Cancelar cualquier petición previa en curso
    if (abortRef.current) abortRef.current.abort()
    abortRef.current = new AbortController()

    // Limpiar resultado anterior para evitar stacking visual
    setResultado(null)
    guardarStorage(null)
    setModoEdicion(false)
    setEnviado(false)
    setPresentaciones({})
    setCargando(true)
    setError('')

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
      if (form.profesor_id) data.append('profesor_id', form.profesor_id)
      if (usuario?.sede_id) data.append('sede_objetivo', usuario.sede_id)
      const res = await api.post('/ia/generar-curso', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
        signal: abortRef.current.signal
      })
      setResultado(res.data)
      // Pre-cargar presentaciones desde la respuesta (ya generadas en el servidor)
      const presMap = {}
      ;(res.data.modulos || []).forEach((mod, i) => {
        const pres = mod.presentacion || mod.contenido_presentacion
        if (!pres) return
        const diapositivas = Array.isArray(pres) ? pres : pres?.diapositivas || []
        if (diapositivas.length > 0) presMap[i] = { diapositivas }
      })
      if (Object.keys(presMap).length > 0) setPresentaciones(presMap)
    } catch (err) {
      if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return // cancelado intencionalmente
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
      guardarStorage(null)
      setPresentaciones({})
      setModoEdicion(false)
      setEnviado(false)
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

          {/* ── BANNER DE AVISO ── */}
          {resultado && form.num_modulos && (() => {
            const pedidos  = parseInt(form.num_modulos)
            const optimo   = resultado.modulosOptimo
            const generados = resultado.modulos?.length

            let tipo, titulo, mensaje
            if (pedidos > optimo) {
              tipo = 'menos'
              titulo = 'Módulos solicitados superan el contenido'
              mensaje = `Pediste ${pedidos} módulos pero el protocolo tiene información para ${optimo} como máximo. Algunos módulos pueden quedar con contenido escaso o repetido.`
            } else if (pedidos < optimo - 1) {
              tipo = 'mas'
              titulo = 'Puedes aprovechar más el contenido'
              mensaje = `El protocolo tiene información suficiente para hasta ${optimo} módulos. Genera nuevamente con ese número para cubrir mejor el material.`
            } else {
              tipo = 'ok'
              titulo = 'Número de módulos adecuado'
              mensaje = `El protocolo tiene contenido para ${optimo} módulos y generaste ${generados}. Buena elección.`
            }

            const colores = {
              menos: { bg: '#FFF3F3', border: '#F5C6C6', text: '#C0392B' },
              mas:   { bg: '#FFFBEA', border: '#E6C069', text: '#7D6000' },
              ok:    { bg: '#F0FBF4', border: '#A8D8B0', text: '#1A7A45' },
            }
            const c = colores[tipo]
            const icono = tipo === 'menos' ? <Icon icon="lucide:alert-triangle" width={20} style={{color:'#B45309',flexShrink:0}} /> : tipo === 'mas' ? <Icon icon="lucide:lightbulb" width={20} style={{color:'#B45309',flexShrink:0}} /> : <Icon icon="lucide:check-circle" width={20} style={{color:'#1A7A45',flexShrink:0}} />

            return (
              <div style={{
                display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 18px',
                borderRadius: 10, border: `1.5px solid ${c.border}`, background: c.bg,
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
              }}>
                <span style={{ flexShrink: 0, lineHeight: 1 }}>{icono}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: c.text, marginBottom: 2 }}>{titulo}</div>
                  <div style={{ fontSize: 12, color: c.text, lineHeight: 1.55 }}>{mensaje}</div>
                </div>
              </div>
            )
          })()}

          <div className="two-col">
            {/* Formulario */}
            <div className="card">
              <div className="card-title" style={{ marginBottom: 16 }}>Subir protocolo</div>
              <form onSubmit={handleSubmit}>
                {/* Toggle fuente PDF */}
                <div style={{ display: 'flex', background: '#F0F2F5', borderRadius: 8, padding: 3, gap: 2, marginBottom: 14 }}>
                  {[['subir', <><Icon icon="lucide:upload" width={12} style={{verticalAlign:'middle',marginRight:3}} /> Subir PDF</>],['biblioteca', <><Icon icon="lucide:folder-open" width={12} style={{verticalAlign:'middle',marginRight:3}} /> Desde biblioteca</>]].map(([val, lbl]) => (
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
                      <><Icon icon="lucide:check" width={20} style={{margin:"0 auto 4px",display:"block",color:"#1A7A45"}} />
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
                        No hay protocolos guardados. <a href="/jefatura/protocolos" style={{ color: '#1E3A6E' }}>Ir a la biblioteca <Icon icon="lucide:arrow-right" width={12} style={{verticalAlign:"middle",marginLeft:3}} /></a>
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
                            <Icon icon="lucide:file-text" width={16} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 500, color: '#222' }}>{p.nombre}</div>
                              {p.descripcion && <div style={{ fontSize: 10, color: '#888' }}>{p.descripcion}</div>}
                            </div>
                            {protocoloSeleccionado?.id === p.id && <Icon icon="lucide:check" color="#1E3A6E" width={14} />}
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
                  <label>Profesor responsable</label>
                  <select value={form.profesor_id} onChange={e => setForm({ ...form, profesor_id: e.target.value })}>
                    <option value="">Asignar automáticamente</option>
                    {profesores.map(p => (
                      <option key={p.id} value={p.id}>{p.nombre}{p.sede_nombre ? ` — ${p.sede_nombre}` : ''}</option>
                    ))}
                  </select>
                  {!form.profesor_id && (
                    <span style={{ fontSize: 11, color: '#888', marginTop: 4, display: 'block' }}>
                      Si no elegís, lo asignaremos automáticamente según sede y estamento
                    </span>
                  )}
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
                  {cargando ? <><Icon icon="lucide:loader-circle" width={13} style={{verticalAlign:'middle',marginRight:4}} /> Generando...</> : <><Icon icon="lucide:sparkles" width={13} style={{verticalAlign:'middle',marginRight:4}} /> Generar curso con IA</>}
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
                  <Icon icon="lucide:loader-circle" width={32} style={{margin:"0 auto 12px",display:"block",color:"#888"}} />
                  <div style={{ fontSize: 13 }}>Analizando el protocolo...</div>
                  <div style={{ fontSize: 11, marginTop: 6 }}>Esto puede tomar 30–60 segundos</div>
                </div>
              )}

              {!resultado && !cargando && (
                <div style={{ display: 'flex',flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '3rem 0', color: '#CCC' }}>
                  <Icon icon="lucide:bot" width={40} style={{marginBottom:12,display:"block",color:"#888"}} />
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
                              , display:'flex', alignItems:'center', gap:4 }}><Icon icon="lucide:play" width={11} /> Presentación</button>
                            </div>
                          )}
                          {modoPPT && pres && pres !== 'cargando' && pres !== 'error' && (
                            <button
                              onClick={() => {
                                if (!editandoPPT) {
                                  // Entrando a modo edición: copiar estado actual
                                  setPptEditData(prev => ({
                                    ...prev,
                                    [presentacionActiva]: JSON.parse(JSON.stringify(presentaciones[presentacionActiva]))
                                  }))
                                } else if (pptEditData[presentacionActiva]) {
                                  // Saliendo de edición: guardar inmediatamente en DB y en memoria
                                  const editedPres = pptEditData[presentacionActiva]
                                  const mod = resultado?.modulos?.[presentacionActiva]
                                  if (mod?.id && resultado?.curso_id) {
                                    api.put(`/cursos/${resultado.curso_id}`, {
                                      modulos: [{ id: mod.id, titulo: mod.titulo, descripcion: mod.descripcion, contenido_presentacion: editedPres }]
                                    }).catch(() => {})
                                  }
                                  setPresentaciones(prev => ({ ...prev, [presentacionActiva]: editedPres }))
                                  // También actualizar resultado.modulos para que session storage persista la imagen
                                  setResultado(prev => {
                                    if (!prev?.modulos) return prev
                                    const modulos = [...prev.modulos]
                                    modulos[presentacionActiva] = { ...modulos[presentacionActiva], contenido_presentacion: editedPres }
                                    return { ...prev, modulos }
                                  })
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
                              {editandoPPT ? <><Icon icon="lucide:arrow-left" width={13} style={{verticalAlign:'middle',marginRight:4}} /> Vista previa</> : <><Icon icon="lucide:pencil" width={13} style={{verticalAlign:'middle',marginRight:3}} /> Editar slides</>}
                            </button>
                          )}
                          <button onClick={cerrarModal} style={{ background: 'none', border: 'none', fontSize: 18, color: '#AAA', cursor: 'pointer', display:'flex', alignItems:'center' }}><Icon icon="lucide:x" width={18} /></button>
                        </div>

                        {/* Cuerpo modal */}
                        <div style={{ padding: modoPPT ? '0' : '20px 24px' }}>

                          {/* Estado cargando */}
                          {(!pres || pres === 'cargando') && (
                            <div style={{ textAlign: 'center', padding: '3rem 0', color: '#888' }}>
                              <Icon icon="lucide:loader-circle" width={28} style={{margin:"0 auto 10px",display:"block",color:"#888"}} />
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
                            const secciones   = diaps.filter(d => d.tipo === 'seccion')
                            const caso        = diaps.find(d => d.tipo === 'caso_practico')
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
                              {secciones.length > 0 && (
                                <div>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: '#1E3A6E', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Contenido</div>
                                  {secciones.map((sec, k) => (
                                    <div key={k} style={{ marginBottom: 10 }}>
                                      <div style={{ fontSize: 12, fontWeight: 600, color: '#1E3A6E', marginBottom: 4, display: 'flex', gap: 6, alignItems: 'center' }}>
                                        <span style={{ width: 18, height: 18, borderRadius: '50%', background: '#1E3A6E', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, flexShrink: 0 }}>{k+1}</span>
                                        {sec.titulo}
                                      </div>
                                      <div style={{ fontSize: 12, color: '#555', lineHeight: 1.6, paddingLeft: 24 }}>{sec.texto}</div>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {caso && (
                                <div style={{ background: '#F0F4FF', borderRadius: 8, padding: '10px 14px' }}>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: '#1E3A6E', marginBottom: 6 }}>Caso práctico</div>
                                  <div style={{ fontSize: 12, color: '#333', lineHeight: 1.6, marginBottom: 8 }}>{caso.descripcion}</div>
                                  {caso.pasos?.map((p, k) => (
                                    <div key={k} style={{ display: 'flex', gap: 8, fontSize: 12, color: '#333', marginBottom: 4 }}>
                                      <span style={{ width: 18, height: 18, borderRadius: '50%', background: '#8DAB8E', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, flexShrink: 0 }}>{k+1}</span>
                                      {p}
                                    </div>
                                  ))}
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
                                  <><Icon icon="lucide:arrow-left" width={13} style={{verticalAlign:"middle",marginRight:4}} /> Anterior</>
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
                                  <>Siguiente <Icon icon="lucide:arrow-right" width={13} style={{verticalAlign:"middle",marginLeft:4}} /></>
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
                        }}><Icon icon="lucide:play" width={11} /> PPT</button>
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
                                        {alt.correcta ? <Icon icon="lucide:check" color="#1A7A45" width={9} /> : null}
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
                                      {alt.correcta && <span style={{ fontSize: 10, color: '#1A7A45', fontWeight: 700, display:'flex', alignItems:'center' }}><Icon icon="lucide:check" width={10} /></span>}
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
                            // Guardar cualquier PPT editado pendiente antes de enviar
                            if (Object.keys(pptEditData).length > 0 && resultado?.curso_id) {
                              const modulosToSave = Object.entries(pptEditData)
                                .map(([idxStr, pres]) => {
                                  const mod = resultado.modulos?.[Number(idxStr)]
                                  if (!mod?.id) return null
                                  return { id: mod.id, titulo: mod.titulo, descripcion: mod.descripcion, contenido_presentacion: pres }
                                }).filter(Boolean)
                              if (modulosToSave.length > 0) {
                                await api.put(`/cursos/${resultado.curso_id}`, { modulos: modulosToSave }).catch(() => {})
                              }
                            }
                            await api.post('/ia/notificar-profesor', {
                              curso_id: resultado.curso_id,
                              curso_nombre: resultado.nombre,
                              profesor_id: resultado.profesor_id || null,
                              modulos_count: resultado.modulos?.length,
                              preguntas_count: resultado.preguntas_count,
                              nombre_archivo: resultado.nombre_archivo
                            })
                            setEnviado(true)
                            guardarStorage(null)
                            guardarFormStorage(null)
                            setTimeout(() => navigate('/jefatura'), 1500)
                          } catch {
                            alert('No se pudo enviar la notificación. Verifica la configuración de email.')
                          } finally { setEnviando(false) }
                        }}>
                        {enviando ? <><Icon icon="lucide:loader-circle" width={13} style={{verticalAlign:'middle',marginRight:4}} /> Enviando...</> : enviado ? <><Icon icon="lucide:check" width={13} style={{verticalAlign:'middle',marginRight:4}} /> Enviado</> : 'Enviar al profesor'}
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
                    <Icon icon="lucide:alert-triangle" width={13} style={{verticalAlign:"middle",marginRight:4}} /> El contenido no se publica sin validación del profesor
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
