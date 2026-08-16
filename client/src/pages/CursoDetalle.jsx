import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Icon } from '@iconify/react'
import Topbar from '../components/Topbar'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import CursoBloqueado from '../components/CursoBloqueado'
import api from '../services/api'
import TabVideoIntro from '../components/curso-detalle/TabVideoIntro'
import TabModulos from '../components/curso-detalle/TabModulos'
import TabEvaluacion from '../components/curso-detalle/TabEvaluacion'
import PanelInfoCurso from '../components/curso-detalle/PanelInfoCurso'

export default function CursoDetalle() {
  const { id: cursoId } = useParams()
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const userId = usuario?.id
  const toast = useToast()

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
  // Certificado de este curso, para cerrarle el ciclo al colaborador en la
  // misma pantalla en vez de mandarlo a buscarlo a "Mis certificados".
  const [certificado, setCertificado] = useState(null)
  const [buscandoCert, setBuscandoCert] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [bloqueadoHasta, setBloqueadoHasta] = useState(null)
  const [intentosRestantes, setIntentosRestantes] = useState(2)
  const [signedUrls, setSignedUrls] = useState({})
  const [videoIntroUrl, setVideoIntroUrl] = useState('')
  const [generandoPPT, setGenerandoPPT] = useState({})
  const [esperandoPractico, setEsperandoPractico] = useState(false)
  const videoRef = useRef(null)

  // ── Comentarios por módulo ──────────────────────────────────────────────────
  const [comentariosPorModulo, setComentariosPorModulo] = useState({})
  const [textoPorModulo, setTextoPorModulo] = useState({})
  const [replyingTo, setReplyingTo] = useState({})   // moduloId → comentarioId | null
  const [replyTexto, setReplyTexto] = useState({})   // moduloId → string
  const [enviandoCom, setEnviandoCom] = useState({}) // moduloId → bool

  // Obtener URL firmada para el video intro cuando el curso carga
  useEffect(() => {
    if (!curso?.video_intro_url || !cursoId) return
    api.get(`/cursos/${cursoId}/video-intro/signed-url`)
      .then(r => setVideoIntroUrl(r.data.url))
      .catch(err => console.error('[video-intro signed-url] error:', err?.response?.data || err?.message))
  }, [curso?.video_intro_url, cursoId])

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
    if (slides.length > 0 || generandoPPT[moduloActivo] || mod.archivo_url) return

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

        const claveBloqueo = `curso_${userId}_${cursoId}_bloqueo`
        const localBloqueoRaw = localStorage.getItem(claveBloqueo)
        let localBloqueo = localBloqueoRaw ? JSON.parse(localBloqueoRaw) : null

        setEsperandoPractico(!!progresoRes.data?.esperando_practico)

        const intentosFallidosDB = parseInt(progresoRes.data?.intentos_fallidos || 0, 10)
        const bhDB = progresoRes.data?.bloqueado_hasta || null

        // La base manda. Antes se tomaba el máximo entre servidor y localStorage,
        // así que cuando un profesor desbloqueaba a alguien el bloqueo seguía vivo
        // en el navegador del colaborador y no había forma de sacarlo: el máximo
        // de "0 intentos" y "2 intentos" siempre da 2. El cache local solo sirve
        // para que el bloqueo no se pierda si falla la escritura al servidor,
        // nunca para resucitar uno que el servidor ya levantó.
        if (progresoRes.data && !bhDB && intentosFallidosDB === 0) {
          localStorage.removeItem(claveBloqueo)
          localBloqueo = null
        }

        const intentosFallidosLocal = parseInt(localBloqueo?.intentos_fallidos || 0, 10)
        const intentosFallidos = Math.max(intentosFallidosDB, intentosFallidosLocal)
        setIntentosRestantes(Math.max(0, 2 - intentosFallidos))

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
              setResultado({ score: 100, notaChilena: 7, correctas: totalPreg, total: totalPreg, aprobado: true })
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
              setResultado({ score: 100, notaChilena: 7, correctas: totalPreg, total: totalPreg, aprobado: true })
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

  // Al aprobar, buscar el certificado de este curso. El backend lo crea en
  // estado 'pendiente' hasta que un profesor lo valida, así que la pantalla de
  // cierre tiene que distinguir "ya descargable" de "en revisión": decir solo
  // "curso finalizado" dejaba al colaborador sin saber si le faltaba algo.
  useEffect(() => {
    if (!resultado?.aprobado || !cursoId) return
    setBuscandoCert(true)
    api.get('/certificados')
      .then(r => {
        const lista = r.data || []
        // Preferimos curso_id: dos cursos pueden llamarse igual y el
        // colaborador se descargaría el certificado equivocado. Pero el
        // servidor solo lo devuelve desde el cambio de esta rama, así que
        // contra un backend anterior se cae al nombre en vez de no mostrar nada.
        const porId = lista.find(c => c.curso_id != null && String(c.curso_id) === String(cursoId))
        const propio = porId || lista.find(c => c.curso_nombre === curso?.nombre)
        setCertificado(propio || null)
      })
      .catch(() => setCertificado(null))
      .finally(() => setBuscandoCert(false))
  }, [resultado?.aprobado, cursoId, curso?.nombre])

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
      const { nota: score, nota_chilena: notaChilena, aprobado, numero_intento, doble_fallo, bloqueado_hasta: bh, esperando_practico } = data

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

      setResultado({ score, notaChilena, correctas, total: curso.preguntas.length, aprobado })
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
      } else if (err?.response?.status === 403) {
        toast.error('No tienes permisos para rendir esta evaluación.')
      } else {
        console.error('[evaluacion]', err?.response?.data || err?.message)
        toast.error('No pudimos enviar tu evaluación. Revisa tu conexión e inténtalo otra vez; si el problema sigue, avisa a tu administrador de sede.')
      }
    } finally {
      setEnviando(false)
    }
  }

  // ─── pasos indicator ─────────────────────────────────────────────────────────
  const pasos = [
    ...(curso?.video_intro_url ? [{ key: 'video', label: 'Video intro' }] : []),
    { key: 'modulos', label: 'Módulos' },
    ...(curso?.preguntas?.length > 0 ? [{ key: 'evaluacion', label: 'Evaluación' }] : []),
  ]
  const pasoIdx = pasos.findIndex(p => p.key === paso)

  return (
    <div className="app-shell">
      <Topbar seccion="Capacitación" />
      <div className="app-body">
        <Sidebar />
        <main className="main-content" style={{ background: 'var(--cd-page-bg)', padding: '24px 32px' }}>

          {/* Breadcrumb (Fase 2 del plan). El botón "Volver" usa el historial,
              que se rompe si se llega por enlace directo o tras recargar; el
              breadcrumb siempre apunta a la ruta real del listado. */}
          <nav aria-label="Ruta de navegación" style={{ marginBottom: 10 }}>
            <ol style={{ listStyle: 'none', display: 'flex', alignItems: 'center', gap: 6, margin: 0, padding: 0, fontSize: 12, flexWrap: 'wrap' }}>
              <li>
                <Link to="/capacitaciones" style={{ color: 'var(--azul)' }}>Capacitaciones</Link>
              </li>
              <li aria-hidden="true" style={{ color: 'var(--cd-text-muted)', display: 'flex' }}>
                <Icon icon="lucide:chevron-right" width={13} />
              </li>
              <li aria-current="page" style={{ color: 'var(--cd-text-sec)' }}>
                {curso?.nombre || 'Curso'}
              </li>
            </ol>
          </nav>

          {/* Encabezado con botón volver */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <button onClick={() => navigate('/capacitaciones')}
              style={{ background: 'var(--cd-card-bg)', border: '0.5px solid var(--cd-border)', borderRadius: 8, padding: '7px 14px', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--cd-text-sec)' }}>
              <Icon icon="lucide:arrow-left" width={14} /> Volver
            </button>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--cd-text)' }}>{curso?.nombre || '...'}</div>
              {curso?.area && <div style={{ fontSize: 12, color: 'var(--cd-text-muted)', marginTop: 1 }}>{curso.area}</div>}
            </div>
          </div>

          {cargando ? (
            <div style={{ textAlign: 'center', color: 'var(--cd-text-muted)', padding: 60 }}>Cargando curso...</div>
          ) : bloqueadoHasta ? (
            <CursoBloqueado fechaDesbloqueo={bloqueadoHasta} />
          ) : (
            <div className="curso-layout">

              {/* Panel principal */}
              <div style={{ flex: 1, minWidth: 0 }}>

                {/* Tabs de pasos */}
                <div style={{ background: 'var(--cd-card-bg)', borderRadius: 12, padding: '16px 20px 0', marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  {/* Barra de progreso */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                    <div style={{ flex: 1, height: 6, background: 'var(--cd-border-light)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${progreso}%`, background: progreso >= 100 ? 'var(--success)' : 'var(--azul)', borderRadius: 3, transition: 'width 0.4s' }} />
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--cd-text-muted)', flexShrink: 0 }}>{progreso}%</span>
                  </div>

                  {/* Pasos */}
                  <div style={{ display: 'flex', gap: 0, borderTop: '0.5px solid var(--cd-border-light)', marginTop: 4 }}>
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
                            color: bloqueado ? '#ccc' : activo ? 'var(--azul)' : hecho ? 'var(--success)' : 'var(--cd-text-muted)',
                            borderBottom: activo ? '2px solid var(--azul)' : hecho ? '2px solid var(--success)' : '2px solid transparent',
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
                <div style={{ background: 'var(--cd-card-bg)', borderRadius: 12, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>

                  {paso === 'video' && (
                    <TabVideoIntro
                      videoIntroUrl={videoIntroUrl} videoVisto={videoVisto} videoRef={videoRef}
                      onVideoEnded={() => setVideoVisto(true)}
                      onComenzarModulos={() => {
                        setVideoVisto(true)
                        setPaso('modulos')
                        api.patch(`/cursos/${cursoId}/progreso`, { porcentaje: 1 })
                          .catch(err => console.error('[progreso video]', err?.response?.data || err?.message))
                      }}
                    />
                  )}

                  {paso === 'modulos' && (
                    <TabModulos
                      modulos={curso?.modulos} moduloActivo={moduloActivo} onSetModuloActivo={setModuloActivo}
                      completados={completados} slideActual={slideActual} onSetSlideActual={setSlideActual}
                      signedUrls={signedUrls} onMarcarCompleto={marcarCompleto}
                      comentariosPorModulo={comentariosPorModulo} textoPorModulo={textoPorModulo}
                      onChangeTexto={(modId, val) => setTextoPorModulo(prev => ({ ...prev, [modId]: val }))}
                      replyingTo={replyingTo} replyTexto={replyTexto}
                      onChangeReplyTexto={(modId, val) => setReplyTexto(prev => ({ ...prev, [modId]: val }))}
                      onToggleReply={(modId, comId) => setReplyingTo(prev => ({ ...prev, [modId]: prev[modId] === comId ? null : comId }))}
                      enviandoCom={enviandoCom} onEnviarComentario={enviarComentario}
                      todosModulosCompletos={todosModulosCompletos} tienePreguntas={curso?.preguntas?.length > 0}
                      onIrEvaluacion={() => setPaso('evaluacion')}
                    />
                  )}

                  {paso === 'evaluacion' && (
                    <TabEvaluacion
                      curso={curso} resultado={resultado} respuestas={respuestas}
                      onChangeRespuesta={(pregId, idx) => setRespuestas(prev => ({ ...prev, [pregId]: idx }))}
                      todosRespondidos={todosRespondidos} enviando={enviando} onEnviarEvaluacion={enviarEvaluacion}
                      intentosRestantes={intentosRestantes} esperandoPractico={esperandoPractico}
                      buscandoCert={buscandoCert} certificado={certificado}
                      onIntentarNuevamente={() => { setResultado(null); setRespuestas({}) }}
                      onVolverCapacitaciones={() => navigate('/capacitaciones')}
                    />
                  )}

                </div>
              </div>

              <PanelInfoCurso curso={curso} progreso={progreso} esperandoPractico={esperandoPractico} resultado={resultado} />

            </div>
          )}
        </main>
      </div>
    </div>
  )
}
