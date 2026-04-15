import { useState } from 'react'
import { Icon } from '@iconify/react'
import { useNavigate } from 'react-router-dom'
import Topbar from '../components/Topbar'
import Sidebar from '../components/Sidebar'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'

const ESTAMENTOS = [
  'Profesional de Atención Directa',
  'Técnico de Atención Directa',
  'Asistente de Trato Directo',
  'Auxiliares de Servicio',
  'Manipuladores de Alimentos',
  'Administración y Apoyo',
  'Directivos',
]

export default function NuevoCurso() {
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const [paso, setPaso] = useState(1) // 1: info, 2: módulos, 3: evaluación, 4: audiencia
  const [cursoId, setCursoId] = useState(null)
  const [form, setForm] = useState({ nombre:'', descripcion:'', area:'' })
  const [modulos, setModulos] = useState([])
  const [preguntas, setPreguntas] = useState([
    { texto:'', alternativas:[{texto:'',correcta:true},{texto:'',correcta:false},{texto:'',correcta:false},{texto:'',correcta:false}] }
  ])
  const [estamentosObjetivo, setEstamentosObjetivo] = useState(null) // null = todos, array = específicos
  const [sedeObjetivo, setSedeObjetivo] = useState(null) // null = todas, sede_id = solo esa sede
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState('')

  // Paso 1: crear el curso
  const handleCrearCurso = async (e) => {
    e.preventDefault()
    if (!form.nombre) return setError('El nombre es obligatorio')
    setError('')
    try {
      const res = await api.post('/cursos', form)
      setCursoId(res.data.id || res.data.rows?.[0]?.id)
      setPaso(2)
    } catch (err) {
      setError(err.response?.data?.error || 'Error al crear el curso')
    }
  }

  // Paso 2: subir módulo (archivo)
  const handleSubirModulo = async (e) => {
    const archivo = e.target.files[0]
    if (!archivo) return
    setSubiendo(true)
    try {
      const data = new FormData()
      data.append('archivo', archivo)
      data.append('titulo', archivo.name.replace(/\.[^.]+$/, ''))
      data.append('orden', modulos.length + 1)
      const res = await api.post(`/cursos/${cursoId}/modulos`, data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setModulos([...modulos, res.data.rows?.[0] || res.data])
    } catch (err) {
      setError('Error al subir el archivo')
    } finally {
      setSubiendo(false)
      e.target.value = ''
    }
  }

  // Paso 3: guardar preguntas (avanza a paso 4)
  const handleGuardarPreguntas = async () => {
    setError('')
    try {
      for (const p of preguntas) {
        if (p.texto.trim()) {
          await api.post(`/cursos/${cursoId}/preguntas`, {
            texto: p.texto,
            alternativas: p.alternativas
          })
        }
      }
      setPaso(4)
    } catch (err) {
      setError('Error al guardar las preguntas')
    }
  }

  // Paso 4: guardar audiencia y publicar
  const handlePublicar = async () => {
    setError('')
    try {
      // Guardar targeting de estamentos y sede
      await api.patch(`/cursos/${cursoId}/targeting`, {
        estamento_objetivo: estamentosObjetivo,
        sede_objetivo: sedeObjetivo,
        obligatorio: Array.isArray(estamentosObjetivo) && estamentosObjetivo.length > 0
      })
      // Publicar
      await api.patch(`/cursos/${cursoId}/publicar`, { publicado: true })
      alert('¡Curso publicado exitosamente!')
      navigate('/profesor')
    } catch (err) {
      setError('Error al publicar el curso')
    }
  }

  const toggleEstamento = (est) => {
    setEstamentosObjetivo(prev => {
      const actual = Array.isArray(prev) ? prev : []
      const siguiente = actual.includes(est) ? actual.filter(e => e !== est) : [...actual, est]
      return siguiente.length === 0 ? null : siguiente
    })
  }

  const handleGuardarBorrador = async () => {
    alert('Curso guardado como borrador. Puedes publicarlo más tarde desde tu panel.')
    navigate('/profesor')
  }

  const updatePregunta = (i, field, value) => {
    const nuevas = [...preguntas]
    nuevas[i] = { ...nuevas[i], [field]: value }
    setPreguntas(nuevas)
  }

  const updateAlternativa = (pi, ai, field, value) => {
    const nuevas = [...preguntas]
    if (field === 'correcta') {
      // Solo una correcta por pregunta
      nuevas[pi].alternativas = nuevas[pi].alternativas.map((a, idx) => ({ ...a, correcta: idx === ai }))
    } else {
      nuevas[pi].alternativas[ai] = { ...nuevas[pi].alternativas[ai], [field]: value }
    }
    setPreguntas(nuevas)
  }

  const areas = ['Cuidado clínico','Alimentación','Seguridad y emergencias','Higiene y cuidado personal','Movilización y posicionamiento','Otro']

  const pasos = ['Información del curso','Subir material','Evaluación','Audiencia']

  return (
    <div className="app-shell">
      <Topbar seccion="Profesor — Nuevo curso" />
      <div className="app-body">

        <Sidebar />

        <main className="main-content" style={{ display:'flex', flexDirection:'column', gap:20 }}>

          {/* Header */}
          <div>
            <div className="page-title">Nuevo curso de capacitación</div>
            <div className="page-sub">Completa los pasos para crear y publicar el curso</div>
          </div>

          {/* Indicador de pasos */}
          <div style={{ display:'flex', gap:0 }}>
            {pasos.map((p, i) => {
              const num = i + 1
              const activo = paso === num
              const completado = paso > num
              return (
                <div key={p} style={{ display:'flex', alignItems:'center', flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{
                      width:28, height:28, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:12, fontWeight:500, color:'#fff', flexShrink:0,
                      background: completado ? '#7BC67A' : activo ? '#2B4BA0' : '#CCC'
                    }}>
                      {completado ? <Icon icon="lucide:check" color="white" width={13} /> : num}
                    </div>
                    <span style={{ fontSize:13, fontWeight: activo ? 500 : 400, color: activo ? '#2B4BA0' : '#888' }}>{p}</span>
                  </div>
                  {i < pasos.length - 1 && (
                    <div style={{ flex:1, height:1, background:'#E8E8E8', margin:'0 12px' }} />
                  )}
                </div>
              )
            })}
          </div>

          {error && (
            <div style={{ background:'#FFF0F0', border:'0.5px solid #E8505B', borderRadius:8, padding:'10px 14px', fontSize:13, color:'#C0392B' }}>
              <Icon icon="lucide:x" width={14} style={{verticalAlign:"middle",marginRight:4}} /> {error}
            </div>
          )}

          {/* PASO 1: Información */}
          {paso === 1 && (
            <div className="card">
              <div className="card-title" style={{ marginBottom:16 }}>Información del curso</div>
              <form onSubmit={handleCrearCurso}>
                <div className="field">
                  <label>Nombre del curso *</label>
                  <input type="text" placeholder="Ej: Alimentación del adulto mayor en cama"
                    value={form.nombre} onChange={e => setForm({...form, nombre:e.target.value})} />
                </div>
                <div className="field">
                  <label>Área</label>
                  <select value={form.area} onChange={e => setForm({...form, area:e.target.value})}>
                    <option value="">Seleccionar área</option>
                    {areas.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Descripción</label>
                  <textarea rows={3} placeholder="Descripción breve del contenido del curso..."
                    value={form.descripcion} onChange={e => setForm({...form, descripcion:e.target.value})}
                    style={{ resize:'none' }} />
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <button type="submit" className="btn-primary">Siguiente <Icon icon="lucide:arrow-right" width={13} style={{verticalAlign:"middle"}} /></button>
                  <button type="button" onClick={() => navigate('/profesor')}
                    style={{ background:'none', border:'0.5px solid #E8E8E8', borderRadius:8, padding:'8px 14px', fontSize:12, color:'#888', cursor:'pointer' }}>
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* PASO 2: Subir material */}
          {paso === 2 && (
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              <div className="card">
                <div className="card-title" style={{ marginBottom:4 }}>Subir material formativo</div>
                <div style={{ fontSize:12, color:'#888', marginBottom:16 }}>
                  Puedes subir múltiples archivos. Formatos: PDF, Video (MP4, máx 5 min), PPT
                </div>

                {/* Zona de subida */}
                <label htmlFor="input-archivo">
                  <div className="upload-zone" style={{ cursor:'pointer' }}>
                    {subiendo ? (
                      <div style={{ display: 'flex',flexDirection: 'column', alignItems: 'center', fontSize:13, color:'#888' }}>Subiendo archivo...</div>
                    ) : (
                      <>
                        <Icon icon="lucide:folder-open" width={28} style={{marginBottom:8,display:"block",color:"#888"}} />
                        <div style={{ fontSize:13, fontWeight:500, marginBottom:4 }}>Haz clic para seleccionar un archivo</div>
                        <div style={{ fontSize:11, color:'#888', marginBottom:8 }}>PDF · MP4 · PPT · PPTX</div>
                        <div style={{ display:'flex', gap:6, justifyContent:'center' }}>
                          <span className="format-tag tag-pdf">PDF</span>
                          <span className="format-tag tag-video">Video</span>
                          <span className="format-tag tag-ppt">PPT</span>
                        </div>
                      </>
                    )}
                  </div>
                </label>
                <input id="input-archivo" type="file"
                  accept=".pdf,.mp4,.webm,.ppt,.pptx"
                  style={{ display:'none' }}
                  onChange={handleSubirModulo}
                />
              </div>

              {/* Lista de módulos subidos */}
              {modulos.length > 0 && (
                <div className="card">
                  <div className="card-title" style={{ marginBottom:12 }}>
                    Material subido ({modulos.length} {modulos.length === 1 ? 'archivo' : 'archivos'})
                  </div>
                  {modulos.map((m, i) => (
                    <div key={i} className="row-divider" style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0' }}>
                      <div style={{ width:32, height:32, background:'#FFEEEC', borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        <span style={{ fontSize:14 }}>{m.tipo === 'video' ? <Icon icon="lucide:video" width={14} /> : m.tipo === 'ppt' ? <Icon icon="lucide:file-bar-chart" width={14} /> : <Icon icon="lucide:file-text" width={14} />}</span>
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, fontWeight:500 }}>{m.titulo}</div>
                        <span className={`format-tag ${m.tipo === 'video' ? 'tag-video' : m.tipo === 'ppt' ? 'tag-ppt' : 'tag-pdf'}`}>
                          {m.tipo?.toUpperCase()}
                        </span>
                      </div>
                      <span className="status-pill status-ok" style={{display:"inline-flex",alignItems:"center",gap:3}}><Icon icon="lucide:check" width={12} /> Subido</span>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display:'flex', gap:8 }}>
                <button className="btn-primary" onClick={() => setPaso(3)} disabled={modulos.length === 0}
                  style={{ opacity: modulos.length === 0 ? 0.5 : 1 }}>
                  Siguiente <Icon icon="lucide:arrow-right" width={13} style={{verticalAlign:"middle"}} />
                </button>
                <button onClick={() => setPaso(1)}
                  style={{ background:'none', border:'0.5px solid #E8E8E8', borderRadius:8, padding:'8px 14px', fontSize:12, color:'#888', cursor:'pointer' }}>
                  <Icon icon="lucide:arrow-left" width={13} style={{verticalAlign:"middle"}} /> Atrás
                </button>
                <button onClick={handleGuardarBorrador}
                  style={{ background:'none', border:'0.5px solid #2B4BA0', borderRadius:8, padding:'8px 14px', fontSize:12, color:'#2B4BA0', cursor:'pointer' }}>
                  Guardar borrador
                </button>
              </div>
            </div>
          )}

          {/* PASO 3: Evaluación */}
          {paso === 3 && (
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              <div className="card">
                <div className="card-title" style={{ marginBottom:4 }}>Preguntas de evaluación</div>
                <div style={{ fontSize:12, color:'#888', marginBottom:16 }}>
                  Agrega las preguntas de alternativas. Marca cuál es la respuesta correcta.
                </div>

                {preguntas.map((p, pi) => (
                  <div key={pi} style={{ border:'0.5px solid #E8E8E8', borderRadius:10, padding:16, marginBottom:12 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                      <div style={{ width:24, height:24, borderRadius:'50%', background:'#2B4BA0', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, color:'#fff', flexShrink:0 }}>
                        {pi + 1}
                      </div>
                      <input type="text" placeholder={`Pregunta ${pi + 1}...`}
                        value={p.texto} onChange={e => updatePregunta(pi, 'texto', e.target.value)}
                        style={{ flex:1, border:'0.5px solid #E8E8E8', borderRadius:8, padding:'8px 10px', fontSize:13, background:'#F4F5F7' }}
                      />
                    </div>
                    <div style={{ paddingLeft:34, display:'flex', flexDirection:'column', gap:8 }}>
                      {p.alternativas.map((alt, ai) => (
                        <div key={ai} style={{ display:'flex', alignItems:'center', gap:10 }}>
                          <input type="radio" name={`correcta-${pi}`} checked={alt.correcta}
                            onChange={() => updateAlternativa(pi, ai, 'correcta', true)}
                            title="Marcar como correcta"
                          />
                          <input type="text" placeholder={`Alternativa ${String.fromCharCode(65+ai)}...`}
                            value={alt.texto} onChange={e => updateAlternativa(pi, ai, 'texto', e.target.value)}
                            style={{ flex:1, border:'0.5px solid #E8E8E8', borderRadius:8, padding:'6px 10px', fontSize:13, background: alt.correcta ? '#EDFAF3' : '#F4F5F7' }}
                          />
                          {alt.correcta && <span style={{ fontSize:10, color:"#1A7A45", whiteSpace:"nowrap", display:"inline-flex", alignItems:"center", gap:2 }}><Icon icon="lucide:check" width={10} /> Correcta</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                <button onClick={() => setPreguntas([...preguntas, {
                  texto:'', alternativas:[{texto:'',correcta:true},{texto:'',correcta:false},{texto:'',correcta:false},{texto:'',correcta:false}]
                }])}
                  style={{ background:'none', border:'0.5px dashed #2B4BA0', borderRadius:8, padding:'8px 14px', fontSize:12, color:'#2B4BA0', cursor:'pointer', width:'100%' }}>
                  + Agregar otra pregunta
                </button>
              </div>

              <div style={{ display:'flex', gap:8 }}>
                <button className="btn-primary" onClick={handleGuardarPreguntas}>
                  Siguiente <Icon icon="lucide:arrow-right" width={13} style={{verticalAlign:"middle"}} />
                </button>
                <button onClick={() => setPaso(2)}
                  style={{ background:'none', border:'0.5px solid #E8E8E8', borderRadius:8, padding:'8px 14px', fontSize:12, color:'#888', cursor:'pointer' }}>
                  <Icon icon="lucide:arrow-left" width={13} style={{verticalAlign:"middle"}} /> Atrás
                </button>
                <button onClick={handleGuardarBorrador}
                  style={{ background:'none', border:'0.5px solid #2B4BA0', borderRadius:8, padding:'8px 14px', fontSize:12, color:'#2B4BA0', cursor:'pointer' }}>
                  Guardar borrador
                </button>
              </div>
            </div>
          )}

          {/* PASO 4: Audiencia */}
          {paso === 4 && (
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              <div className="card">
                <div className="card-title" style={{ marginBottom:4 }}>¿A quién va dirigido este curso?</div>
                <div style={{ fontSize:12, color:'#888', marginBottom:16 }}>
                  Selecciona la sede y los estamentos destinatarios. Si no seleccionas estamentos, el curso será visible para todos (opcional).
                </div>

                {/* Sede */}
                <div style={{ fontSize:12, fontWeight:600, color:'#333', marginBottom:8 }}>Sede</div>
                {[
                  { label: 'Todas las sedes', sub: 'Visible en todas las sedes', value: null },
                  { label: `Solo ${usuario?.sede_nombre || 'mi sede'}`, sub: 'Visible únicamente en tu sede', value: usuario?.sede_id },
                ].map(op => {
                  const sel = sedeObjetivo === op.value
                  return (
                    <div key={String(op.value)} onClick={() => setSedeObjetivo(op.value)}
                      style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderRadius:8, marginBottom:4, cursor:'pointer',
                        border: sel ? '2px solid #1E3A6E' : '1px solid #E8E8E8',
                        background: sel ? '#F0F4FF' : '#FAFAFA' }}>
                      <div style={{ width:16, height:16, borderRadius:'50%', border: sel ? '2px solid #1E3A6E' : '1.5px solid #CCC', background: sel ? '#1E3A6E' : '#fff', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        {sel && <div style={{ width:7, height:7, borderRadius:'50%', background:'#fff' }} />}
                      </div>
                      <div>
                        <div style={{ fontSize:13, fontWeight: sel ? 600 : 400, color:'#222' }}>{op.label}</div>
                        <div style={{ fontSize:11, color:'#888' }}>{op.sub}</div>
                      </div>
                    </div>
                  )
                })}

                <div style={{ height:1, background:'#E8E8E8', margin:'16px 0' }} />

                {/* Estamentos */}
                <div style={{ fontSize:12, fontWeight:600, color:'#333', marginBottom:8 }}>Estamentos</div>
                {/* Opción Todos */}
                <div onClick={() => setEstamentosObjetivo(null)}
                  style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderRadius:8, marginBottom:8, cursor:'pointer',
                    border: estamentosObjetivo === null ? '2px solid #1E3A6E' : '1px solid #E8E8E8',
                    background: estamentosObjetivo === null ? '#F0F4FF' : '#FAFAFA' }}>
                  <div style={{ width:16, height:16, borderRadius:'50%', border: estamentosObjetivo === null ? '2px solid #1E3A6E' : '1.5px solid #CCC', background: estamentosObjetivo === null ? '#1E3A6E' : '#fff', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    {estamentosObjetivo === null && <div style={{ width:7, height:7, borderRadius:'50%', background:'#fff' }} />}
                  </div>
                  <div>
                    <div style={{ fontSize:13, fontWeight: estamentosObjetivo === null ? 600 : 400, color:'#222' }}>Todos los colaboradores</div>
                    <div style={{ fontSize:11, color:'#888' }}>Curso visible para todos los estamentos (opcional)</div>
                  </div>
                </div>

                {/* Estamentos específicos */}
                <div style={{ fontSize:11, fontWeight:500, color:'#888', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>
                  O selecciona estamentos específicos (obligatorio para ellos):
                </div>
                {ESTAMENTOS.map(est => {
                  const sel = Array.isArray(estamentosObjetivo) && estamentosObjetivo.includes(est)
                  return (
                    <div key={est} onClick={() => toggleEstamento(est)}
                      style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderRadius:8, marginBottom:4, cursor:'pointer',
                        border: sel ? '2px solid #1E3A6E' : '1px solid #E8E8E8',
                        background: sel ? '#F0F4FF' : '#FAFAFA' }}>
                      <div style={{ width:16, height:16, borderRadius:4, border: sel ? '2px solid #1E3A6E' : '1.5px solid #CCC', background: sel ? '#1E3A6E' : '#fff', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        {sel && <Icon icon="lucide:check" color="white" width={10} />}
                      </div>
                      <span style={{ fontSize:13, fontWeight: sel ? 600 : 400, color:'#222' }}>{est}</span>
                    </div>
                  )
                })}
              </div>

              {/* Resumen */}
              <div className="notice">
                {sedeObjetivo ? <>Sede: <strong>{usuario?.sede_nombre}</strong>. </> : <>Todas las sedes. </>}
                {Array.isArray(estamentosObjetivo) && estamentosObjetivo.length > 0
                  ? <>Obligatorio para: <strong>{estamentosObjetivo.join(', ')}</strong>.</>
                  : <>Visible para todos los estamentos (opcional).</>}
              </div>

              <div style={{ display:'flex', gap:8 }}>
                <button className="btn-primary" onClick={handlePublicar}>
                  <Icon icon="lucide:check" width={13} style={{verticalAlign:"middle",marginRight:4}} /> Publicar curso
                </button>
                <button onClick={() => setPaso(3)}
                  style={{ background:'none', border:'0.5px solid #E8E8E8', borderRadius:8, padding:'8px 14px', fontSize:12, color:'#888', cursor:'pointer' }}>
                  <Icon icon="lucide:arrow-left" width={13} style={{verticalAlign:"middle"}} /> Atrás
                </button>
                <button onClick={handleGuardarBorrador}
                  style={{ background:'none', border:'0.5px solid #2B4BA0', borderRadius:8, padding:'8px 14px', fontSize:12, color:'#2B4BA0', cursor:'pointer' }}>
                  Guardar borrador
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
