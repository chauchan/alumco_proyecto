import { useState, useEffect, useRef } from 'react'
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
  const [bloqueadoHasta, setBloqueadoHasta] = useState(null)
  const videoRef = useRef(null)

  useEffect(() => {
    Promise.all([
      api.get(`/cursos/${cursoId}`),
      api.get(`/cursos/${cursoId}/mi-progreso`).catch(() => ({ data: {} }))
    ]).then(([cursoRes, progresoRes]) => {
        const preguntas = (cursoRes.data.preguntas || []).map(p => ({
          ...p,
          alternativas: typeof p.alternativas === 'string' ? JSON.parse(p.alternativas) : p.alternativas
        }))
        const modulos = (cursoRes.data.modulos || []).map(m => {
          let cp = m.contenido_presentacion
          if (typeof cp === 'string') { try { cp = JSON.parse(cp) } catch { cp = null } }
          return { ...m, contenido_presentacion: cp }
        })
        const c = { ...cursoRes.data, preguntas, modulos }
        setCurso(c)
        // Verificar bloqueo
        const bh = progresoRes.data?.bloqueado_hasta
        if (bh && new Date(bh) > new Date()) {
          setBloqueadoHasta(new Date(bh))
        } else if (!c.video_intro_url) {
          setPaso('modulos')
        }
      })
      .catch(() => {})
      .finally(() => setCargando(false))
  }, [cursoId])

  // ─── progreso ────────────────────────────────────────────────────────────────
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
      const alts = (p.alternativas || []).filter(a => a?.texto?.trim()).slice(0, 4)
      if (respuestas[p.id] !== undefined && alts[respuestas[p.id]]?.correcta) correctas++
    })
    const score = Math.round((correctas / curso.preguntas.length) * 100)
    const aprobado = score >= 60
    setEnviando(true)
    let bloqueado = false
    try {
      const r = await api.patch(`/cursos/${cursoId}/progreso`, { porcentaje: aprobado ? 100 : score, es_evaluacion: true })
      const bh = r.data?.bloqueado_hasta
      if (bh && new Date(bh) > new Date()) {
        setBloqueadoHasta(new Date(bh))
        bloqueado = true
      }
    } catch {
      // Si falla guardar progreso, mostrar resultado igual
    } finally {
      setEnviando(false)
    }
    if (bloqueado) return  // mostrar pantalla de bloqueo, no la de resultado
    setResultado({ score, correctas, total: curso.preguntas.length, aprobado })
    if (onProgreso) onProgreso(cursoId, aprobado ? 100 : score)
  }

  // ─── render módulo expandido ─────────────────────────────────────────────────
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
              ← Anterior
            </button>
            <span style={{ fontSize: 12, color: '#888' }}>{slideActual + 1} / {total}</span>
            {esUltimo ? (
              <button onClick={() => marcarCompleto(mod.id)}
                style={{ background: '#22C55E', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Completar módulo ✓
              </button>
            ) : (
              <button onClick={() => setSlideActual(s => Math.min(total - 1, s + 1))}
                style={{ background: '#2B4BA0', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>
                Siguiente →
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
              Marcar como visto ✓
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
              Marcar como visto ✓
            </button>
          </div>
        </div>
      )
    }

    // PPT subido (archivo .ppt/.pptx) — solo descarga
    if (mod.archivo_url) {
      return (
        <div style={{ textAlign: 'center', padding: 24 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
          <div style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>Descarga la presentación para verla.</div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <a href={fileUrl(mod.archivo_url)} download target="_blank" rel="noreferrer"
              style={{ background: '#2B4BA0', color: '#fff', borderRadius: 8, padding: '9px 18px', fontSize: 13, textDecoration: 'none' }}>
              ↓ Descargar PPT
            </a>
            <button onClick={() => marcarCompleto(mod.id)}
              style={{ background: '#22C55E', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Marcar como visto ✓
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
            Marcar como visto ✓
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
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
    }} onClick={onClose}>
      <div style={{
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 820,
        maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden'
      }} onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div style={{ padding: '18px 24px 0', borderBottom: '0.5px solid #E8E8E8' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{curso?.nombre || '...'}</div>
              {curso?.area && <div style={{ fontSize: 11, color: '#888', marginTop: 1 }}>{curso.area}</div>}
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#888', padding: 4 }}>✕</button>
          </div>

          {/* Barra de progreso */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{ flex: 1, height: 5, background: '#F0F0F0', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progreso}%`, background: progreso >= 100 ? '#22C55E' : '#2B4BA0', borderRadius: 3, transition: 'width 0.4s' }} />
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
                    {hecho && <span style={{ fontSize: 10 }}>✓</span>}
                    {p.label}
                    {bloqueado && <span style={{ fontSize: 10 }}>🔒</span>}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Body ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {bloqueadoHasta ? (
            /* ── CURSO BLOQUEADO ── */
            <div style={{ textAlign: 'center', padding: '40px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <div style={{ fontSize: 56 }}>🔒</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1a1a' }}>Curso temporalmente bloqueado</div>
              <div style={{ fontSize: 14, color: '#555', maxWidth: 380, lineHeight: 1.6 }}>
                Has fallado este curso 2 veces. Podrás intentarlo nuevamente el{' '}
                <strong>{bloqueadoHasta.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>.
              </div>
              <div style={{
                background: '#FFF5F5', border: '1px solid #FECACA', borderRadius: 12,
                padding: '14px 24px', fontSize: 13, color: '#B91C1C', maxWidth: 360
              }}>
                Tu administrador de sede ha sido notificado. Aprovecha este tiempo para repasar los contenidos.
              </div>
              <button onClick={onClose}
                style={{ background: '#1E3A6E', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 28px', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginTop: 8 }}>
                Cerrar
              </button>
            </div>
          ) : cargando ? (
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
                  {videoVisto ? '✓ Video completado' : 'El video debe terminar para continuar.'}
                </span>
                <button
                  onClick={() => { setVideoVisto(true); setPaso('modulos') }}
                  disabled={!videoVisto}
                  style={{
                    background: videoVisto ? '#2B4BA0' : '#ccc', color: '#fff', border: 'none',
                    borderRadius: 10, padding: '10px 24px', fontSize: 13, fontWeight: 600,
                    cursor: videoVisto ? 'pointer' : 'not-allowed'
                  }}>
                  Comenzar módulos →
                </button>
              </div>
            </div>

          ) : paso === 'modulos' ? (
            /* ── PASO MÓDULOS ── */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {!curso?.modulos?.length ? (
                <div style={{ textAlign: 'center', color: '#888', padding: 32 }}>No hay módulos en este curso.</div>
              ) : curso.modulos.map((mod, i) => {
                const completo = completados.has(mod.id)
                const abierto = moduloAbierto === mod.id
                return (
                  <div key={mod.id} style={{
                    border: `1px solid ${completo ? '#BBF7D0' : abierto ? '#93C5FD' : '#E8E8E8'}`,
                    borderRadius: 12, overflow: 'hidden',
                    background: completo ? '#F0FDF4' : abierto ? '#EFF6FF' : '#fff'
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
                        {completo ? '✓' : mod.tipo === 'video' ? '🎥' : mod.tipo === 'pdf' ? '📄' : '📊'}
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
                      {completo && <span style={{ fontSize: 11, color: '#16A34A', fontWeight: 600 }}>Completado ✓</span>}
                    </div>

                    {/* Contenido expandido */}
                    {abierto && !completo && (
                      <div style={{ padding: '0 16px 16px' }}>
                        {renderContenidoModulo(mod)}
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Botón ir a evaluación */}
              {curso?.preguntas?.length > 0 && (
                <div style={{ textAlign: 'center', marginTop: 12 }}>
                  {todosModulosCompletos ? (
                    <button onClick={() => setPaso('evaluacion')} style={{
                      background: '#2B4BA0', color: '#fff', border: 'none', borderRadius: 10,
                      padding: '11px 28px', fontSize: 13, fontWeight: 600, cursor: 'pointer'
                    }}>
                      Ir a la evaluación →
                    </button>
                  ) : (
                    <div style={{ fontSize: 12, color: '#888', background: '#F9F9F9', borderRadius: 10, padding: '10px 20px', display: 'inline-block' }}>
                      🔒 Completa todos los módulos para acceder a la evaluación
                      ({completados.size}/{curso.modulos.length} completados)
                    </div>
                  )}
                </div>
              )}
            </div>

          ) : (
            /* ── PASO EVALUACIÓN ── */
            <div>
              {resultado ? (
                <div style={{ textAlign: 'center', padding: '32px 16px' }}>
                  {resultado.aprobado ? (
                    /* ── CURSO FINALIZADO ── */
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                      <div style={{ fontSize: 64 }}>🏆</div>
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
                        Tu progreso ha sido registrado ✓
                      </div>

                      <button onClick={onClose}
                        style={{ background: '#2B4BA0', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 32px', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 4 }}>
                        Cerrar
                      </button>
                    </div>
                  ) : (
                    /* ── NO APROBADO ── */
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                      <div style={{ fontSize: 56 }}>😔</div>
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
                    Responde todas las preguntas. Necesitas al menos 60% para aprobar.
                  </div>
                  {curso.preguntas.map((preg, pi) => (
                    <div key={preg.id} style={{ border: '0.5px solid #E8E8E8', borderRadius: 10, padding: 16 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>{pi + 1}. {preg.texto}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {(preg.alternativas || []).filter(alt => alt?.texto?.trim()).slice(0, 4).map((alt, ai) => {
                          const sel = respuestas[preg.id] === ai
                          return (
                            <label key={ai} style={{
                              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                              borderRadius: 8, cursor: 'pointer', fontSize: 13,
                              background: sel ? '#EEF2FF' : '#F9F9F9',
                              border: `1px solid ${sel ? '#2B4BA0' : '#E8E8E8'}`
                            }}>
                              <input type="radio" name={`preg-${preg.id}`} checked={sel}
                                onChange={() => setRespuestas(prev => ({ ...prev, [preg.id]: ai }))}
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
                    alignSelf: 'center', marginTop: 4
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
