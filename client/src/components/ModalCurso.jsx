import { useState, useEffect, useRef } from 'react'
import { Icon } from '@iconify/react'
import api from '../services/api'
import { Slide } from '../pages/GeneradorIA'

// Construye URL de archivo (funciona en dev con proxy Vite y en producción)
const fileUrl = (url) => url || ''

export default function ModalCurso({ cursoId, onClose, onProgreso }) {
  const [curso, setCurso] = useState(null)
  const [cargando, setCargando] = useState(true)

  // pasos: 'video' | 'modulos' | 'evaluacion'
  const [paso, setPaso] = useState('video')
  const [videoVisto, setVideoVisto] = useState(false)
  const [moduloAbierto, setModuloAbierto] = useState(null) // id del módulo expandido
  const [slideActual, setSlideActual] = useState(0)
  const [completados, setCompletados] = useState(new Set())

  const [respuestas, setRespuestas] = useState({})
  const [resultado, setResultado] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const videoRef = useRef(null)

  useEffect(() => {
    api.get(`/cursos/${cursoId}`)
      .then(res => {
        const preguntas = (res.data.preguntas || []).map(p => ({
          ...p,
          alternativas: typeof p.alternativas === 'string' ? JSON.parse(p.alternativas) : p.alternativas
        }))
        const modulos = (res.data.modulos || []).map(m => {
          let cp = m.contenido_presentacion
          if (typeof cp === 'string') { try { cp = JSON.parse(cp) } catch { cp = null } }
          return { ...m, contenido_presentacion: cp }
        })
        const c = { ...res.data, preguntas, modulos }
        setCurso(c)
        // Si no hay video intro, ir directo a módulos
        if (!c.video_intro_url) setPaso('modulos')
      })
      .catch(() => {})
      .finally(() => setCargando(false))
  }, [cursoId])

  // ─── progreso ────────────────────────────────────────────────────────────────────────────
  const calcProgreso = () => {
    if (!curso) return 0
    if (resultado?.aprobado) return 100
    const totalMods = curso.modulos?.length || 0
    const tieneEval = curso.preguntas?.length > 0
    if (totalMods === 0) return 0
    const pctMods = (completados.size / totalMods) * (tieneEval ? 70 : 100)
    return Math.round(pctMods)
  }
  const progreso = calcProgreso()

  const marcarCompleto = (modId) => {
    const nuevos = new Set([...completados, modId])
    setCompletados(nuevos)
    setModuloAbierto(null)
    setSlideActual(0)
    // Guarda progreso parcial
    const total = curso.modulos?.length || 1
    const tieneEval = curso.preguntas?.length > 0
    const pct = Math.round((nuevos.size / total) * (tieneEval ? 70 : 100))
    api.patch(`/cursos/${cursoId}/progreso`, { porcentaje: pct }).catch(() => {})
    if (onProgreso) onProgreso(cursoId, pct)
  }

  const todosModulosCompletos = curso && completados.size >= (curso.modulos?.length || 0)
  const todosRespondidos = curso?.preguntas?.length > 0 &&
    curso.preguntas.every(p => respuestas[p.id] !== undefined)

  const enviarEvaluacion = async () => {
    if (!curso?.preguntas?.length) return
    let correctas = 0
    curso.preguntas.forEach(p => {
      const alts = p.alternativas || []
      if (respuestas[p.id] !== undefined && alts[respuestas[p.id]]?.correcta) correctas++
    })
    const score = Math.round((correctas / curso.preguntas.length) * 100)
    const aprobado = score >= 60
    setEnviando(true)
    try {
      await api.patch(`/cursos/${cursoId}/progreso`, { porcentaje: aprobado ? 100 : score })
      setResultado({ score, correctas, total: curso.preguntas.length, aprobado })
      if (onProgreso) onProgreso(cursoId, aprobado ? 100 : score)
    } catch {
    } finally {
      setEnviando(false)
    }
  }

  // ─── render módulo expandido ─────────────────────────────────────────────────────────────────────────────────
  const renderContenidoModulo = (mod) => {
    const cp = mod.contenido_presentacion
    const slides = Array.isArray(cp) ? cp
      : Array.isArray(cp?.diapositivas) ? cp.diapositivas
      : []
    const esPPT = slides.length > 0
    const esVideo = mod.tipo === 'video' && mod.archivo_url
    const esPDF = mod.tipo === 'pdf' && mod.archivo_url

    if (esPPT) {
      const total = slides.length
      const slide = slides[slideActual] || null
      const esUltimo = slideActual === total - 1
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Slide slide={slide} total={total} actual={slideActual} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button onClick={() => setSlideActual(s => Math.max(0, s - 1))}
              disabled={slideActual === 0}
              style={{ background: '#F4F5F7', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: slideActual === 0 ? 'not-allowed' : 'pointer', color: slideActual === 0 ? '#ccc' : '#333' }}>
              <><Icon icon="lucide:arrow-left" width={13} style={{verticalAlign:"middle",marginRight:4}} /> Anterior</>
            </button>
            <span style={{ fontSize: 12, color: '#888' }}>{slideActual + 1} / {total}</span>
            {esUltimo ? (
              <button onClick={() => marcarCompleto(mod.id)}
                style={{ background: '#22C55E', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                <><Icon icon="lucide:check" width={13} style={{verticalAlign:"middle",marginRight:4}} /> Completar módulo</>
              </button>
            ) : (
              <button onClick={() => setSlideActual(s => Math.min(total - 1, s + 1))}
                style={{ background: '#2B4BA0', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>
                <>Siguiente <Icon icon="lucide:arrow-right" width={13} style={{verticalAlign:"middle",marginLeft:4}} /></>
              </button>
            )}
          </div>
        </div>
      )
    }

    if (esVideo) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <video
            key={mod.archivo_url}
            controls
            style={{ width: '100%', borderRadius: 10, background: '#000', maxHeight: 340 }}
            onEnded={() => marcarCompleto(mod.id)}
          >
            <source src={fileUrl(mod.archivo_url)} type="video/mp4" />
            <source src={fileUrl(mod.archivo_url)} type="video/webm" />
          </video>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#888' }}>El módulo se marcará como completo al terminar el video.</span>
            <button onClick={() => marcarCompleto(mod.id)}
              style={{ background: '#22C55E', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <><Icon icon="lucide:check" width={13} style={{verticalAlign:"middle",marginRight:4}} /> Marcar como visto</>
            </button>
          </div>
        </div>
      )
    }

    if (esPDF) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <iframe
            src={fileUrl(mod.archivo_url)}
            style={{ width: '100%', height: 400, border: 'none', borderRadius: 10 }}
            title={mod.titulo}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={() => marcarCompleto(mod.id)}
              style={{ background: '#22C55E', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <><Icon icon="lucide:check" width={13} style={{verticalAlign:"middle",marginRight:4}} /> Marcar como visto</>
            </button>
          </div>
        </div>
      )
    }

    // PPT subido (archivo .ppt/.pptx) — solo descarga
    if (mod.archivo_url) {
      return (
        <div style={{ textAlign: 'center', padding: 24 }}>
          <Icon icon="lucide:presentation" width={36} style={{marginBottom:12,display:"block",color:"#888"}} />
          <div style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>Descarga la presentación para verla.</div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <a href={fileUrl(mod.archivo_url)} download target="_blank" rel="noreferrer"
              style={{ background: '#2B4BA0', color: '#fff', borderRadius: 8, padding: '9px 18px', fontSize: 13, textDecoration: 'none' }}>
              <><Icon icon="lucide:download" width={12} style={{verticalAlign:"middle",marginRight:3}} /> Descargar PPT</>
            </a>
            <button onClick={() => marcarCompleto(mod.id)}
              style={{ background: '#22C55E', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <><Icon icon="lucide:check" width={13} style={{verticalAlign:"middle",marginRight:4}} /> Marcar como visto</>
            </button>
          </div>
        </div>
      )
    }

    // Fallback: mostrar descripción del módulo
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ background: '#F4F5F7', borderRadius: 10, padding: '18px 20px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Contenido del módulo</div>
          <div style={{ fontSize: 14, color: '#333', lineHeight: 1.7 }}>{mod.descripcion || mod.titulo}</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={() => marcarCompleto(mod.id)}
            style={{ background: '#22C55E', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <><Icon icon="lucide:check" width={13} style={{verticalAlign:"middle",marginRight:4}} /> Marcar como visto</>
          </button>
        </div>
      </div>
    )
  }

  // ─── pasos indicator ─────────────────────────────────────────────────────────
  const pasos = [
    ...(curso?.video_intro_url ? [{ key: 'video', label: 'Video intro' }] : []),
    { key: 'modulos', label: 'Módulos' },
    ...(curso?.preguntas?.length > 0 ? [{ key: 'evaluacion', label: 'Evaluación' }] : []),
  ]

  const pasoIdx = pasos.findIndex(p => p.key === paso)

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
    }} onClick={onClose}>
      <div style={{
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 680,
        maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden'
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: '20px 24px 0', borderBottom: '0.5px solid #E8E8E8', paddingBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{curso?.nombre || '...'}</div>
              {curso?.area && <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{curso.area}</div>}
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', padding: 4, display:'flex', alignItems:'center' }}><Icon icon="lucide:x" width={18} /></button>
          </div>
          {curso?.descripcion && (
            <div style={{ fontSize: 12, color: '#666', marginBottom: 10 }}>{curso.descripcion}</div>
          )}
          {/* Barra de progreso */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, height: 6, background: '#F0F0F0', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progreso}%`, background: progreso === 100 ? '#22C55E' : '#2B4BA0', borderRadius: 3, transition: 'width 0.4s' }} />
            </div>
            <span style={{ fontSize: 11, color: '#888', flexShrink: 0 }}>{progreso}%</span>
          </div>

          {/* Pasos */}
          {!cargando && (
            <div style={{ display: 'flex', gap: 0, marginBottom: -1 }}>
              {pasos.map((p, i) => {
                const activo = p.key === paso
                const hecho = i < pasoIdx
                const bloqueado = p.key === 'evaluacion' && !todosModulosCompletos
                return (
                  <button key={p.key}
                    onClick={() => {
                      if (bloqueado) return
                      if (p.key === 'modulos' && !videoVisto && curso?.video_intro_url) return
                      setPaso(p.key)
                    }}
                    style={{
                      background: 'none', border: 'none', cursor: bloqueado ? 'not-allowed' : 'pointer',
                      padding: '6px 14px', fontSize: 12,
                      fontWeight: activo ? 600 : 400,
                      color: bloqueado ? '#ccc' : activo ? '#2B4BA0' : hecho ? '#22C55E' : '#888',
                      borderBottom: activo ? '2px solid #2B4BA0' : hecho ? '2px solid #22C55E' : '2px solid transparent',
                      display: 'flex', alignItems: 'center', gap: 5
                    }}>
                    {hecho && <Icon icon="lucide:check" width={10} />}
                    {p.label}
                    {bloqueado && <Icon icon="lucide:lock" width={10} />}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {cargando ? (
            <div style={{ textAlign: 'center', color: '#888', padding: 40 }}>Cargando curso...</div>

          ) : paso === 'video' ? (
            /* ── PASO VIDEO INTRO ── */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ fontSize: 13, color: '#555', fontWeight: 500 }}>
                Mira el video introductorio antes de comenzar los módulos.
              </div>
              <video
                ref={videoRef}
                controls
                style={{ width: '100%', borderRadius: 12, background: '#000', maxHeight: 400 }}
                onEnded={() => setVideoVisto(true)}
              >
                <source src={fileUrl(curso.video_intro_url)} type="video/mp4" />
                <source src={fileUrl(curso.video_intro_url)} type="video/webm" />
              </video>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#888' }}>
                  {videoVisto ? <><Icon icon="lucide:check" width={13} style={{verticalAlign:'middle',marginRight:3,color:'#16A34A'}} /> Video completado</> : 'El video debe terminar para continuar.'}
                </span>
                <button
                  onClick={() => { setVideoVisto(true); setPaso('modulos') }}
                  disabled={!videoVisto}
                  style={{
                    background: videoVisto ? '#2B4BA0' : '#ccc', color: '#fff', border: 'none',
                    borderRadius: 10, padding: '10px 24px', fontSize: 13, fontWeight: 600,
                    cursor: videoVisto ? 'pointer' : 'not-allowed'
                  }}>
                  <>Comenzar módulos <Icon icon="lucide:arrow-right" width={13} style={{verticalAlign:"middle",marginLeft:4}} /></>
                </button>
              </div>
            </div>

          ) : paso === 'modulos' ? (
            /* ── PASO MÓDULOS ── */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {!curso?.modulos?.length ? (
                <div style={{ textAlign: 'center', color: '#888', padding: 24 }}>No hay módulos en este curso.</div>
              ) : curso.modulos.map((mod, i) => {
                const visto = visitados.includes(mod.id)
                return (
                  <div key={mod.id} style={{
                    border: `1px solid ${visto ? '#BBF7D0' : '#E8E8E8'}`, borderRadius: 10,
                    padding: '14px 16px', background: visto ? '#F0FDF4' : '#fff',
                    display: 'flex', alignItems: 'center', gap: 12
                  }}>
                    {/* Cabecera del módulo */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: completo ? 'default' : 'pointer' }}
                      onClick={() => {
                        if (completo) return
                        if (abierto) { setModuloAbierto(null); setSlideActual(0) }
                        else { setModuloAbierto(mod.id); setSlideActual(0) }
                      }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: 8,
                        background: completo ? '#DCFCE7' : '#EEF2FF',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0
                      }}>
                        {completo ? <Icon icon="lucide:check" color="#16A34A" width={16} /> : mod.tipo === 'video' ? <Icon icon="lucide:video" width={16} style={{color:'#2B4BA0'}} /> : mod.tipo === 'pdf' ? <Icon icon="lucide:file-text" width={16} style={{color:'#E8505B'}} /> : <Icon icon="lucide:presentation" width={16} style={{color:'#888'}} />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: completo ? '#15803D' : '#1a1a1a' }}>
                          {i + 1}. {mod.titulo}
                        </div>
                        {mod.descripcion && <div style={{ fontSize: 11, color: '#888', marginTop: 1 }}>{mod.descripcion}</div>}
                      </div>
                      {!completo && (
                        <span style={{ fontSize: 11, color: abierto ? '#2B4BA0' : '#aaa' }}>
                          {abierto ? '▲ Cerrar' : '▼ Ver'}
                        </span>
                      )}
                      {completo && <span style={{ fontSize: 11, color: '#16A34A', fontWeight: 600, display:'flex', alignItems:'center', gap:3 }}><Icon icon="lucide:check" width={11} /> Completado</span>}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>
                        {i + 1}. {mod.titulo}
                        {visto && <span style={{ marginLeft: 8, fontSize: 10, color: '#16A34A' }}>✓ Visto</span>}
                      </div>
                      {mod.descripcion && <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{mod.descripcion}</div>}
                      <div style={{ fontSize: 10, color: '#aaa', marginTop: 2, textTransform: 'uppercase' }}>{mod.tipo}</div>
                    </div>
                    {mod.archivo_url ? (
                      <button onClick={() => abrirModulo(mod)} style={{
                        background: '#2B4BA0', color: '#fff', border: 'none', borderRadius: 8,
                        padding: '7px 14px', fontSize: 12, cursor: 'pointer', flexShrink: 0
                      }}>
                        {visto ? 'Volver a ver' : 'Abrir'}
                      </button>
                    ) : (
                      <span style={{ fontSize: 11, color: '#aaa' }}>Sin archivo</span>
                    )}
                  </div>
                )
              })}
              {curso?.preguntas?.length > 0 && (
                <div style={{ textAlign: 'center', marginTop: 12 }}>
                  {todosModulosCompletos ? (
                    <button onClick={() => setPaso('evaluacion')} style={{
                      background: '#2B4BA0', color: '#fff', border: 'none', borderRadius: 10,
                      padding: '11px 28px', fontSize: 13, fontWeight: 600, cursor: 'pointer'
                    }}>
                      <>Ir a la evaluación <Icon icon="lucide:arrow-right" width={13} style={{verticalAlign:"middle",marginLeft:4}} /></>
                    </button>
                  ) : (
                    <div style={{ fontSize: 12, color: '#888', background: '#F9F9F9', borderRadius: 10, padding: '10px 20px', display: 'inline-block' }}>
                      <><Icon icon="lucide:lock" width={12} style={{verticalAlign:"middle",marginRight:3}} /> Completa todos los módulos para acceder a la evaluación</>
                      ({completados.size}/{curso.modulos.length} completados)
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* TAB EVALUACIÓN */
            <div>
              {resultado ? (
                <div style={{ textAlign: 'center', padding: 32 }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>{resultado.aprobado ? '🎉' : '😔'}</div>
                  <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>
                    {resultado.aprobado ? '¡Evaluación aprobada!' : 'No aprobaste esta vez'}
                  </div>
                  <div style={{ fontSize: 14, color: '#666', marginBottom: 20 }}>
                    Obtuviste {resultado.correctas} de {resultado.total} respuestas correctas ({resultado.score}%)
                  </div>
                  {resultado.aprobado ? (
                    /* ── CURSO FINALIZADO ── */
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                      <Icon icon="lucide:trophy" width={64} style={{marginBottom:8,display:"block",color:"#F5A623"}} />
                      <div style={{ fontSize: 22, fontWeight: 700, color: '#15803D' }}>¡Curso finalizado!</div>
                      <div style={{ fontSize: 14, color: '#555' }}>{curso?.nombre}</div>

                      {/* Tarjeta de puntaje */}
                      <div style={{
                        background: 'linear-gradient(135deg, #1E3A6E 0%, #2B4BA0 100%)',
                        borderRadius: 16, padding: '24px 40px', color: '#fff', width: '100%', maxWidth: 340
                      }}>
                        <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.7, marginBottom: 8 }}>
                          Puntaje obtenido
                        </div>
                        <div style={{ fontSize: 52, fontWeight: 800, lineHeight: 1 }}>{resultado.score}%</div>
                        <div style={{ fontSize: 13, opacity: 0.85, marginTop: 8 }}>
                          {resultado.correctas} de {resultado.total} preguntas correctas
                        </div>
                      </div>

                      {/* Barra de puntaje */}
                      <div style={{ width: '100%', maxWidth: 340 }}>
                        <div style={{ height: 8, background: '#E8E8E8', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', borderRadius: 4, transition: 'width 0.8s ease',
                            width: `${resultado.score}%`,
                            background: resultado.score >= 80 ? '#22C55E' : resultado.score >= 60 ? '#F5A623' : '#E8505B'
                          }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#aaa', marginTop: 4 }}>
                          <span>0%</span>
                          <span style={{ color: '#888' }}>Mínimo aprobación: 60%</span>
                          <span>100%</span>
                        </div>
                      </div>

                      <div style={{ fontSize: 12, color: '#16A34A', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '10px 20px' }}>
                        <><Icon icon="lucide:check" width={13} style={{verticalAlign:"middle",marginRight:4}} /> Tu progreso ha sido registrado</>
                      </div>

                      <button onClick={onClose}
                        style={{ background: '#2B4BA0', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 32px', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 4 }}>
                        Cerrar
                      </button>
                    </div>
                  ) : (
                    /* ── NO APROBADO ── */
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                      <Icon icon="lucide:frown" width={56} style={{marginBottom:8,display:"block",color:"#E8505B"}} />
                      <div style={{ fontSize: 18, fontWeight: 600 }}>No aprobaste esta vez</div>

                      <div style={{
                        background: '#FFF5F5', border: '1px solid #FECACA', borderRadius: 14, padding: '20px 32px', width: '100%', maxWidth: 320
                      }}>
                        <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: '#E8505B', letterSpacing: '0.08em', marginBottom: 6 }}>Tu puntaje</div>
                        <div style={{ fontSize: 44, fontWeight: 800, color: '#E8505B', lineHeight: 1 }}>{resultado.score}%</div>
                        <div style={{ fontSize: 13, color: '#888', marginTop: 6 }}>
                          {resultado.correctas} de {resultado.total} correctas · Necesitas 60% para aprobar
                        </div>
                      </div>

                      <button onClick={() => { setResultado(null); setRespuestas({}) }}
                        style={{ background: '#2B4BA0', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 28px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                        Intentar nuevamente
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div style={{ fontSize: 13, color: '#666' }}>
                    Responde todas las preguntas para completar el curso. Necesitas al menos 60% para aprobar.
                  </div>
                  {curso.preguntas.map((preg, pi) => (
                    <div key={preg.id} style={{ border: '0.5px solid #E8E8E8', borderRadius: 10, padding: '16px' }}>
                      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>
                        {pi + 1}. {preg.texto}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {(preg.alternativas || []).map((alt, ai) => {
                          const seleccionada = respuestas[preg.id] === ai
                          return (
                            <label key={ai} style={{
                              display: 'flex', alignItems: 'center', gap: 10,
                              padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
                              background: seleccionada ? '#EEF2FF' : '#F9F9F9',
                              border: `1px solid ${seleccionada ? '#2B4BA0' : '#E8E8E8'}`,
                              fontSize: 13
                            }}>
                              <input type="radio" name={`preg-${preg.id}`} checked={seleccionada}
                                onChange={() => seleccionarRespuesta(preg.id, ai)}
                                style={{ accentColor: '#2B4BA0' }} />
                              {alt.texto}
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                  <button onClick={enviarEvaluacion} disabled={!todosRespondidos || enviando} style={{
                    background: todosRespondidos ? '#2B4BA0' : '#ccc', color: '#fff',
                    border: 'none', borderRadius: 10, padding: '12px 24px', fontSize: 14,
                    fontWeight: 600, cursor: todosRespondidos ? 'pointer' : 'not-allowed',
                    alignSelf: 'center', marginTop: 8
                  }}>
                    {enviando ? 'Enviando...' : 'Enviar evaluación'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
