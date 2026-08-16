import { useState, useRef, useEffect } from 'react'
import { Icon } from '@iconify/react'
import { useNavigate } from 'react-router-dom'
import Topbar from '../components/Topbar'
import Sidebar from '../components/Sidebar'
import Breadcrumb from '../components/Breadcrumb'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useConfirm } from '../context/ConfirmContext'
import MascotaFoye from '../components/MascotaFoye'
import AvisoModulosIA from '../components/AvisoModulosIA'
import ModalPresentacionModulo from '../components/ModalPresentacionModulo'
import FormularioProtocolo from '../components/FormularioProtocolo'
import EditorBorradorCurso from '../components/EditorBorradorCurso'
import { buildSlides } from '../components/PresentacionSlides'

const RUTA_INICIO = { admin_sede: '/admin', jefatura: '/jefatura' }

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
  const toast = useToast()
  const confirm = useConfirm()
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
  const [progreso, setProgreso] = useState(null) // { etapa, actual, total }
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

  // Entrar/salir de edición de slides: al salir, guarda de inmediato en la BD.
  const toggleEditarPPT = () => {
    if (!editandoPPT) {
      setPptEditData(prev => ({
        ...prev,
        [presentacionActiva]: JSON.parse(JSON.stringify(presentaciones[presentacionActiva]))
      }))
    } else if (pptEditData[presentacionActiva]) {
      const editedPres = pptEditData[presentacionActiva]
      const mod = resultado?.modulos?.[presentacionActiva]
      if (mod?.id && resultado?.curso_id) {
        api.put(`/cursos/${resultado.curso_id}`, {
          modulos: [{ id: mod.id, titulo: mod.titulo, descripcion: mod.descripcion, contenido_presentacion: editedPres }]
        }).catch(() => {})
      }
      setPresentaciones(prev => ({ ...prev, [presentacionActiva]: editedPres }))
      setResultado(prev => {
        if (!prev?.modulos) return prev
        const modulos = [...prev.modulos]
        modulos[presentacionActiva] = { ...modulos[presentacionActiva], contenido_presentacion: editedPres }
        return { ...prev, modulos }
      })
    }
    setEditandoPPT(e => !e)
  }

  const handleChangeSlide = (newSlide) => {
    setPptEditData(prev => {
      const base = prev[presentacionActiva] || JSON.parse(JSON.stringify(presentaciones[presentacionActiva]))
      const diapositivas = [...(base.diapositivas || slides)]
      diapositivas[slideActual] = newSlide
      return { ...prev, [presentacionActiva]: { ...base, diapositivas } }
    })
  }

  const reintentarPresentacion = () => {
    setPresentaciones(prev => { const n = { ...prev }; delete n[presentacionActiva]; return n })
    abrirPresentacion(presentacionActiva)
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
    const { signal } = abortRef.current

    // Limpiar resultado anterior para evitar stacking visual
    setResultado(null)
    guardarStorage(null)
    setModoEdicion(false)
    setEnviado(false)
    setPresentaciones({})
    setCargando(true)
    setError('')
    setProgreso({ etapa: 'extrayendo', actual: 0, total: 0 })

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

      const { data: { jobId } } = await api.post('/ia/generar-curso', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
        signal
      })

      // El servidor ya respondió (202) y sigue trabajando en segundo plano.
      // Consultamos el avance real cada 2s en vez de esperar a ciegas.
      let job
      while (true) {
        if (signal.aborted) return
        await new Promise(r => setTimeout(r, 2000))
        if (signal.aborted) return
        const resp = await api.get(`/ia/generar-curso/progreso/${jobId}`, { signal })
        job = resp.data
        setProgreso(job)
        if (job.listo || job.error) break
      }

      if (job.error) { setError(job.error); return }

      setResultado(job.curso)
      // Pre-cargar presentaciones desde la respuesta (ya generadas en el servidor)
      const presMap = {}
      ;(job.curso.modulos || []).forEach((mod, i) => {
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
      toast.error('No pudimos guardar los cambios del borrador. Inténtalo de nuevo.')
    } finally { setGuardando(false) }
  }

  const descartarBorrador = async () => {
    const ok = await confirm({
      title: 'Descartar borrador',
      message: 'El borrador generado por IA se eliminará permanentemente. Esta acción no se puede deshacer.',
      confirmText: 'Descartar',
      danger: true,
    })
    if (!ok) return
    try {
      await api.delete(`/cursos/${resultado.curso_id}`)
      setResultado(null)
      guardarStorage(null)
      setPresentaciones({})
      setModoEdicion(false)
      setEnviado(false)
    } catch {
      toast.error('No pudimos descartar el borrador. Inténtalo de nuevo.')
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

          <Breadcrumb items={[{ label: 'Inicio', path: RUTA_INICIO[usuario?.rol] || '/' }, { label: 'Generador IA' }]} />

          <div className="three-col">
            {[
              { num: 1, color: 'var(--azul)', title: 'Sube el protocolo', desc: 'Selecciona el PDF del protocolo institucional a digitalizar.' },
              { num: 2, color: 'var(--warning)', title: 'La IA genera el borrador', desc: 'El sistema extrae módulos, preguntas y presentaciones PPT.' },
              { num: 3, color: 'var(--success)', title: 'El profesor valida', desc: 'El contenido generado es revisado y aprobado antes de publicarse.' },
            ].map(s => (
              <div key={s.num} className="card" style={{ position: 'relative' }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 500, color: '#fff', marginBottom: 10 }}>{s.num}</div>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>{s.title}</div>
                <div style={{ fontSize: 11, color: 'var(--texto-muted)', lineHeight: 1.6 }}>{s.desc}</div>
              </div>
            ))}
          </div>

          {/* ── BANNER DE AVISO ── */}
          <AvisoModulosIA resultado={resultado} numModulosPedidos={form.num_modulos} />

          <div className="two-col">
            <FormularioProtocolo
              form={form} onChangeForm={setForm}
              fuentePDF={fuentePDF} onChangeFuentePDF={setFuentePDF}
              archivo={archivo} onChangeArchivo={setArchivo}
              protocolos={protocolos} protocoloSeleccionado={protocoloSeleccionado} onSelectProtocolo={setProtocoloSeleccionado}
              profesores={profesores} error={error} cargando={cargando} onSubmit={handleSubmit}
            />

            {/* Preview */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Borrador generado</span>
                {resultado && <span className="preview-badge">Listo para revisar</span>}
              </div>

              {cargando && (() => {
                const ETAPA_LABEL = {
                  extrayendo:          'Analizando el protocolo...',
                  generando_modulos:   'Definiendo los módulos del curso...',
                  generando_contenido: progreso?.total
                    ? `Generando módulo ${progreso.actual} de ${progreso.total}...`
                    : 'Generando contenido de los módulos...',
                }
                const etapa = progreso?.etapa || 'extrayendo'
                const pct = etapa === 'generando_contenido' && progreso?.total
                  ? Math.round(20 + (progreso.actual / progreso.total) * 75)
                  : etapa === 'generando_modulos' ? 15 : 5
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '3rem 0' }}>
                    <MascotaFoye size={80} estado="activo" animate />
                    <div style={{ fontSize: 13, marginTop: 12, color: 'var(--texto-sec)', fontWeight: 500 }}>{ETAPA_LABEL[etapa] || ETAPA_LABEL.extrayendo}</div>
                    <div className="progress-bar-wrap" style={{ width: 220, marginTop: 12 }}>
                      <div className="progress-bar-fill" style={{ width: `${pct}%`, transition: 'width 0.4s ease' }} />
                    </div>
                    <div style={{ fontSize: 12, marginTop: 6, color: 'var(--texto-muted)' }}>Esto suele tomar entre 2 y 5 minutos. Puedes dejar esta pestaña abierta.</div>
                    <button
                      type="button"
                      onClick={() => abortRef.current?.abort()}
                      style={{ marginTop: 16, background: 'transparent', border: '0.5px solid var(--gris-borde)', borderRadius: 8, padding: '6px 16px', fontSize: 12, color: 'var(--texto-sec)', cursor: 'pointer' }}
                    >
                      Cancelar generación
                    </button>
                  </div>
                )
              })()}

              {!resultado && !cargando && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '3rem 0', color: '#CCC' }}>
                  <MascotaFoye size={72} estado="neutral" animate />
                  <div style={{ fontSize: 13, marginTop: 12, color: 'var(--texto-muted)' }}>El borrador aparecerá aquí</div>
                </div>
              )}

              {resultado && (
                <>
                  {/* ── MODAL PRESENTACIÓN ────────────────────────── */}
                  {presentacionActiva !== null && mod && (
                    <ModalPresentacionModulo
                      mod={mod}
                      moduloIndex={presentacionActiva}
                      totalModulos={resultado.modulos?.length}
                      pres={pres}
                      activePres={activePres}
                      slides={slides}
                      modoPPT={modoPPT}
                      onSetModoPPT={setModoPPT}
                      editandoPPT={editandoPPT}
                      onToggleEditarPPT={toggleEditarPPT}
                      slideActual={slideActual}
                      onSetSlideActual={setSlideActual}
                      onChangeSlide={handleChangeSlide}
                      imagenesProtocolo={resultado?.imagenes_protocolo}
                      onClose={cerrarModal}
                      onRetry={reintentarPresentacion}
                    />
                  )}

                  {/* ── CABECERA RESULTADO ── */}
                  <div style={{ background: 'var(--gris-fondo)', borderRadius: 8, padding: '8px 12px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 12, color: 'var(--texto-sec)' }}>Fuente: <strong>{archivo?.name}</strong></div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span style={{ fontSize: 11, color: 'var(--azul-oscuro)', fontWeight: 500 }}>{resultado.modulos?.length} módulos</span>
                      <span style={{ fontSize: 11, color: 'var(--texto-muted)' }}>•</span>
                      <span style={{ fontSize: 11, color: 'var(--texto-sec)' }}>{resultado.modulos?.reduce((acc, m) => acc + (m.preguntas?.length || 0), 0)} preguntas</span>
                    </div>
                  </div>

                  {/* ── LISTA DE MÓDULOS ── */}
                  {resultado.modulos?.map((m, i) => (
                    <div key={i} style={{ border: '0.5px solid var(--gris-borde)', borderRadius: 10, marginBottom: 8, overflow: 'hidden' }}>
                      <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', background: moduloExpandido === i ? '#F0F4FF' : '#fff' }}
                        onClick={() => setModuloExpandido(moduloExpandido === i ? null : i)}>
                        <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--azul-oscuro)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff', flexShrink: 0 }}>{i + 1}</div>
                        <span style={{ fontSize: 12, fontWeight: 500, flex: 1 }}>{m.titulo}</span>
                        <button onClick={e => { e.stopPropagation(); abrirPresentacion(i) }} style={{
                          fontSize: 10, background: 'var(--azul-oscuro)', color: '#fff', border: 'none',
                          borderRadius: 5, padding: '3px 8px', cursor: 'pointer', flexShrink: 0,
                          display: 'flex', alignItems: 'center', gap: 4
                        }}><Icon icon="lucide:play" width={11} /> PPT</button>
                        <span style={{ fontSize: 11, color: 'var(--texto-muted)', flexShrink: 0 }}>{m.preguntas?.length || 0} preg.</span>
                        <span className="format-tag tag-borrador" style={{ flexShrink: 0 }}>Módulo</span>
                        <span style={{ fontSize: 12, color: 'var(--texto-muted)', flexShrink: 0 }}>{moduloExpandido === i ? '▲' : '▼'}</span>
                      </div>

                      {moduloExpandido === i && (
                        <div style={{ borderTop: '0.5px solid var(--gris-borde)', padding: '10px 12px' }}>
                          <div style={{ fontSize: 11, color: '#666', lineHeight: 1.5, marginBottom: 10 }}>{m.descripcion}</div>
                          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--azul-oscuro)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                            Preguntas de evaluación ({m.preguntas?.length || 0})
                          </div>
                          {m.preguntas?.map((p, j) => (
                            <div key={j} style={{ marginBottom: 8, border: '0.5px solid #EEE', borderRadius: 7, overflow: 'hidden' }}>
                              <div style={{ display: 'flex', gap: 6, padding: '7px 10px', cursor: 'pointer', background: preguntasExpandidas[`${i}-${j}`] ? '#F7F8FF' : '#FAFAFA' }}
                                onClick={() => setPreguntasExpandidas(prev => ({ ...prev, [`${i}-${j}`]: !prev[`${i}-${j}`] }))}>
                                <span style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--gris-borde)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#666', flexShrink: 0 }}>{j + 1}</span>
                                <span style={{ fontSize: 11, color: '#333', flex: 1 }}>{p.texto}</span>
                                <span style={{ fontSize: 10, color: 'var(--texto-muted)' }}>{preguntasExpandidas[`${i}-${j}`] ? '▲' : '▼'}</span>
                              </div>
                              {preguntasExpandidas[`${i}-${j}`] && (
                                <div style={{ padding: '6px 10px 8px 32px', background: '#F7F8FF', borderTop: '0.5px solid #EEE' }}>
                                  {p.alternativas?.map((alt, k) => (
                                    <div key={k} style={{ display: 'flex', gap: 6, fontSize: 11, padding: '3px 0', color: alt.correcta ? 'var(--success)' : 'var(--texto-sec)' }}>
                                      <span style={{ width: 14, height: 14, borderRadius: '50%', border: alt.correcta ? '2px solid var(--success)' : '1.5px solid #CCC', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, flexShrink: 0, background: alt.correcta ? '#E8F5ED' : 'transparent' }}>
                                        {alt.correcta ? <Icon icon="lucide:check" color="var(--success)" width={9} /> : null}
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
                    <EditorBorradorCurso
                      borradorEdit={borradorEdit}
                      onChange={setBorradorEdit}
                      onGuardar={guardarEdicion}
                      guardando={guardando}
                      onCancelar={() => setModoEdicion(false)}
                    />
                  )}

                  {/* Botones de acción */}
                  {!modoEdicion && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <button
                        disabled={enviando || enviado}
                        style={{ flex: 1, height: 38, background: enviado ? '#4CAF50' : 'var(--verde)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: enviando || enviado ? 'default' : 'pointer' }}
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
                            toast.error('No pudimos enviar la notificación al profesor. Verifica la conexión e inténtalo de nuevo.')
                          } finally { setEnviando(false) }
                        }}>
                        {enviando ? <><Icon icon="lucide:loader-circle" width={13} style={{verticalAlign:'middle',marginRight:4}} /> Enviando...</> : enviado ? <><Icon icon="lucide:check" width={13} style={{verticalAlign:'middle',marginRight:4}} /> Enviado</> : 'Enviar al profesor'}
                      </button>
                      <button
                        style={{ flex: 1, height: 38, background: 'none', color: 'var(--azul-oscuro)', border: '0.5px solid var(--azul-oscuro)', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}
                        onClick={() => { setBorradorEdit(JSON.parse(JSON.stringify(resultado))); setModoEdicion(true) }}>
                        Editar
                      </button>
                      <button
                        style={{ flex: 1, height: 38, background: 'none', color: 'var(--danger)', border: '0.5px solid var(--danger)', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}
                        onClick={descartarBorrador}>
                        Descartar
                      </button>
                    </div>
                  )}

                  <p style={{ fontSize: 12, color: 'var(--warning)', textAlign: 'center', marginTop: 10 }}>
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
