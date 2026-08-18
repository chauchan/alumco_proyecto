import { useState, useEffect } from 'react'
import { Icon } from '@iconify/react'
import api from '../services/api'
import { useToast } from '../context/ToastContext'
import { useConfirm } from '../context/ConfirmContext'
import TabModulos from './curso-profesor/TabModulos'
import TabPreguntas from './curso-profesor/TabPreguntas'
import TabPresentacionPPT from './curso-profesor/TabPresentacionPPT'
import TabAudiencia from './curso-profesor/TabAudiencia'
import TabVideoIntro from './curso-profesor/TabVideoIntro'

const TABS = [['modulos','Módulos'],['preguntas','Preguntas'],['ppt','Presentación PPT'],['audiencia','Audiencia'],['video','Video Intro']]

// Modal de detalle/validación de un curso desde el panel del profesor: ver y
// editar módulos, preguntas, presentación PPT, audiencia (sede/estamentos) y
// video intro, más aprobar/publicar/despublicar/eliminar. Recibe solo el
// resumen del curso (de la lista) y hace su propio fetch al abrirse — todo lo
// demás (una pestaña por concern) vive en components/curso-profesor/.
export default function ModalDetalleCursoProfesor({ cursoResumen, usuario, onClose, onCambioEstado }) {
  const toast = useToast()
  const confirm = useConfirm()
  const [cursoDetalle, setCursoDetalle] = useState(null)
  const [tabDetalle, setTabDetalle] = useState('modulos')
  const [pregExpandida, setPregExpandida] = useState(null)

  const [pptModuloIdx, setPptModuloIdx] = useState(null)
  const [pptPresentaciones, setPptPresentaciones] = useState({})
  const [pptSlide, setPptSlide] = useState(0)
  const [pptEditando, setPptEditando] = useState(false)
  const [pptEditData, setPptEditData] = useState({})
  const [pptGuardando, setPptGuardando] = useState(false)

  const [targeting, setTargeting] = useState({ estamento_objetivo: null, sede_objetivo: null, obligatorio: false })
  const [guardandoTargeting, setGuardandoTargeting] = useState(false)

  const [editandoModulos, setEditandoModulos] = useState(false)
  const [modulosEdit, setModulosEdit] = useState([])
  const [guardandoModulos, setGuardandoModulos] = useState(false)

  const [editandoPreguntas, setEditandoPreguntas] = useState(false)
  const [preguntasEdit, setPreguntasEdit] = useState([])
  const [deletedPregIds, setDeletedPregIds] = useState([])
  const [guardandoPreguntas, setGuardandoPreguntas] = useState(false)

  const [videoIntroUrl, setVideoIntroUrl] = useState(null)
  const [subiendoVideo, setSubiendoVideo] = useState(false)
  const [eliminandoVideo, setEliminandoVideo] = useState(false)

  useEffect(() => {
    let cancelado = false
    api.get(`/cursos/${cursoResumen.id}`).then(async detalle => {
      if (cancelado) return
      const d = detalle.data
      setCursoDetalle({ ...cursoResumen, modulos: d.modulos, preguntas: d.preguntas, imagenes_protocolo: d.imagenes_protocolo || [], video_intro_url: d.video_intro_url || null })

      const rawEst = d.estamento_objetivo
      let parsedEst = null
      if (rawEst) {
        try { parsedEst = typeof rawEst === 'string' ? JSON.parse(rawEst) : rawEst }
        catch { parsedEst = [rawEst] }
      }
      setTargeting({ estamento_objetivo: parsedEst, sede_objetivo: d.sede_objetivo || null, obligatorio: !!d.obligatorio })

      if (d.video_intro_url) {
        try {
          const r = await api.get(`/cursos/${cursoResumen.id}/video-intro/signed-url`)
          if (!cancelado) setVideoIntroUrl(r.data.url)
        } catch (e) {
          console.error('[video-intro signed-url]', e?.response?.data || e?.message)
        }
      }

      const presMap = {}
      ;(d.modulos || []).forEach((mod, i) => {
        if (!mod.contenido_presentacion) return
        let cp = mod.contenido_presentacion
        if (typeof cp === 'string') { try { cp = JSON.parse(cp) } catch { return } }
        const slides = Array.isArray(cp) ? cp : Array.isArray(cp?.diapositivas) ? cp.diapositivas : []
        if (slides.length > 0) presMap[i] = { diapositivas: slides }
      })
      if (Object.keys(presMap).length > 0) setPptPresentaciones(presMap)
    }).catch(err => {
      if (cancelado) return
      console.error('[ModalDetalleCursoProfesor]', err)
      const detalle = err?.response?.data?.error || err?.response?.data?.detalle || err?.message || 'Error desconocido'
      toast.error(`No se pudo cargar el curso: ${detalle}`)
      onClose()
    })
    return () => { cancelado = true }
  }, [cursoResumen.id])

  const abrirPPTModulo = async (mod, idx) => {
    setPptModuloIdx(idx)
    setPptSlide(0)
    if (pptPresentaciones[idx]) return

    if (mod.contenido_presentacion) {
      let cp = mod.contenido_presentacion
      if (typeof cp === 'string') { try { cp = JSON.parse(cp) } catch { cp = null } }
      if (cp) {
        const diapositivas = Array.isArray(cp) ? cp : Array.isArray(cp.diapositivas) ? cp.diapositivas : []
        if (diapositivas.length > 0) {
          setPptPresentaciones(prev => ({ ...prev, [idx]: { diapositivas } }))
          return
        }
      }
    }

    setPptPresentaciones(prev => ({ ...prev, [idx]: 'cargando' }))
    try {
      const res = await api.post('/ia/generar-presentacion', { titulo: mod.titulo, descripcion: mod.descripcion })
      await api.put(`/cursos/${cursoDetalle.id}`, {
        modulos: [{ id: mod.id, titulo: mod.titulo, descripcion: mod.descripcion, contenido_presentacion: res.data.presentacion }]
      })
      setPptPresentaciones(prev => ({ ...prev, [idx]: res.data.presentacion }))
    } catch {
      setPptPresentaciones(prev => ({ ...prev, [idx]: 'error' }))
    }
  }

  const guardarEdicionPPT = async (idx, mod) => {
    const slides = pptEditData[idx]
    if (!slides || !cursoDetalle) return
    setPptGuardando(true)
    try {
      await api.put(`/cursos/${cursoDetalle.id}`, {
        modulos: [{ id: mod.id, contenido_presentacion: { diapositivas: slides } }]
      })
      setPptPresentaciones(prev => ({ ...prev, [idx]: { ...(prev[idx] || {}), diapositivas: slides } }))
      setPptEditando(false)
    } catch {
      toast.error('No pudimos guardar los cambios de la presentación. Inténtalo de nuevo.')
    } finally {
      setPptGuardando(false)
    }
  }

  const subirVideoIntro = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !cursoDetalle) return
    const formData = new FormData()
    formData.append('video', file)
    setSubiendoVideo(true)
    try {
      const res = await api.post(`/cursos/${cursoDetalle.id}/video-intro`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setCursoDetalle(prev => ({ ...prev, video_intro_url: res.data.video_intro_url }))
      try {
        const signed = await api.get(`/cursos/${cursoDetalle.id}/video-intro/signed-url`)
        setVideoIntroUrl(signed.data.url)
      } catch (e) {
        console.error('[video-intro signed-url]', e?.response?.data || e?.message)
        setVideoIntroUrl(res.data.video_intro_url)
      }
    } catch {
      toast.error('No pudimos subir el video. Revisa tu conexión e inténtalo de nuevo.')
    } finally {
      setSubiendoVideo(false)
    }
  }

  const eliminarVideoIntro = async () => {
    if (!cursoDetalle) return
    const ok = await confirm({
      title: 'Eliminar video introductorio',
      message: 'El video se borrará del curso. Podrás subir otro más adelante.',
      confirmText: 'Eliminar',
      danger: true,
    })
    if (!ok) return
    setEliminandoVideo(true)
    try {
      await api.delete(`/cursos/${cursoDetalle.id}/video-intro`)
      setVideoIntroUrl(null)
      setCursoDetalle(prev => ({ ...prev, video_intro_url: null }))
    } catch {
      toast.error('No pudimos eliminar el video. Inténtalo de nuevo.')
    } finally {
      setEliminandoVideo(false)
    }
  }

  const guardarTargeting = async () => {
    const payload = {
      estamento_objetivo: targeting.estamento_objetivo,
      sede_objetivo: targeting.sede_objetivo,
      obligatorio: Array.isArray(targeting.estamento_objetivo) && targeting.estamento_objetivo.length > 0
    }
    setGuardandoTargeting(true)
    try {
      await api.patch(`/cursos/${cursoDetalle.id}/targeting`, payload)
      setCursoDetalle(prev => ({ ...prev, ...payload }))
    } catch (err) { toast.error('No pudimos guardar la configuración del curso: ' + (err?.response?.data?.detalle || 'inténtalo de nuevo.')) }
    finally { setGuardandoTargeting(false) }
  }

  const guardarModulos = async () => {
    setGuardandoModulos(true)
    try {
      await api.put(`/cursos/${cursoDetalle.id}`, { modulos: modulosEdit.map(m => ({ id: m.id, titulo: m.titulo, descripcion: m.descripcion })) })
      setCursoDetalle(prev => ({ ...prev, modulos: modulosEdit }))
      setEditandoModulos(false)
    } catch { toast.error('No pudimos guardar los módulos. Inténtalo de nuevo.') }
    finally { setGuardandoModulos(false) }
  }

  const guardarPreguntas = async () => {
    setGuardandoPreguntas(true)
    try {
      const paraGuardar = preguntasEdit.filter(p => p.texto?.trim())
      if (paraGuardar.length > 0) {
        await api.put(`/cursos/${cursoDetalle.id}`, { preguntas: paraGuardar })
      }
      for (const pid of deletedPregIds) {
        await api.delete(`/cursos/${cursoDetalle.id}/preguntas/${pid}`)
          .catch(e => {
            const msg = e?.response?.data?.error || ''
            if (msg) toast.error(msg)
          })
      }
      const { data } = await api.get(`/cursos/${cursoDetalle.id}`)
      setCursoDetalle(prev => ({ ...prev, preguntas: data.preguntas }))
      setDeletedPregIds([])
      setEditandoPreguntas(false)
    } catch { toast.error('No pudimos guardar las preguntas. Inténtalo de nuevo.') }
    finally { setGuardandoPreguntas(false) }
  }

  const eliminarPregunta = (j, id) => {
    if (id) setDeletedPregIds(prev => [...prev, id])
    setPreguntasEdit(prev => prev.filter((_, i) => i !== j))
  }

  const agregarPregunta = () => setPreguntasEdit(prev => [...prev, {
    texto: '',
    alternativas: [
      { texto: '', correcta: false },
      { texto: '', correcta: false },
      { texto: '', correcta: false },
      { texto: '', correcta: false },
    ]
  }])

  const cambiarEstado = async (accion, cursoId) => {
    try {
      if (accion === 'despublicar') await api.patch(`/cursos/${cursoId}/publicar`, { publicado: false })
      else if (accion === 'aprobar') await api.patch(`/cursos/${cursoId}/aprobar`)
      else if (accion === 'eliminar') await api.delete(`/cursos/${cursoId}`)
      onClose()
      onCambioEstado()
    } catch {
      toast.error('No pudimos completar la acción. Inténtalo de nuevo.')
    }
  }

  if (!cursoDetalle) return null

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
      onClick={onClose}>
      <div style={{ background:'#fff', borderRadius:14, width:'100%', maxWidth:680, maxHeight:'88vh', display:'flex', flexDirection:'column', boxShadow:'0 12px 48px rgba(0,0,0,0.28)' }}
        onClick={e => e.stopPropagation()}>

        {/* Cabecera */}
        <div style={{ background:'var(--azul-oscuro)', borderRadius:'14px 14px 0 0', padding:'18px 24px', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:15, fontWeight:600, color:'#fff' }}>{cursoDetalle.nombre}</div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,0.65)', marginTop:3 }}>
                {cursoDetalle.modulos?.length ?? cursoDetalle.modulos_count ?? 0} módulos · {cursoDetalle.preguntas?.length ?? cursoDetalle.preguntas_count ?? 0} preguntas
                {cursoDetalle.generado_por_ia ? ' · Generado por IA' : ''}
                {cursoDetalle.publicado ? ' · Publicado' : ' · Borrador'}
              </div>
            </div>
            <button onClick={onClose} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.7)', cursor:'pointer', display:'flex', alignItems:'center' }}><Icon icon="lucide:x" width={18} /></button>
          </div>
          <div style={{ display:'flex', gap:4, marginTop:14 }}>
            {TABS.map(([key, label]) => (
              <button key={key} onClick={() => { setTabDetalle(key); setPptModuloIdx(null); setPptEditando(false) }} style={{
                fontSize:12, padding:'5px 14px', borderRadius:6, border:'none', cursor:'pointer',
                background: tabDetalle === key ? '#fff' : 'rgba(255,255,255,0.12)',
                color: tabDetalle === key ? 'var(--azul-oscuro)' : 'rgba(255,255,255,0.8)',
                fontWeight: tabDetalle === key ? 600 : 400
              }}>{label}</button>
            ))}
          </div>
        </div>

        {/* Cuerpo scrollable */}
        <div style={{ overflowY:'auto', flex:1, padding:'20px 24px' }}>
          {tabDetalle === 'modulos' && (
            <TabModulos
              modulos={cursoDetalle.modulos} editando={editandoModulos} modulosEdit={modulosEdit}
              onChangeModulosEdit={setModulosEdit} guardando={guardandoModulos}
              onIniciarEdicion={() => { setModulosEdit(JSON.parse(JSON.stringify(cursoDetalle.modulos))); setEditandoModulos(true) }}
              onGuardar={guardarModulos} onCancelar={() => setEditandoModulos(false)}
            />
          )}

          {tabDetalle === 'preguntas' && (
            <TabPreguntas
              preguntas={cursoDetalle.preguntas} editando={editandoPreguntas} preguntasEdit={preguntasEdit}
              onChangePreguntasEdit={setPreguntasEdit} guardando={guardandoPreguntas}
              pregExpandida={pregExpandida} onTogglePregExpandida={j => setPregExpandida(pregExpandida === j ? null : j)}
              onIniciarEdicion={() => {
                setPreguntasEdit(cursoDetalle.preguntas.map(p => ({
                  ...p, alternativas: typeof p.alternativas === 'string' ? JSON.parse(p.alternativas) : p.alternativas
                })))
                setDeletedPregIds([]); setEditandoPreguntas(true)
              }}
              onAgregarPregunta={agregarPregunta} onEliminarPregunta={eliminarPregunta}
              onGuardar={guardarPreguntas} onCancelar={() => { setEditandoPreguntas(false); setDeletedPregIds([]) }}
            />
          )}

          {tabDetalle === 'ppt' && (
            <TabPresentacionPPT
              modulos={cursoDetalle.modulos} imagenesProtocolo={cursoDetalle.imagenes_protocolo}
              moduloIdx={pptModuloIdx} onSetModuloIdx={setPptModuloIdx}
              presentaciones={pptPresentaciones} onSetPresentaciones={setPptPresentaciones}
              slide={pptSlide} onSetSlide={setPptSlide}
              editando={pptEditando} onSetEditando={setPptEditando}
              editData={pptEditData} onSetEditData={setPptEditData} guardando={pptGuardando}
              onAbrirModulo={abrirPPTModulo} onGuardarEdicion={guardarEdicionPPT}
            />
          )}

          {tabDetalle === 'audiencia' && (
            <TabAudiencia
              targeting={targeting} onChangeTargeting={setTargeting} usuario={usuario}
              guardando={guardandoTargeting} onGuardar={guardarTargeting}
            />
          )}

          {tabDetalle === 'video' && (
            <TabVideoIntro
              videoIntroUrl={videoIntroUrl} subiendoVideo={subiendoVideo} eliminandoVideo={eliminandoVideo}
              onSubir={subirVideoIntro} onEliminar={eliminarVideoIntro}
            />
          )}
        </div>

        {/* Botones de acción según estado del curso */}
        <div style={{ padding:'14px 24px', borderTop:'0.5px solid var(--gris-borde)', display:'flex', gap:10, flexShrink:0 }}>
          {cursoDetalle.publicado ? (
            <>
              <button style={{ flex:1, height:40, background:'none', color:'var(--texto-sec)', border:'1px solid #CCC', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer' }}
                onClick={async () => {
                  const ok = await confirm({
                    title: 'Despublicar curso',
                    message: 'Los colaboradores ya no podrán acceder al curso. Podrás volver a publicarlo más adelante.',
                    confirmText: 'Despublicar', danger: true,
                  })
                  if (ok) cambiarEstado('despublicar', cursoDetalle.id)
                }}>
                <><Icon icon="lucide:eye-off" width={13} style={{verticalAlign:"middle",marginRight:4}} /> Despublicar</>
              </button>
              <button style={{ flex:1, height:40, background:'none', color:'var(--danger)', border:'1px solid var(--danger)', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer' }}
                onClick={async () => {
                  const ok = await confirm({
                    title: 'Eliminar curso',
                    message: 'Se eliminará el curso, sus módulos, evaluaciones y certificados emitidos. Esta acción no se puede deshacer.',
                    confirmText: 'Eliminar', danger: true,
                  })
                  if (ok) cambiarEstado('eliminar', cursoDetalle.id)
                }}>
                <><Icon icon="lucide:trash-2" width={13} style={{verticalAlign:"middle",marginRight:3}} /> Eliminar</>
              </button>
              <button style={{ height:40, padding:'0 20px', background:'var(--azul-oscuro)', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer' }}
                onClick={onClose}>
                Cerrar
              </button>
            </>
          ) : (
            <>
              <button style={{ flex:1, height:40, background:'var(--success)', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer' }}
                onClick={() => cambiarEstado('aprobar', cursoDetalle.id)}>
                <><Icon icon="lucide:check" width={13} style={{verticalAlign:"middle",marginRight:4}} /> Aprobar y publicar</>
              </button>
              <button style={{ flex:1, height:40, background:'none', color:'var(--danger)', border:'1px solid var(--danger)', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer' }}
                onClick={async () => {
                  const ok = await confirm({
                    title: 'Eliminar borrador',
                    message: 'El borrador se eliminará permanentemente.',
                    confirmText: 'Eliminar', danger: true,
                  })
                  if (ok) cambiarEstado('eliminar', cursoDetalle.id)
                }}>
                <><Icon icon="lucide:trash-2" width={13} style={{verticalAlign:"middle",marginRight:3}} /> Eliminar borrador</>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
