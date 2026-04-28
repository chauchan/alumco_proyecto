import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Icon } from '@iconify/react'
import Topbar from '../components/Topbar'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import { Slide } from './GeneradorIA'

const fileUrl = (url) => url || ''

export default function CursoDetalle() {
  const { id: cursoId } = useParams()
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const userId = usuario?.id

  const [curso, setCurso] = useState(null)
  const [cargando, setCargando] = useState(true)

  // pasos: 'video' | 'modulos' | 'evaluacion'
  const [paso, setPaso] = useState('video')
  const [videoVisto, setVideoVisto] = useState(false)
  const [moduloActivo, setModuloActivo] = useState(null)
  const [slideActual, setSlideActual] = useState(0)
  const [completados, setCompletados] = useState(new Set())

  const [respuestas, setRespuestas] = useState({})
  const [resultado, setResultado] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [bloqueadoHasta, setBloqueadoHasta] = useState(null)
  const [intentosRestantes, setIntentosRestantes] = useState(2)
  const [signedUrls, setSignedUrls] = useState({})
  const [certificadoUrl, setCertificadoUrl] = useState(null)
  const [certError, setCertError] = useState(null)
  const [generandoPPT, setGenerandoPPT] = useState({})
  const [esperandoPractico, setEsperandoPractico] = useState(false)
  const videoRef = useRef(null)

  // Buscar certificado aprobado; si no existe, generarlo bajo demanda
  useEffect(() => {
    if (!resultado?.aprobado || certificadoUrl || certError) return
    setCertError(null)
    api.get('/certificados')
      .then(r => {
        const cert = r.data.find(c => c.curso_id === parseInt(cursoId) && c.estado === 'aprobado' && c.archivo_url)
        if (cert) {
          setCertificadoUrl(cert.archivo_url)
        } else {
          return api.post(`/cursos/${cursoId}/certificado`)
            .then(res => {
              if (res.data?.archivo_url) setCertificadoUrl(res.data.archivo_url)
              else setCertError('El servidor no devolvió la URL del certificado')
            })
            .catch(err => {
              const msg = err?.response?.data?.detalle || err?.response?.data?.error || err.message
              console.error('[cert] Error al generar:', msg)
              setCertError(msg)
            })
        }
      })
      .catch(err => {
        const msg = err?.response?.data?.error || err.message
        console.error('[cert] Error al buscar certificados:', msg)
        setCertError(msg)
      })
  }, [resultado?.aprobado, cursoId, certificadoUrl, certError])

  // ── Comentarios por módulo ──────────────────────────────────────────────────
  const [comentariosPorModulo, setComentariosPorModulo] = useState({})
  const [textoPorModulo, setTextoPorModulo] = useState({})
  const [replyingTo, setReplyingTo] = useState({})
  const [replyTexto, setReplyTexto] = useState({})
  const [enviandoCom, setEnviandoCom] = useState({})

  // Obtener URL firmada cuando cambia el módulo activo
  useEffect(() => {
    if (!moduloActivo || !cursoId) return
    if (signedUrls[moduloActivo]) return // ya cacheada
    api.get(`/cursos/${cursoId}/modulos/${moduloActivo}/signed-url`)
      .then(r => setSignedUrls(prev => ({ ...prev, [moduloActivo]: r.data.url })))
      .catch(err => console.error('[signed-url] error:', err?.response?.status, err?.response?.data || err?.message))
  }, [moduloActivo, cursoId])

  // Auto-generar PPT si el módulo activo es tipo ppt y no tiene slides guardadas
  useEffect(() => {
    if (!moduloActivo || !curso) return
    const mod = curso.modulos?.find(m => m.id === moduloActivo)
    if (!mod || mod.tipo !== 'ppt') return
    const cp = mod.contenido_presentacion
    const slides = Array.isArray(cp) ? cp : Array.isArray(cp?.diapositivas) ? cp.diapositivas : []
    if (slides.length > 0 || generandoPPT[moduloActivo]) return

    setGenerandoPPT(prev => ({ ...prev, [moduloActivo]: true }))
    api.post(`/ia/modulo/${moduloActivo}/generar-ppt`)
      .then(r => {
        const presentacion = r.data.presentacion
        setCurso(prev => ({
          ...prev,
          modulos: prev.modulos.map(m =>
            m.id === moduloActivo ? { ...m, contenido_presentacion: presentacion } : m
          )
        }))
      })
      .catch(err => console.error('[generar-ppt]', err?.response?.data || err?.message))
      .finally(() => setGenerandoPPT(prev => ({ ...prev, [moduloActivo]: false })))
  }, [moduloActivo, curso])

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

        const localBloqueoRaw = localStorage.getItem(`curso_${userId}_${cursoId}_bloqueo`)
        const localBloqueo = localBloqueoRaw ? JSON.parse(localBloqueoRaw) : null

        setEsperandoPractico(!!progresoRes.data?.esperando_practico)

        const intentosFallidosDB = parseInt(progresoRes.data?.intentos_fallidos || 0, 10)
        const intentosFallidosLocal = parseInt(localBloqueo?.intentos_fallidos || 0, 10)
        const intentosFallidos = Math.max(intentosFallidosDB, intentosFallidosLocal)
        setIntentosRestantes(Math.max(0, 2 - intentosFallidos))

        const bhDB = progresoRes.data?.bloqueado_hasta || null
        const bhLocal = localBloqueo?.bloqueado_hasta || null
        const bh = [bhDB, bhLocal].filter(Boolean).sort().reverse()[0] || null

        if (bh && new Date(bh) > new Date()) {
          setBloqueadoHasta(new Date(bh))
        } else {
          const pctGuardado = progresoRes.data?.porcentaje || 0
          const yaCompletado = progresoRes.data?.completado === 1 || progresoRes.data?.completado === true

          const localKey = `curso_${userId}_${cursoId}_completados`
          const localRaw = localStorage.getItem(localKey)
          const localIds = localRaw ? JSON.parse(localRaw) : null

          if (localIds && localIds.length > 0) {
            setCompletados(new Set(localIds))
            setVideoVisto(true)
            if (yaCompletado) {
              const totalPreg = c.preguntas?.length || 0
              setResultado({ score: 100, correctas: totalPreg, total: totalPreg, aprobado: true })
              setPaso('evaluacion')
            } else {
              setPaso('modulos')
            }
          } else if (pctGuardado > 0) {
            setVideoVisto(true)
            if (modulos.length > 0) {
              setCompletados(new Set(modulos.map(m => m.id)))
            }
            if (yaCompletado) {
              const totalPreg = c.preguntas?.length || 0
              setResultado({ score: 100, correctas: totalPreg, total: totalPreg, aprobado: true })
              setPaso('evaluacion')
            } else if (pctGuardado >= 70 && c.preguntas?.length > 0) {
              setPaso('evaluacion')
            } else {
              setPaso('modulos')
            }
          } else {
            if (!c.video_intro_url) setPaso('modulos')
          }
        }
      })
      .catch(() => {})
      .finally(() => setCargando(false))
  }, [cursoId])

  // Inicializar módulo activo al entrar al paso de módulos
  useEffect(() => {
    if (paso === 'modulos' && curso?.modulos?.length && !moduloActivo) {
      const primerSinCompletar = curso.modulos.find(m => !completados.has(m.id))
      setModuloActivo((primerSinCompletar || curso.modulos[0]).id)
    }
  }, [paso, curso])

  // Cargar comentarios del módulo activo (solo una vez por módulo)
  useEffect(() => {
    if (!moduloActivo || comentariosPorModulo[moduloActivo] !== undefined) return
    api.get(`/modulos/${moduloActivo}/comentarios`)
      .then(r => setComentariosPorModulo(prev => ({ ...prev, [moduloActivo]: r.data })))
      .catch(() => setComentariosPorModulo(prev => ({ ...prev, [moduloActivo]: [] })))
  }, [moduloActivo])

  const cargarComentarios = (modId) =>
    api.get(`/modulos/${modId}/comentarios`)
      .then(r => setComentariosPorModulo(prev => ({ ...prev, [modId]: r.data })))
      .catch(() => {})

  const enviarComentario = async (modId, texto, parentId = null) => {
    if (!texto?.trim()) return
    setEnviandoCom(prev => ({ ...prev, [modId]: true }))
    try {
      await api.post(`/modulos/${modId}/comentarios`, { texto: texto.trim(), parent_id: parentId })
      await cargarComentarios(modId)
      if (parentId) {
        setReplyTexto(prev => ({ ...prev, [modId]: '' }))
        setReplyingTo(prev => ({ ...prev, [modId]: null }))
      } else {
        setTextoPorModulo(prev => ({ ...prev, [modId]: '' }))
      }
    } catch {
      // silencioso; el usuario puede reintentar
    } finally {
      setEnviandoCom(prev => ({ ...prev, [modId]: false }))
    }
  }

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
    setSlideActual(0)
    // Avanzar automáticamente al siguiente módulo no completado
    if (curso?.modulos) {
      const idx = curso.modulos.findIndex(m => m.id === modId)
      const siguiente = curso.modulos.slice(idx + 1).find(m => !nuevos.has(m.id))
      if (siguiente) setModuloActivo(siguiente.id)
    }
    localStorage.setItem(`curso_${userId}_${cursoId}_completados`, JSON.stringify([...nuevos]))
    const total = curso.modulos?.length || 1
    const tieneEval = curso.preguntas?.length > 0
    const pct = Math.round((nuevos.size / total) * (tieneEval ? 70 : 100))
    api.patch(`/cursos/${cursoId}/progreso`, { porcentaje: pct })
      .then(r => console.log('[progreso módulo] guardado:', r.data))
      .catch(err => console.error('[progreso módulo] ERROR:', err?.response?.status, err?.response?.data || err?.message))
  }

  const todosModulosCompletos = curso && completados.size >= (curso.modulos?.length || 0)
  const todosRespondidos = curso?.preguntas?.length > 0 &&
    curso.preguntas.every(p => respuestas[p.id] !== undefined)

  const enviarEvaluacion = async () => {
    if (!curso?.preguntas?.length) return

    // Compute correctas locally for the result UI, and build the payload
    let correctas = 0
    const respuestasFormateadas = curso.preguntas.map(p => {
      const alts = (p.alternativas || []).filter(a => a?.texto?.trim()).slice(0, 4)
      const idx = respuestas[p.id]
      if (idx !== undefined && alts[idx]?.correcta) correctas++
      return { pregunta_id: p.id, alternativa_idx: idx }
    }).filter(r => r.alternativa_idx !== undefined)

    setEnviando(true)
    try {
      const { data } = await api.post(`/evaluaciones/${cursoId}/responder`, { respuestas: respuestasFormateadas })
      const { nota: score, aprobado, numero_intento, doble_fallo, bloqueado_hasta: bh, esperando_practico } = data

      if (doble_fallo && bh && new Date(bh) > new Date()) {
        setBloqueadoHasta(new Date(bh))
        setIntentosRestantes(0)
        localStorage.setItem(`curso_${userId}_${cursoId}_bloqueo`, JSON.stringify({ intentos_fallidos: 2, bloqueado_hasta: bh }))
        return
      }

      if (!aprobado) {
        setIntentosRestantes(Math.max(0, 2 - numero_intento))
        localStorage.setItem(`curso_${userId}_${cursoId}_bloqueo`, JSON.stringify({ intentos_fallidos: numero_intento, bloqueado_hasta: null }))
      } else {
        localStorage.removeItem(`curso_${userId}_${cursoId}_completados`)
        localStorage.removeItem(`curso_${userId}_${cursoId}_bloqueo`)
        setEsperandoPractico(!!esperando_practico)
      }

      setResultado({ score, correctas, total: curso.preguntas.length, aprobado })
    } catch (err) {
      if (err?.response?.status === 400) {
        // Already passed or max attempts reached — refresh state from server
        api.get(`/cursos/${cursoId}/mi-progreso`)
          .then(r => {
            const bh = r.data?.bloqueado_hasta
            if (bh && new Date(bh) > new Date()) setBloqueadoHasta(new Date(bh))
            setIntentosRestantes(Math.max(0, 2 - (r.data?.intentos_fallidos || 0)))
          })
          .catch(() => {})
      } else {
        console.error('[evaluacion]', err?.response?.data || err?.message)
      }
    } finally {
      setEnviando(false)
    }
  }

  // ─── render módulo expandido ─────────────────────────────────────────────────
  const renderContenidoModulo = (mod) => {
    const cp = mod.contenido_presentacion
    const slides = Array.isArray(cp) ? cp
      : Array.isArray(cp?.diapositivas) ? cp.diapositivas
      : []
    const esPPT = slides.length > 0

    // PPT sin slides aún: mostrar spinner mientras se genera
    if (mod.tipo === 'ppt' && !esPPT) {
      return (
        <div style={{ textAlign: 'center', padding: '48px 16px', color: '#888' }}>
          <Icon icon="lucide:loader" width={32} style={{ marginBottom: 12, display: 'block', margin: '0 auto 12px', animation: 'spin 1s linear infinite' }} />
          <div style={{ fontSize: 14, fontWeight: 500 }}>Generando presentación...</div>
          <div style={{ fontSize: 12, marginTop: 6 }}>Esto puede tomar unos segundos</div>
        </div>
      )
    }
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
              <><Icon icon="lucide:arrow-left" width={13} style={{verticalAlign:'middle',marginRight:4}} /> Anterior</>
            </button>
            <span style={{ fontSize: 12, color: '#888' }}>{slideActual + 1} / {total}</span>
            {esUltimo ? (
              <button onClick={() => marcarCompleto(mod.id)}
                style={{ background: '#22C55E', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                <><Icon icon="lucide:check" width={13} style={{verticalAlign:'middle',marginRight:4}} /> Completar módulo</>
              </button>
            ) : (
              <button onClick={() => setSlideActual(s => Math.min(total - 1, s + 1))}
                style={{ background: '#2B4BA0', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>
                <>Siguiente <Icon icon="lucide:arrow-right" width={13} style={{verticalAlign:'middle',marginLeft:4}} /></>
              </button>
            )}
          </div>
        </div>
      )
    }

    if (esVideo) {
      const videoSrc = signedUrls[mod.id] || ''
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <video
            key={videoSrc}
            controls
            style={{ width: '100%', borderRadius: 10, background: '#000', maxHeight: 480 }}
            onEnded={() => marcarCompleto(mod.id)}
          >
            {videoSrc && <source src={videoSrc} type="video/mp4" />}
            {videoSrc && <source src={videoSrc} type="video/webm" />}
          </video>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#888' }}>El módulo se marcará como completo al terminar el video.</span>
            <button onClick={() => marcarCompleto(mod.id)}
              style={{ background: '#22C55E', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <><Icon icon="lucide:check" width={13} style={{verticalAlign:'middle',marginRight:4}} /> Marcar como visto</>
            </button>
          </div>
        </div>
      )
    }

    if (esPDF) {
      const pdfSrc = signedUrls[mod.id] || ''
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <iframe
            src={pdfSrc}
            style={{ width: '100%', height: 500, border: 'none', borderRadius: 10 }}
            title={mod.titulo}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={() => marcarCompleto(mod.id)}
              style={{ background: '#22C55E', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <><Icon icon="lucide:check" width={13} style={{verticalAlign:'middle',marginRight:4}} /> Marcar como visto</>
            </button>
          </div>
        </div>
      )
    }

    if (mod.archivo_url) {
      const fileSrc = signedUrls[mod.id] || ''
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {fileSrc ? (
            <iframe
              key={fileSrc}
              src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileSrc)}`}
              style={{ width: '100%', height: 520, border: 'none', borderRadius: 10 }}
              title={mod.titulo}
            />
          ) : (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontSize: 13 }}>
              Cargando presentación...
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <a href={fileSrc} download target="_blank" rel="noreferrer"
              style={{ background: '#F4F5F7', color: '#333', borderRadius: 8, padding: '8px 14px', fontSize: 12, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <Icon icon="lucide:download" width={12} /> Descargar PPT
            </a>
            <button onClick={() => marcarCompleto(mod.id)}
              style={{ background: '#22C55E', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <><Icon icon="lucide:check" width={13} style={{verticalAlign:'middle',marginRight:4}} /> Marcar como visto</>
            </button>
          </div>
        </div>
      )
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ background: '#F4F5F7', borderRadius: 10, padding: '18px 20px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Contenido del módulo</div>
          <div style={{ fontSize: 14, color: '#333', lineHeight: 1.7 }}>{mod.descripcion || mod.titulo}</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={() => marcarCompleto(mod.id)}
            style={{ background: '#22C55E', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <><Icon icon="lucide:check" width={13} style={{verticalAlign:'middle',marginRight:4}} /> Marcar como visto</>
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
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Topbar />
        <main style={{ flex: 1, overflowY: 'auto', background: '#F6F7FB', padding: '24px 32px' }}>

          {/* Encabezado con botón volver */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <button onClick={() => navigate(-1)}
              style={{ background: '#fff', border: '0.5px solid #E8E8E8', borderRadius: 8, padding: '7px 14px', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: '#555' }}>
              <Icon icon="lucide:arrow-left" width={14} /> Volver
            </button>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#1a1a1a' }}>{curso?.nombre || '...'}</div>
              {curso?.area && <div style={{ fontSize: 12, color: '#888', marginTop: 1 }}>{curso.area}</div>}
            </div>
            {curso && !bloqueadoHasta && (
              <button onClick={async () => {
                if (!confirm('¿Marcar este curso como completado? (solo para pruebas)')) return
                try {
                  await api.patch(`/cursos/${cursoId}/progreso`, { porcentaje: 100, es_evaluacion: true })
                  const total = curso.preguntas?.length || 0
                  setResultado({ score: 100, correctas: total, total, aprobado: true })
                  setPaso('evaluacion')
                  localStorage.setItem(`curso_${userId}_${cursoId}_completados`, JSON.stringify((curso.modulos || []).map(m => m.id)))
                } catch (e) { alert('Error: ' + (e?.response?.data?.error || e?.message)) }
              }} style={{ fontSize: 11, padding: '5px 12px', borderRadius: 6, border: '1px dashed #F5A623', background: '#FFF8E8', color: '#B45309', cursor: 'pointer', flexShrink: 0, fontWeight: 500 }}>
                ⚡ Completar (test)
              </button>
            )}
          </div>

          {cargando ? (
            <div style={{ textAlign: 'center', color: '#888', padding: 60 }}>Cargando curso...</div>
          ) : bloqueadoHasta ? (
            /* ── CURSO BLOQUEADO ── */
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div style={{ background: '#fff', borderRadius: 16, padding: '48px 40px', maxWidth: 480, width: '100%', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <Icon icon="lucide:lock" width={56} style={{color:'#E8505B'}} />
                <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1a1a' }}>Curso temporalmente bloqueado</div>
                <div style={{ fontSize: 14, color: '#555', lineHeight: 1.6 }}>
                  Has fallado este curso 2 veces. Podrás intentarlo nuevamente el{' '}
                  <strong>{bloqueadoHasta.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>.
                </div>
                <div style={{ background: '#FFF5F5', border: '1px solid #FECACA', borderRadius: 12, padding: '14px 24px', fontSize: 13, color: '#B91C1C', maxWidth: 360 }}>
                  Tu administrador de sede ha sido notificado. Aprovecha este tiempo para repasar los contenidos.
                </div>
                <button onClick={() => navigate(-1)}
                  style={{ background: '#1E3A6E', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 28px', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginTop: 8 }}>
                  Volver
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>

              {/* Panel principal */}
              <div style={{ flex: 1, minWidth: 0 }}>

                {/* Tabs de pasos */}
                <div style={{ background: '#fff', borderRadius: 12, padding: '16px 20px 0', marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  {/* Barra de progreso */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                    <div style={{ flex: 1, height: 6, background: '#F0F0F0', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${progreso}%`, background: progreso >= 100 ? '#22C55E' : '#2B4BA0', borderRadius: 3, transition: 'width 0.4s' }} />
                    </div>
                    <span style={{ fontSize: 12, color: '#888', flexShrink: 0 }}>{progreso}%</span>
                  </div>

                  {/* Pasos */}
                  <div style={{ display: 'flex', gap: 0, borderTop: '0.5px solid #F0F0F0', marginTop: 4 }}>
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
                            padding: '10px 18px', fontSize: 13,
                            fontWeight: activo ? 600 : 400,
                            color: bloqueado ? '#ccc' : activo ? '#2B4BA0' : hecho ? '#22C55E' : '#888',
                            borderBottom: activo ? '2px solid #2B4BA0' : hecho ? '2px solid #22C55E' : '2px solid transparent',
                            display: 'flex', alignItems: 'center', gap: 5
                          }}>
                          {hecho && <Icon icon="lucide:check" width={11} />}
                          {p.label}
                          {bloqueado && <Icon icon="lucide:lock" width={11} />}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Contenido del paso */}
                <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>

                  {paso === 'video' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <div style={{ fontSize: 13, color: '#555', fontWeight: 500 }}>
                        Mira el video introductorio antes de comenzar los módulos.
                      </div>
                      <video
                        ref={videoRef}
                        controls
                        style={{ width: '100%', borderRadius: 12, background: '#000', maxHeight: 480 }}
                        onEnded={() => setVideoVisto(true)}
                      >
                        <source src={fileUrl(curso.video_intro_url)} type="video/mp4" />
                        <source src={fileUrl(curso.video_intro_url)} type="video/webm" />
                      </video>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: '#888' }}>
                          {videoVisto
                            ? <><Icon icon="lucide:check" width={13} style={{verticalAlign:'middle',marginRight:3,color:'#16A34A'}} /> Video completado</>
                            : 'El video debe terminar para continuar.'}
                        </span>
                        <button
                          onClick={() => {
                            setVideoVisto(true)
                            setPaso('modulos')
                            api.patch(`/cursos/${cursoId}/progreso`, { porcentaje: 1 })
                              .catch(err => console.error('[progreso video]', err?.response?.data || err?.message))
                          }}
                          disabled={!videoVisto}
                          style={{
                            background: videoVisto ? '#2B4BA0' : '#ccc', color: '#fff', border: 'none',
                            borderRadius: 10, padding: '10px 24px', fontSize: 13, fontWeight: 600,
                            cursor: videoVisto ? 'pointer' : 'not-allowed'
                          }}>
                          <>Comenzar módulos <Icon icon="lucide:arrow-right" width={13} style={{verticalAlign:'middle',marginLeft:4}} /></>
                        </button>
                      </div>
                    </div>
                  )}

                  {paso === 'modulos' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                      {!curso?.modulos?.length ? (
                        <div style={{ textAlign: 'center', color: '#888', padding: 32 }}>No hay módulos en este curso.</div>
                      ) : (
                        <>
                          {/* ── Pestañas de módulos ── */}
                          <div style={{
                            display: 'flex', overflowX: 'auto', gap: 0,
                            borderBottom: '1.5px solid #F0F0F0', marginBottom: 20,
                            scrollbarWidth: 'none'
                          }}>
                            {curso.modulos.map((mod, i) => {
                              const completo = completados.has(mod.id)
                              const activo = moduloActivo === mod.id
                              return (
                                <button key={mod.id}
                                  onClick={() => { setModuloActivo(mod.id); setSlideActual(0) }}
                                  style={{
                                    flexShrink: 0, background: 'none', border: 'none',
                                    padding: '10px 16px', cursor: 'pointer',
                                    borderBottom: activo ? '2px solid #2B4BA0' : completo ? '2px solid #22C55E' : '2px solid transparent',
                                    display: 'flex', alignItems: 'center', gap: 7,
                                    color: activo ? '#2B4BA0' : completo ? '#16A34A' : '#666',
                                    fontWeight: activo ? 600 : 400, fontSize: 13,
                                    maxWidth: 200, marginBottom: -1.5,
                                    whiteSpace: 'nowrap'
                                  }}>
                                  <span style={{
                                    width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                                    background: activo ? '#2B4BA0' : completo ? '#22C55E' : '#E8E8E8',
                                    color: activo || completo ? '#fff' : '#888',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 10, fontWeight: 700
                                  }}>
                                    {completo ? <Icon icon="lucide:check" width={10} /> : i + 1}
                                  </span>
                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>
                                    {mod.titulo}
                                  </span>
                                </button>
                              )
                            })}
                          </div>

                          {/* ── Contenido del módulo activo ── */}
                          {(() => {
                            const mod = curso.modulos.find(m => m.id === moduloActivo)
                            if (!mod) return null
                            const completo = completados.has(mod.id)
                            const i = curso.modulos.indexOf(mod)
                            return (
                              <div>
                                {/* Cabecera del módulo */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                                  <div style={{
                                    width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                                    background: completo ? '#DCFCE7' : '#EEF2FF',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                  }}>
                                    {completo
                                      ? <Icon icon="lucide:check" color="#16A34A" width={16} />
                                      : mod.tipo === 'video'
                                        ? <Icon icon="lucide:video" width={16} style={{color:'#2B4BA0'}} />
                                        : mod.tipo === 'pdf'
                                          ? <Icon icon="lucide:file-text" width={16} style={{color:'#E8505B'}} />
                                          : <Icon icon="lucide:presentation" width={16} style={{color:'#888'}} />}
                                  </div>
                                  <div>
                                    <div style={{ fontSize: 14, fontWeight: 600, color: completo ? '#15803D' : '#1a1a1a' }}>
                                      {i + 1}. {mod.titulo}
                                    </div>
                                    {mod.descripcion && <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{mod.descripcion}</div>}
                                  </div>
                                  {completo && (
                                    <span style={{ marginLeft: 'auto', fontSize: 12, color: '#16A34A', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, padding: '4px 10px' }}>
                                      <Icon icon="lucide:check" width={12} /> Completado
                                    </span>
                                  )}
                                </div>

                                {/* Contenido */}
                                {completo ? (
                                  <div style={{ textAlign: 'center', padding: '32px 16px', color: '#16A34A' }}>
                                    <Icon icon="lucide:check-circle" width={40} style={{marginBottom:8,display:'block',margin:'0 auto 12px'}} />
                                    <div style={{ fontSize: 14, fontWeight: 500 }}>Módulo completado</div>
                                    {i + 1 < curso.modulos.length && (
                                      <button onClick={() => { setModuloActivo(curso.modulos[i + 1].id); setSlideActual(0) }}
                                        style={{ marginTop: 14, background: '#2B4BA0', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 22px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                                        <>Siguiente módulo <Icon icon="lucide:arrow-right" width={13} style={{verticalAlign:'middle',marginLeft:4}} /></>
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  renderContenidoModulo(mod)
                                )}

                                {/* ── Sección de comentarios del módulo ─────── */}
                                {(() => {
                                  const coms = comentariosPorModulo[mod.id] || []
                                  const raices = coms.filter(c => !c.parent_id)
                                  const respuestasDe = (parentId) => coms.filter(c => c.parent_id === parentId)
                                  const textoInput = textoPorModulo[mod.id] || ''
                                  const enviando = !!enviandoCom[mod.id]
                                  const replyParent = replyingTo[mod.id] || null
                                  const textoReply = replyTexto[mod.id] || ''

                                  const fmtFecha = (iso) => {
                                    const d = new Date(iso)
                                    return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' }) +
                                      ' ' + d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
                                  }

                                  return (
                                    <div style={{ marginTop: 28, borderTop: '0.5px solid #F0F0F0', paddingTop: 20 }}>
                                      <div style={{ fontSize: 13, fontWeight: 600, color: '#444', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <Icon icon="lucide:message-circle" width={15} style={{color:'#2B4BA0'}} />
                                        Preguntas y comentarios
                                        {coms.length > 0 && (
                                          <span style={{ fontSize: 11, background: '#EEF2FF', color: '#2B4BA0', borderRadius: 10, padding: '2px 8px', fontWeight: 600 }}>
                                            {coms.length}
                                          </span>
                                        )}
                                      </div>

                                      {/* Lista de comentarios raíz */}
                                      {raices.length === 0 && (
                                        <div style={{ fontSize: 12, color: '#aaa', marginBottom: 14 }}>
                                          Sé el primero en preguntar o comentar sobre este módulo.
                                        </div>
                                      )}
                                      {raices.map(com => (
                                        <div key={com.id} style={{ marginBottom: 14 }}>
                                          {/* Comentario raíz */}
                                          <div style={{ background: '#F9FAFB', border: '0.5px solid #E8E8E8', borderRadius: 10, padding: '10px 14px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                              <span style={{ fontSize: 12, fontWeight: 600, color: '#333' }}>{com.autor_nombre}</span>
                                              <span style={{ fontSize: 11, color: '#aaa' }}>{fmtFecha(com.creado_en)}</span>
                                            </div>
                                            <div style={{ fontSize: 13, color: '#444', lineHeight: 1.6, wordBreak: 'break-word' }}>{com.texto}</div>
                                            <button
                                              onClick={() => setReplyingTo(prev => ({ ...prev, [mod.id]: prev[mod.id] === com.id ? null : com.id }))}
                                              style={{ marginTop: 6, background: 'none', border: 'none', fontSize: 11, color: '#2B4BA0', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                                              <Icon icon="lucide:corner-down-right" width={11} /> Responder
                                            </button>
                                          </div>

                                          {/* Respuestas hijas */}
                                          {respuestasDe(com.id).map(rep => (
                                            <div key={rep.id} style={{ marginLeft: 24, marginTop: 6, background: '#fff', border: '0.5px solid #E8E8E8', borderRadius: 10, padding: '8px 12px' }}>
                                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                                <span style={{ fontSize: 12, fontWeight: 600, color: '#333' }}>{rep.autor_nombre}</span>
                                                <span style={{ fontSize: 11, color: '#aaa' }}>{fmtFecha(rep.creado_en)}</span>
                                              </div>
                                              <div style={{ fontSize: 13, color: '#444', lineHeight: 1.6, wordBreak: 'break-word' }}>{rep.texto}</div>
                                            </div>
                                          ))}

                                          {/* Caja de respuesta */}
                                          {replyParent === com.id && (
                                            <div style={{ marginLeft: 24, marginTop: 6, display: 'flex', gap: 8 }}>
                                              <textarea
                                                value={textoReply}
                                                onChange={e => setReplyTexto(prev => ({ ...prev, [mod.id]: e.target.value }))}
                                                placeholder="Escribe una respuesta..."
                                                rows={2}
                                                style={{ flex: 1, resize: 'vertical', borderRadius: 8, border: '1px solid #D0D5DD', padding: '8px 10px', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
                                              />
                                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                <button
                                                  onClick={() => enviarComentario(mod.id, textoReply, com.id)}
                                                  disabled={!textoReply.trim() || enviando}
                                                  style={{ background: '#2B4BA0', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: textoReply.trim() ? 'pointer' : 'not-allowed', opacity: textoReply.trim() ? 1 : 0.5 }}>
                                                  {enviando ? '...' : 'Enviar'}
                                                </button>
                                                <button
                                                  onClick={() => setReplyingTo(prev => ({ ...prev, [mod.id]: null }))}
                                                  style={{ background: '#F4F5F7', color: '#555', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>
                                                  Cancelar
                                                </button>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      ))}

                                      {/* Nueva pregunta / comentario raíz */}
                                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                        <textarea
                                          value={textoInput}
                                          onChange={e => setTextoPorModulo(prev => ({ ...prev, [mod.id]: e.target.value }))}
                                          placeholder="Escribe una pregunta o comentario sobre este módulo..."
                                          rows={2}
                                          style={{ flex: 1, resize: 'vertical', borderRadius: 8, border: '1px solid #D0D5DD', padding: '8px 10px', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
                                        />
                                        <button
                                          onClick={() => enviarComentario(mod.id, textoInput, null)}
                                          disabled={!textoInput.trim() || enviando}
                                          style={{ alignSelf: 'flex-end', background: '#2B4BA0', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: textoInput.trim() ? 'pointer' : 'not-allowed', opacity: textoInput.trim() ? 1 : 0.5, whiteSpace: 'nowrap' }}>
                                          <Icon icon="lucide:send" width={14} style={{verticalAlign:'middle',marginRight:4}} />
                                          {enviando ? 'Enviando...' : 'Comentar'}
                                        </button>
                                      </div>
                                    </div>
                                  )
                                })()}
                              </div>
                            )
                          })()}

                          {/* Botón ir a evaluación */}
                          {curso?.preguntas?.length > 0 && (
                            <div style={{ textAlign: 'center', marginTop: 24, paddingTop: 20, borderTop: '0.5px solid #F0F0F0' }}>
                              {todosModulosCompletos ? (
                                <button onClick={() => setPaso('evaluacion')} style={{
                                  background: '#2B4BA0', color: '#fff', border: 'none', borderRadius: 10,
                                  padding: '11px 28px', fontSize: 13, fontWeight: 600, cursor: 'pointer'
                                }}>
                                  <>Ir a la evaluación <Icon icon="lucide:arrow-right" width={13} style={{verticalAlign:'middle',marginLeft:4}} /></>
                                </button>
                              ) : (
                                <div style={{ fontSize: 12, color: '#888', background: '#F9F9F9', borderRadius: 10, padding: '10px 20px', display: 'inline-block' }}>
                                  <><Icon icon="lucide:lock" width={12} style={{verticalAlign:'middle',marginRight:3}} /> Completa todos los módulos para acceder a la evaluación</>
                                  {' '}({completados.size}/{curso.modulos.length} completados)
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {paso === 'evaluacion' && (
                    <div>
                      {resultado ? (
                        <div style={{ textAlign: 'center', padding: '32px 16px' }}>
                          {resultado.aprobado ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                              <Icon icon="lucide:trophy" width={64} style={{color:'#F5A623'}} />
                              <div style={{ fontSize: 22, fontWeight: 700, color: '#15803D' }}>¡Curso finalizado!</div>
                              <div style={{ fontSize: 14, color: '#555' }}>{curso?.nombre}</div>
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
                                <><Icon icon="lucide:check" width={13} style={{verticalAlign:'middle',marginRight:4}} /> Tu progreso ha sido registrado</>
                              </div>
                              {esperandoPractico ? (
                                <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 10, padding: '10px 16px', fontSize: 13, color: '#C2410C', display: 'flex', alignItems: 'center', gap: 8, maxWidth: 340, width: '100%' }}>
                                  <Icon icon="lucide:clock" width={16} style={{flexShrink:0}} />
                                  Has aprobado la evaluación. Falta asistir al práctico para certificarte.
                                </div>
                              ) : certificadoUrl ? (
                                <a href={certificadoUrl} target="_blank" rel="noreferrer"
                                  style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#15803D', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 32px', fontSize: 14, fontWeight: 600, cursor: 'pointer', textDecoration: 'none' }}>
                                  <Icon icon="lucide:download" width={16} />
                                  Descargar certificado
                                </a>
                              ) : certError ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                                  <div style={{ fontSize: 12, color: '#E8505B', background: '#FFF5F5', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 16px', maxWidth: 340, wordBreak: 'break-word' }}>
                                    Error: {certError}
                                  </div>
                                  <button onClick={() => { setCertError(null); setCertificadoUrl(null) }}
                                    style={{ fontSize: 12, color: '#2B4BA0', background: 'none', border: '1px solid #2B4BA0', borderRadius: 8, padding: '6px 16px', cursor: 'pointer' }}>
                                    Reintentar
                                  </button>
                                </div>
                              ) : (
                                <div style={{ fontSize: 12, color: '#888', display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <Icon icon="lucide:loader-2" width={13} style={{ animation: 'spin 1s linear infinite' }} />
                                  Generando certificado...
                                </div>
                              )}
                              <button onClick={() => navigate(-1)}
                                style={{ background: '#2B4BA0', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 32px', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 4 }}>
                                Volver a capacitaciones
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                              <Icon icon="lucide:frown" width={56} style={{color:'#E8505B'}} />
                              <div style={{ fontSize: 18, fontWeight: 600 }}>No aprobaste esta vez</div>
                              <div style={{ background: '#FFF5F5', border: '1px solid #FECACA', borderRadius: 14, padding: '20px 32px', width: '100%', maxWidth: 320 }}>
                                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: '#E8505B', letterSpacing: '0.08em', marginBottom: 6 }}>Tu puntaje</div>
                                <div style={{ fontSize: 44, fontWeight: 800, color: '#E8505B', lineHeight: 1 }}>{resultado.score}%</div>
                                <div style={{ fontSize: 13, color: '#888', marginTop: 6 }}>
                                  {resultado.correctas} de {resultado.total} correctas · Necesitas 60% para aprobar
                                </div>
                              </div>
                              <div style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                background: intentosRestantes <= 0 ? '#FFF5F5' : '#F9F9F9',
                                border: `1px solid ${intentosRestantes <= 0 ? '#FECACA' : '#E8E8E8'}`,
                                borderRadius: 10, padding: '10px 20px', fontSize: 13
                              }}>
                                <Icon icon="lucide:refresh-cw" width={14} style={{color: intentosRestantes <= 0 ? '#E8505B' : '#888'}} />
                                <span style={{ color: intentosRestantes <= 0 ? '#E8505B' : '#555', fontWeight: intentosRestantes <= 0 ? 600 : 400 }}>
                                  Intentos restantes: <strong>{intentosRestantes}/2</strong>
                                </span>
                              </div>
                              {intentosRestantes <= 0 ? (
                                <div style={{ fontSize: 13, color: '#E8505B', textAlign: 'center', maxWidth: 300 }}>
                                  Has agotado tus intentos. El curso quedará bloqueado por 7 días.
                                </div>
                              ) : (
                                <button onClick={() => { setResultado(null); setRespuestas({}) }}
                                  style={{ background: '#2B4BA0', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 28px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                                  Intentar nuevamente
                                </button>
                              )}
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

              {/* Panel lateral: info del curso */}
              <div style={{ width: 260, flexShrink: 0 }}>
                <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>Información del curso</div>
                  {curso?.profesor_nombre && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                      <Icon icon="lucide:user" width={14} style={{color:'#888',flexShrink:0}} />
                      <span style={{ fontSize: 12, color: '#555' }}>Prof. {curso.profesor_nombre}</span>
                    </div>
                  )}
                  {curso?.area && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                      <Icon icon="lucide:tag" width={14} style={{color:'#888',flexShrink:0}} />
                      <span style={{ fontSize: 12, color: '#555' }}>{curso.area}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                    <Icon icon="lucide:layers" width={14} style={{color:'#888',flexShrink:0}} />
                    <span style={{ fontSize: 12, color: '#555' }}>{curso?.modulos?.length || 0} módulo{curso?.modulos?.length !== 1 ? 's' : ''}</span>
                  </div>
                  {curso?.preguntas?.length > 0 && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                      <Icon icon="lucide:help-circle" width={14} style={{color:'#888',flexShrink:0}} />
                      <span style={{ fontSize: 12, color: '#555' }}>{curso.preguntas.length} preguntas de evaluación</span>
                    </div>
                  )}

                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: '0.5px solid #F0F0F0' }}>
                    <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>Tu progreso</div>
                    <div style={{ height: 6, background: '#F0F0F0', borderRadius: 3, overflow: 'hidden', marginBottom: 4 }}>
                      <div style={{ height: '100%', width: `${progreso}%`, background: progreso >= 100 ? '#22C55E' : '#2B4BA0', borderRadius: 3, transition: 'width 0.4s' }} />
                    </div>
                    <div style={{ fontSize: 12, color: progreso >= 100 ? '#16A34A' : '#555', fontWeight: 500 }}>{progreso}% completado</div>
                  </div>
                  {esperandoPractico && !resultado && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '0.5px solid #F0F0F0', background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#C2410C', display: 'flex', alignItems: 'flex-start', gap: 7 }}>
                      <Icon icon="lucide:clock" width={14} style={{flexShrink:0, marginTop:1}} />
                      <span>Has aprobado la evaluación. Falta asistir al práctico para certificarte.</span>
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}
        </main>
      </div>
    </div>
  )
}
