import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Topbar from '../components/Topbar'
import api from '../services/api'

export default function GeneradorIA() {
  const navigate = useNavigate()
  const [archivo, setArchivo] = useState(null)
  const [form, setForm] = useState({ nombre_curso:'', area:'', contexto:'' })
  const [resultado, setResultado] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

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
      const res = await api.post('/ia/generar-curso', data, { headers:{ 'Content-Type':'multipart/form-data' } })
      setResultado(res.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Error al generar el curso')
    } finally { setCargando(false) }
  }

  const navItems = [
    { label:'Resumen global', active:false },
    { label:'Sedes', active:false },
    { label:'Métricas y reportes', active:false },
    { label:'Cursos', active:false },
    { label:'Generador IA', active:true, new:true },
    { label:'Configuración', active:false },
  ]

  return (
    <div className="app-shell">
      <Topbar seccion="Panel de jefatura — Generador de cursos" />
      <div className="app-body">

        <aside className="sidebar">
          <div className="nav-section-label">Global ONG</div>
          {navItems.map(item => (
            <div key={item.label}
              className={`nav-item ${item.active ? 'active-dark' : ''}`}
              onClick={() => !item.active && navigate('/jefatura')}
            >
              <span style={{ flex:1 }}>{item.label}</span>
              {item.new && <span className="nav-new">Nuevo</span>}
            </div>
          ))}
        </aside>

        <main className="main-content" style={{ display:'flex', flexDirection:'column', gap:16 }}>

          {/* Header */}
          <div>
            <div className="page-title">Generador de cursos con IA</div>
            <div className="page-sub">Sube un protocolo institucional en PDF y genera un borrador de curso automáticamente</div>
          </div>

          {/* Banner IA */}
          <div style={{
            background:'#1E3A6E', borderRadius:12, padding:'1.25rem 1.5rem',
            display:'flex', alignItems:'center', gap:24
          }}>
            <div style={{
              width:48, height:48, borderRadius:'50%', background:'rgba(255,255,255,0.12)',
              display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:22
            }}>✨</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:15, fontWeight:500, color:'#fff', marginBottom:3 }}>
                Generación automática de cursos
              </div>
              <div style={{ fontSize:12, color:'rgba(255,255,255,0.7)', lineHeight:1.6 }}>
                La IA analiza el protocolo, extrae los conceptos clave y genera módulos con preguntas de evaluación.
                El borrador siempre requiere validación del profesor antes de publicarse.
              </div>
            </div>
            <span className="ia-badge">Beta</span>
          </div>

          {/* Pasos */}
          <div className="three-col">
            {[
              { num:1, color:'#2B4BA0', title:'Sube el protocolo', desc:'Selecciona el PDF del protocolo institucional a digitalizar.' },
              { num:2, color:'#F5A623', title:'La IA genera el borrador', desc:'El sistema extrae módulos y preguntas de evaluación automáticamente.' },
              { num:3, color:'#7BC67A', title:'El profesor valida', desc:'El contenido generado es revisado y aprobado antes de publicarse.' },
            ].map(s => (
              <div key={s.num} className="card" style={{ position:'relative' }}>
                <div style={{ width:24, height:24, borderRadius:'50%', background:s.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:500, color:'#fff', marginBottom:10 }}>{s.num}</div>
                <div style={{ fontSize:13, fontWeight:500, marginBottom:4 }}>{s.title}</div>
                <div style={{ fontSize:11, color:'#888', lineHeight:1.6 }}>{s.desc}</div>
              </div>
            ))}
          </div>

          <div className="two-col">
            {/* Formulario */}
            <div className="card">
              <div className="card-title" style={{ marginBottom:16 }}>Subir protocolo</div>
              <form onSubmit={handleSubmit}>
                <div className="upload-zone" style={{ marginBottom:16 }}
                  onClick={() => document.getElementById('input-pdf').click()}>
                  <input id="input-pdf" type="file" accept=".pdf" style={{ display:'none' }}
                    onChange={e => setArchivo(e.target.files[0])} />
                  {archivo ? (
                    <>
                      <div style={{ fontSize:20, marginBottom:4 }}>✓</div>
                      <div style={{ fontSize:12, fontWeight:500, color:'#1A7A45' }}>{archivo.name}</div>
                      <span className="format-tag tag-pdf" style={{ marginTop:6, display:'inline-block' }}>PDF</span>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize:13, fontWeight:500, marginBottom:4 }}>Arrastra o selecciona un PDF</div>
                      <div style={{ fontSize:11, color:'#888' }}>Protocolo institucional en formato PDF</div>
                    </>
                  )}
                </div>

                <div className="field">
                  <label>Nombre del curso *</label>
                  <input type="text" placeholder="Ej: Alimentación del adulto mayor en cama"
                    value={form.nombre_curso} onChange={e => setForm({...form, nombre_curso:e.target.value})} />
                </div>
                <div className="field">
                  <label>Área</label>
                  <select value={form.area} onChange={e => setForm({...form, area:e.target.value})}>
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
                    value={form.contexto} onChange={e => setForm({...form, contexto:e.target.value})}
                    style={{ resize:'none' }} />
                </div>

                {error && <p style={{ color:'#E8505B', fontSize:12, marginBottom:8 }}>{error}</p>}

                <button type="submit" disabled={cargando} style={{
                  width:'100%', height:42, background:'#1E3A6E', color:'#fff', border:'none',
                  borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer',
                  display:'flex', alignItems:'center', justifyContent:'center', gap:8
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
                <div style={{ textAlign:'center', padding:'3rem 0', color:'#888' }}>
                  <div style={{ fontSize:32, marginBottom:12 }}>⏳</div>
                  <div style={{ fontSize:13 }}>Analizando el protocolo...</div>
                  <div style={{ fontSize:11, marginTop:6 }}>Esto puede tomar 15–30 segundos</div>
                </div>
              )}

              {!resultado && !cargando && (
                <div style={{ textAlign:'center', padding:'3rem 0', color:'#CCC' }}>
                  <div style={{ fontSize:40, marginBottom:12 }}>🤖</div>
                  <div style={{ fontSize:13 }}>El borrador aparecerá aquí</div>
                </div>
              )}

              {resultado && (
                <>
                  <div style={{ background:'#F4F5F7', borderRadius:8, padding:'8px 12px', marginBottom:12, fontSize:12, color:'#555' }}>
                    Fuente: <strong>{archivo?.name}</strong>
                  </div>
                  {resultado.modulos?.map((mod, i) => (
                    <div key={i} style={{ border:'0.5px solid #E8E8E8', borderRadius:10, padding:12, marginBottom:8 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                        <div style={{ width:20, height:20, borderRadius:'50%', background:'#1E3A6E', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, color:'#fff', flexShrink:0 }}>{i+1}</div>
                        <span style={{ fontSize:12, fontWeight:500, flex:1 }}>{mod.titulo}</span>
                        <span className="format-tag tag-borrador">Módulo</span>
                      </div>
                      <div style={{ fontSize:11, color:'#888', lineHeight:1.5, marginBottom:8 }}>{mod.descripcion}</div>
                      <div style={{ fontSize:10, fontWeight:500, color:'#888', marginBottom:4 }}>Preguntas sugeridas:</div>
                      {mod.preguntas?.map((p, j) => (
                        <div key={j} style={{ display:'flex', gap:6, fontSize:11, color:'#888', padding:'3px 0' }}>
                          <div style={{ width:4, height:4, borderRadius:'50%', background:'#888', marginTop:5, flexShrink:0 }} />
                          {p.texto}
                        </div>
                      ))}
                    </div>
                  ))}

                  <div style={{ display:'flex', gap:8, marginTop:12 }}>
                    <button style={{ flex:1, height:38, background:'#7BC67A', color:'#fff', border:'none', borderRadius:8, fontSize:12, fontWeight:500, cursor:'pointer' }}
                      onClick={() => { alert('Borrador enviado al profesor para revisión.'); navigate('/jefatura') }}>
                      Enviar al profesor
                    </button>
                    <button style={{ flex:1, height:38, background:'none', color:'#1E3A6E', border:'0.5px solid #1E3A6E', borderRadius:8, fontSize:12, cursor:'pointer' }}>
                      Editar
                    </button>
                    <button style={{ flex:1, height:38, background:'none', color:'#888', border:'0.5px solid #E8E8E8', borderRadius:8, fontSize:12, cursor:'pointer' }}
                      onClick={() => setResultado(null)}>
                      Descartar
                    </button>
                  </div>

                  <p style={{ fontSize:10, color:'#F5A623', textAlign:'center', marginTop:10 }}>
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
