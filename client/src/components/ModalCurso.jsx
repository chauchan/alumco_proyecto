import { useState, useEffect } from 'react'
import api from '../services/api'

const FORMATO_ICON = { pdf: '📄', video: '🎥', ppt: '📊' }

export default function ModalCurso({ cursoId, onClose, onProgreso }) {
  const [curso, setCurso] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [tab, setTab] = useState('modulos')
  const [visitados, setVisitados] = useState([])
  const [respuestas, setRespuestas] = useState({})
  const [resultado, setResultado] = useState(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    api.get(`/cursos/${cursoId}`)
      .then(res => {
        setCurso(res.data)
        // Parse alternativas si vienen como string
        const preguntas = (res.data.preguntas || []).map(p => ({
          ...p,
          alternativas: typeof p.alternativas === 'string' ? JSON.parse(p.alternativas) : p.alternativas
        }))
        setCurso({ ...res.data, preguntas })
      })
      .catch(() => {})
      .finally(() => setCargando(false))
  }, [cursoId])

  const marcarVisitado = (modId) => {
    if (!visitados.includes(modId)) {
      const nuevos = [...visitados, modId]
      setVisitados(nuevos)
      // Actualizar progreso parcial en backend
      if (curso) {
        const total = curso.modulos?.length || 1
        const pct = Math.round((nuevos.length / total) * (curso.preguntas?.length > 0 ? 70 : 100))
        api.patch(`/cursos/${cursoId}/progreso`, { porcentaje: pct }).catch(() => {})
      }
    }
  }

  const abrirModulo = (mod) => {
    marcarVisitado(mod.id)
    window.open(mod.archivo_url.startsWith('http') ? mod.archivo_url : `http://localhost:3001${mod.archivo_url}`, '_blank')
  }

  const seleccionarRespuesta = (pregId, idx) => {
    setRespuestas(prev => ({ ...prev, [pregId]: idx }))
  }

  const enviarEvaluacion = async () => {
    if (!curso?.preguntas?.length) return
    const preguntas = curso.preguntas
    let correctas = 0
    preguntas.forEach(p => {
      const respIdx = respuestas[p.id]
      const alts = p.alternativas || []
      if (respIdx !== undefined && alts[respIdx]?.correcta) correctas++
    })
    const score = Math.round((correctas / preguntas.length) * 100)
    const aprobado = score >= 60

    setEnviando(true)
    try {
      await api.patch(`/cursos/${cursoId}/progreso`, { porcentaje: aprobado ? 100 : score })
      setResultado({ score, correctas, total: preguntas.length, aprobado })
      if (onProgreso) onProgreso(cursoId, aprobado ? 100 : score)
    } catch {
    } finally {
      setEnviando(false)
    }
  }

  const todosRespondidos = curso?.preguntas?.length > 0 &&
    curso.preguntas.every(p => respuestas[p.id] !== undefined)

  const progreso = curso ? (() => {
    const totalMods = curso.modulos?.length || 0
    const totalPregs = curso.preguntas?.length || 0
    if (resultado) return resultado.aprobado ? 100 : resultado.score
    if (totalMods === 0 && totalPregs === 0) return 0
    const pctMods = totalMods > 0 ? (visitados.length / totalMods) * (totalPregs > 0 ? 70 : 100) : 0
    return Math.round(pctMods)
  })() : 0

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
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#888', padding: 4 }}>✕</button>
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
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0, marginTop: 14 }}>
            {[
              { key: 'modulos', label: `Módulos (${curso?.modulos?.length || 0})` },
              ...(curso?.preguntas?.length > 0 ? [{ key: 'evaluacion', label: `Evaluación (${curso.preguntas.length} preg.)` }] : [])
            ].map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '6px 14px', fontSize: 12, fontWeight: tab === t.key ? 600 : 400,
                color: tab === t.key ? '#2B4BA0' : '#888',
                borderBottom: tab === t.key ? '2px solid #2B4BA0' : '2px solid transparent',
                marginBottom: -1
              }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {cargando ? (
            <div style={{ textAlign: 'center', color: '#888', padding: 32 }}>Cargando curso...</div>
          ) : tab === 'modulos' ? (
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
                    <div style={{
                      width: 36, height: 36, borderRadius: 8, background: '#EEF2FF',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 18, flexShrink: 0
                    }}>
                      {FORMATO_ICON[mod.tipo] || '📄'}
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
                <div style={{ textAlign: 'center', marginTop: 8 }}>
                  <button onClick={() => setTab('evaluacion')} style={{
                    background: '#EEF2FF', color: '#2B4BA0', border: 'none', borderRadius: 8,
                    padding: '9px 20px', fontSize: 13, fontWeight: 500, cursor: 'pointer'
                  }}>
                    Ir a la evaluación →
                  </button>
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
                    <div style={{ fontSize: 13, color: '#16A34A', background: '#F0FDF4', borderRadius: 10, padding: '10px 20px', display: 'inline-block' }}>
                      Curso completado al 100% ✓
                    </div>
                  ) : (
                    <button onClick={() => { setResultado(null); setRespuestas({}) }} style={{
                      background: '#2B4BA0', color: '#fff', border: 'none', borderRadius: 8,
                      padding: '9px 20px', fontSize: 13, cursor: 'pointer'
                    }}>
                      Intentar nuevamente
                    </button>
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
