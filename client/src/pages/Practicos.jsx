import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Topbar from '../components/Topbar'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DIAS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']

const FORM_INICIAL = { curso_id:'', titulo:'', descripcion:'', fecha:'', hora_inicio:'', hora_fin:'' }

export default function Practicos() {
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const puedeCrear = ['profesor','admin_sede'].includes(usuario?.rol)

  const hoy = new Date()
  const [mes, setMes] = useState(hoy.getMonth())
  const [anio, setAnio] = useState(hoy.getFullYear())
  const [practicos, setPracticos] = useState([])
  const [cursos, setCursos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm] = useState(FORM_INICIAL)
  const [diaSeleccionado, setDiaSeleccionado] = useState(null)
  const [error, setError] = useState('')
  const [exito, setExito] = useState('')

  const cargar = () => {
    setCargando(true)
    const promesas = [api.get('/practicos')]
    if (puedeCrear) promesas.push(api.get('/cursos'))
    Promise.all(promesas)
      .then(([p, c]) => {
        setPracticos(p.data)
        if (c) setCursos(c.data.filter(cur => cur.publicado))
      })
      .catch(() => {})
      .finally(() => setCargando(false))
  }

  useEffect(() => { cargar() }, [])

  // Calcular días del mes
  const primerDia = new Date(anio, mes, 1).getDay()
  const diasEnMes = new Date(anio, mes + 1, 0).getDate()

  const practicosPorDia = (dia) => {
    const fecha = `${anio}-${String(mes+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`
    return practicos.filter(p => p.fecha?.startsWith(fecha))
  }

  const practicosDelDia = diaSeleccionado ? practicosPorDia(diaSeleccionado) : []

  const handleCrear = async (e) => {
    e.preventDefault()
    setError(''); setExito('')
    if (!form.curso_id || !form.titulo || !form.fecha || !form.hora_inicio) {
      return setError('Curso, título, fecha y hora de inicio son obligatorios')
    }
    try {
      const res = await api.post('/practicos', form)
      setExito(res.data.message || 'Práctico creado y notificaciones enviadas')
      setForm(FORM_INICIAL)
      setMostrarForm(false)
      cargar()
    } catch (err) {
      setError(err.response?.data?.error || 'Error al crear el práctico')
    }
  }

  const handleEliminar = async (id) => {
    if (!confirm('¿Eliminar este práctico?')) return
    try {
      await api.delete(`/practicos/${id}`)
      cargar()
      setDiaSeleccionado(null)
    } catch { setError('Error al eliminar práctico') }
  }

  const navSidebar = {
    colaborador: [
      { label:'Inicio', path:'/colaborador' },
      { label:'Capacitaciones', path:'/capacitaciones' },
      { label:'Prácticos', path:'/practicos', active:true },
    ],
    profesor: [
      { label:'Mis cursos', path:'/profesor' },
      { label:'Capacitaciones', path:'/capacitaciones' },
      { label:'Prácticos', path:'/practicos', active:true },
      { label:'Nuevo curso', path:'/profesor/nuevo-curso' },
    ],
    admin_sede: [
      { label:'Resumen', path:'/admin' },
      { label:'Capacitaciones', path:'/capacitaciones' },
      { label:'Prácticos', path:'/practicos', active:true },
    ],
    jefatura: [
      { label:'Resumen global', path:'/jefatura' },
      { label:'Capacitaciones', path:'/capacitaciones' },
      { label:'Prácticos', path:'/practicos', active:true },
      { label:'Usuarios', path:'/jefatura/usuarios' },
    ],
  }

  return (
    <div className="app-shell">
      <Topbar seccion="Calendario de prácticos" />
      <div className="app-body">
        <Sidebar />

        <main className="main-content" style={{ display:'flex', flexDirection:'column', gap:16 }}>

          {/* Header */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
            <div>
              <div className="page-title">Prácticos programados</div>
              <div className="page-sub">Calendario de actividades prácticas por sede</div>
            </div>
            {puedeCrear && (
              <button className="btn-primary" onClick={() => { setMostrarForm(!mostrarForm); setError(''); setExito('') }}>
                {mostrarForm ? '✕ Cancelar' : '+ Nuevo práctico'}
              </button>
            )}
          </div>

          {exito && <div style={{ background:'#EDFAF3', border:'0.5px solid #7BC67A', borderRadius:8, padding:'10px 14px', fontSize:13, color:'#1A7A45' }}>✓ {exito}</div>}
          {error && <div style={{ background:'#FFF0F0', border:'0.5px solid #E8505B', borderRadius:8, padding:'10px 14px', fontSize:13, color:'#C0392B' }}>✗ {error}</div>}

          {/* Formulario crear práctico */}
          {mostrarForm && puedeCrear && (
            <div className="card">
              <div className="card-title" style={{ marginBottom:16 }}>Nuevo práctico</div>
              <form onSubmit={handleCrear}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div className="field" style={{ gridColumn:'1/-1' }}>
                    <label>Curso *</label>
                    <select value={form.curso_id} onChange={e => setForm({...form, curso_id:e.target.value})}>
                      <option value="">Seleccionar curso</option>
                      {cursos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                  </div>
                  <div className="field" style={{ gridColumn:'1/-1' }}>
                    <label>Título del práctico *</label>
                    <input type="text" placeholder="Ej: Práctica de posicionamiento en cama"
                      value={form.titulo} onChange={e => setForm({...form, titulo:e.target.value})} />
                  </div>
                  <div className="field">
                    <label>Fecha *</label>
                    <input type="date" value={form.fecha} onChange={e => setForm({...form, fecha:e.target.value})} />
                  </div>
                  <div className="field">
                    <label>Hora inicio *</label>
                    <input type="time" value={form.hora_inicio} onChange={e => setForm({...form, hora_inicio:e.target.value})} />
                  </div>
                  <div className="field">
                    <label>Hora término</label>
                    <input type="time" value={form.hora_fin} onChange={e => setForm({...form, hora_fin:e.target.value})} />
                  </div>
                  <div className="field" style={{ gridColumn:'1/-1' }}>
                    <label>Descripción</label>
                    <textarea rows={2} placeholder="Detalles del práctico..." style={{ resize:'none' }}
                      value={form.descripcion} onChange={e => setForm({...form, descripcion:e.target.value})} />
                  </div>
                </div>
                <div className="notice" style={{ marginBottom:12 }}>
                  Se notificará automáticamente a todos los colaboradores asignados a este curso.
                </div>
                <button type="submit" className="btn-primary">Crear práctico y notificar</button>
              </form>
            </div>
          )}

          <div style={{ display:'grid', gridTemplateColumns:'1fr 300px', gap:16 }}>

            {/* Calendario */}
            <div className="card">
              {/* Navegación mes */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
                <button onClick={() => { if (mes === 0) { setMes(11); setAnio(anio-1) } else setMes(mes-1) }}
                  style={{ background:'none', border:'0.5px solid #E8E8E8', borderRadius:6, width:30, height:30, cursor:'pointer', fontSize:14 }}>‹</button>
                <span style={{ fontSize:15, fontWeight:500 }}>{MESES[mes]} {anio}</span>
                <button onClick={() => { if (mes === 11) { setMes(0); setAnio(anio+1) } else setMes(mes+1) }}
                  style={{ background:'none', border:'0.5px solid #E8E8E8', borderRadius:6, width:30, height:30, cursor:'pointer', fontSize:14 }}>›</button>
              </div>

              {/* Días de la semana */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, marginBottom:4 }}>
                {DIAS.map(d => (
                  <div key={d} style={{ textAlign:'center', fontSize:10, fontWeight:500, color:'#888', padding:'4px 0' }}>{d}</div>
                ))}
              </div>

              {/* Grid días */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2 }}>
                {/* Celdas vacías al inicio */}
                {Array.from({ length: primerDia }).map((_, i) => <div key={`empty-${i}`} />)}

                {/* Días del mes */}
                {Array.from({ length: diasEnMes }, (_, i) => i + 1).map(dia => {
                  const eventos = practicosPorDia(dia)
                  const esHoy = dia === hoy.getDate() && mes === hoy.getMonth() && anio === hoy.getFullYear()
                  const seleccionado = dia === diaSeleccionado
                  return (
                    <div key={dia}
                      onClick={() => setDiaSeleccionado(dia === diaSeleccionado ? null : dia)}
                      style={{
                        minHeight: 56, padding: '4px 6px', borderRadius: 8, cursor: 'pointer',
                        border: `0.5px solid ${seleccionado ? '#2B4BA0' : esHoy ? '#2B4BA0' : '#E8E8E8'}`,
                        background: seleccionado ? '#EEF2FF' : esHoy ? '#F4F8FF' : 'white',
                        position: 'relative'
                      }}
                    >
                      <div style={{
                        fontSize: 12, fontWeight: esHoy ? 600 : 400,
                        color: esHoy ? '#2B4BA0' : '#1a1a1a',
                        marginBottom: 2
                      }}>{dia}</div>
                      {eventos.slice(0, 2).map((e, i) => (
                        <div key={i} style={{
                          fontSize: 9, background: '#2B4BA0', color: 'white',
                          borderRadius: 3, padding: '1px 4px', marginBottom: 1,
                          overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis'
                        }}>
                          {e.hora_inicio?.slice(0,5)} {e.titulo}
                        </div>
                      ))}
                      {eventos.length > 2 && (
                        <div style={{ fontSize: 9, color: '#888' }}>+{eventos.length - 2} más</div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Panel lateral — detalle del día */}
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {diaSeleccionado ? (
                <div className="card">
                  <div className="card-title" style={{ marginBottom:12 }}>
                    {diaSeleccionado} de {MESES[mes]}
                  </div>
                  {practicosDelDia.length === 0 ? (
                    <div style={{ color:'#888', fontSize:13, textAlign:'center', padding:16 }}>
                      Sin prácticos este día
                    </div>
                  ) : practicosDelDia.map(p => (
                    <div key={p.id} style={{ border:'0.5px solid #E8E8E8', borderRadius:8, padding:12, marginBottom:8 }}>
                      <div style={{ fontSize:13, fontWeight:500, marginBottom:4 }}>{p.titulo}</div>
                      <div style={{ fontSize:11, color:'#888', marginBottom:4 }}>
                        📋 {p.curso_nombre}
                      </div>
                      <div style={{ fontSize:11, color:'#555', marginBottom:2 }}>
                        🕐 {p.hora_inicio?.slice(0,5)}{p.hora_fin ? ` — ${p.hora_fin.slice(0,5)}` : ''}
                      </div>
                      <div style={{ fontSize:11, color:'#555', marginBottom:2 }}>
                        📍 {p.sede_nombre || 'ELEAM sede'}
                      </div>
                      {p.descripcion && (
                        <div style={{ fontSize:11, color:'#888', marginTop:6, lineHeight:1.5 }}>{p.descripcion}</div>
                      )}
                      <div style={{ fontSize:10, color:'#AAA', marginTop:6 }}>
                        Creado por {p.creado_por_nombre}
                      </div>
                      {puedeCrear && (
                        <button className="btn-rechazar" style={{ marginTop:8, fontSize:11 }}
                          onClick={() => handleEliminar(p.id)}>
                          Eliminar
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="card" style={{ textAlign:'center', padding:24 }}>
                  <div style={{ fontSize:28, marginBottom:8 }}>📅</div>
                  <div style={{ fontSize:13, color:'#888' }}>Selecciona un día para ver los prácticos programados</div>
                </div>
              )}

              {/* Próximos prácticos */}
              <div className="card">
                <div className="card-title" style={{ marginBottom:12 }}>Próximos prácticos</div>
                {cargando ? (
                  <div style={{ color:'#888', fontSize:13 }}>Cargando...</div>
                ) : practicos.filter(p => new Date(p.fecha) >= hoy).slice(0, 4).length === 0 ? (
                  <div style={{ color:'#888', fontSize:13 }}>Sin prácticos próximos</div>
                ) : practicos
                  .filter(p => new Date(p.fecha) >= hoy)
                  .slice(0, 4)
                  .map(p => (
                    <div key={p.id} style={{ display:'flex', gap:10, marginBottom:10, alignItems:'flex-start' }}>
                      <div style={{
                        width:36, height:36, borderRadius:8, background:'#EEF2FF',
                        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', flexShrink:0
                      }}>
                        <div style={{ fontSize:11, fontWeight:600, color:'#2B4BA0' }}>
                          {new Date(p.fecha).getUTCDate()}
                        </div>
                        <div style={{ fontSize:9, color:'#888' }}>
                          {MESES[new Date(p.fecha).getUTCMonth()]?.slice(0,3)}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize:12, fontWeight:500 }}>{p.titulo}</div>
                        <div style={{ fontSize:11, color:'#888' }}>{p.hora_inicio?.slice(0,5)} · {p.sede_nombre}</div>
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
