import { useState, useEffect } from 'react'
import { Icon } from '@iconify/react'
import { useNavigate, useParams } from 'react-router-dom'
import Topbar from '../components/Topbar'
import Sidebar from '../components/Sidebar'
import api from '../services/api'

const ESTAMENTOS = [
  'Profesional de Atención Directa',
  'Técnico de Atención Directa',
  'Asistente de Trato Directo',
  'Auxiliares de Servicio',
  'Manipuladores de Alimentos',
  'Administración y Apoyo',
  'Directivos',
]

const ROL_LABEL = {
  colaborador: 'Colaborador',
  profesor: 'Profesor',
  admin_sede: 'Admin. de Sede',
  jefatura: 'Jefatura',
}

export default function AsignarCurso() {
  const navigate = useNavigate()
  const { id: cursoId } = useParams()
  const [curso, setCurso] = useState(null)
  const [usuarios, setUsuarios] = useState([])
  const [seleccionados, setSeleccionados] = useState([])
  const [modo, setModo] = useState('estamento') // 'estamento' | 'individual'
  const [estamentosSeleccionados, setEstamentosSeleccionados] = useState([])
  const [obligatorio, setObligatorio] = useState(false)
  const [exito, setExito] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get(`/cursos/${cursoId}`),
      api.get('/usuarios')
    ]).then(([c, u]) => {
      setCurso(c.data)
      setUsuarios(u.data.filter(u => u.activo))
    }).catch(() => {})
    .finally(() => setCargando(false))
  }, [cursoId])

  const toggleEstamento = (est) => {
    setEstamentosSeleccionados(prev =>
      prev.includes(est) ? prev.filter(e => e !== est) : [...prev, est]
    )
  }

  const toggleUsuario = (id) => {
    setSeleccionados(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const colaboradores = usuarios.filter(u => u.rol === 'colaborador')
  const usuariosPorEstamento = (est) => colaboradores.filter(u => u.estamento === est)
  const usuariosPorRol = (rol) => usuarios.filter(u => u.rol === rol)

  const usuariosAAsignar = modo === 'estamento'
    ? colaboradores.filter(u => estamentosSeleccionados.includes(u.estamento)).map(u => u.id)
    : seleccionados

  const handleAsignar = async () => {
    if (usuariosAAsignar.length === 0) {
      return setError('Selecciona al menos un estamento o persona')
    }
    setError('')
    try {
      await api.post(`/cursos/${cursoId}/asignar`, {
        usuario_ids: usuariosAAsignar,
        obligatorio
      })
      setExito(`Curso asignado a ${usuariosAAsignar.length} persona${usuariosAAsignar.length !== 1 ? 's' : ''} correctamente`)
      setTimeout(() => navigate('/profesor'), 2000)
    } catch (err) {
      setError(err.response?.data?.error || 'Error al asignar el curso')
    }
  }

  if (cargando) return <div style={{ padding: 40, textAlign: 'center' }}>Cargando...</div>

  return (
    <div className="app-shell">
      <Topbar seccion="Profesor — Asignar curso" />
      <div className="app-body">
        <Sidebar />

        <main className="main-content" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          <div>
            <div className="page-title">Asignar curso</div>
            <div className="page-sub">{curso?.nombre}</div>
          </div>

          {exito && <div style={{ background:'var(--success-bg)', border:'0.5px solid var(--verde)', borderRadius:8, padding:'10px 14px', fontSize:13, color:'var(--success)' }}><Icon icon="lucide:check" width={14} style={{verticalAlign:"middle",marginRight:4}} /> {exito}</div>}
          {error && <div style={{ background:'var(--danger-bg)', border:'0.5px solid var(--rojo)', borderRadius:8, padding:'10px 14px', fontSize:13, color:'var(--danger)' }}><Icon icon="lucide:x" width={14} style={{verticalAlign:"middle",marginRight:4}} /> {error}</div>}

          {/* Modo de asignación */}
          <div className="card">
            <div className="card-title" style={{ marginBottom: 12 }}>Modo de asignación</div>
            <div style={{ display: 'flex', gap: 10 }}>
              {[
                { value: 'estamento', label: 'Por estamento', desc: 'Asigna a todos los colaboradores de uno o varios estamentos' },
                { value: 'individual', label: 'Individual', desc: 'Selecciona personas específicas de cualquier rol' },
              ].map(m => (
                <div key={m.value}
                  onClick={() => setModo(m.value)}
                  style={{
                    flex: 1, border: `0.5px solid ${modo === m.value ? 'var(--azul)' : 'var(--gris-borde)'}`,
                    borderRadius: 10, padding: 14, cursor: 'pointer',
                    background: modo === m.value ? 'var(--azul-claro)' : 'white'
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 500, color: modo === m.value ? 'var(--azul)' : 'var(--texto)', marginBottom: 4 }}>{m.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--texto-muted)' }}>{m.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Por estamento */}
          {modo === 'estamento' && (
            <div className="card">
              <div className="card-title" style={{ marginBottom: 12 }}>Seleccionar estamentos</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {ESTAMENTOS.map(est => {
                  const count = usuariosPorEstamento(est).length
                  const seleccionado = estamentosSeleccionados.includes(est)
                  return (
                    <div key={est}
                      onClick={() => toggleEstamento(est)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                        border: `0.5px solid ${seleccionado ? 'var(--azul)' : 'var(--gris-borde)'}`,
                        borderRadius: 8, cursor: 'pointer',
                        background: seleccionado ? 'var(--azul-claro)' : 'white'
                      }}
                    >
                      <div style={{
                        width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                        border: `2px solid ${seleccionado ? 'var(--azul)' : '#CCC'}`,
                        background: seleccionado ? 'var(--azul)' : 'white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        {seleccionado && <Icon icon="lucide:check" color="white" width={12} />}
                      </div>
                      <span style={{ flex: 1, fontSize: 13, color: seleccionado ? 'var(--azul)' : 'var(--texto)', fontWeight: seleccionado ? 500 : 400 }}>
                        {est}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--texto-muted)' }}>
                        {count} colaborador{count !== 1 ? 'es' : ''}
                      </span>
                    </div>
                  )
                })}
              </div>
              {estamentosSeleccionados.length > 0 && (
                <div style={{ marginTop: 12, padding: '8px 12px', background: 'var(--azul-claro)', borderRadius: 8, fontSize: 12, color: 'var(--azul)' }}>
                  Se asignará a <strong>{usuariosAAsignar.length} colaborador{usuariosAAsignar.length !== 1 ? 'es' : ''}</strong> de los estamentos seleccionados
                </div>
              )}
            </div>
          )}

          {/* Individual */}
          {modo === 'individual' && (
            <div className="card">
              <div className="card-title" style={{ marginBottom: 12 }}>Seleccionar personas</div>
              {usuarios.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--texto-muted)', padding: 20 }}>No hay usuarios activos</div>
              ) : (
                <>
                  {/* Colaboradores agrupados por estamento */}
                  {ESTAMENTOS.map(est => {
                    const grupo = usuariosPorEstamento(est)
                    if (grupo.length === 0) return null
                    return (
                      <div key={est} style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--texto-muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>{est}</div>
                        {grupo.map(u => (
                          <div key={u.id}
                            onClick={() => toggleUsuario(u.id)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                              border: `0.5px solid ${seleccionados.includes(u.id) ? 'var(--azul)' : 'var(--gris-borde)'}`,
                              borderRadius: 8, cursor: 'pointer', marginBottom: 4,
                              background: seleccionados.includes(u.id) ? 'var(--azul-claro)' : 'white'
                            }}
                          >
                            <div style={{
                              width: 16, height: 16, borderRadius: 3, flexShrink: 0,
                              border: `2px solid ${seleccionados.includes(u.id) ? 'var(--azul)' : '#CCC'}`,
                              background: seleccionados.includes(u.id) ? 'var(--azul)' : 'white',
                              display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                              {seleccionados.includes(u.id) && <Icon icon="lucide:check" color="white" width={10} />}
                            </div>
                            <span style={{ fontSize: 13, flex: 1 }}>{u.nombre}</span>
                            <span style={{ fontSize: 11, color: 'var(--texto-muted)' }}>{u.sede_nombre || '—'}</span>
                          </div>
                        ))}
                      </div>
                    )
                  })}
                  {/* Otros roles agrupados */}
                  {['profesor', 'admin_sede', 'jefatura'].map(rol => {
                    const grupo = usuariosPorRol(rol)
                    if (grupo.length === 0) return null
                    return (
                      <div key={rol} style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--texto-muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>{ROL_LABEL[rol]}</div>
                        {grupo.map(u => (
                          <div key={u.id}
                            onClick={() => toggleUsuario(u.id)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                              border: `0.5px solid ${seleccionados.includes(u.id) ? 'var(--azul)' : 'var(--gris-borde)'}`,
                              borderRadius: 8, cursor: 'pointer', marginBottom: 4,
                              background: seleccionados.includes(u.id) ? 'var(--azul-claro)' : 'white'
                            }}
                          >
                            <div style={{
                              width: 16, height: 16, borderRadius: 3, flexShrink: 0,
                              border: `2px solid ${seleccionados.includes(u.id) ? 'var(--azul)' : '#CCC'}`,
                              background: seleccionados.includes(u.id) ? 'var(--azul)' : 'white',
                              display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                              {seleccionados.includes(u.id) && <Icon icon="lucide:check" color="white" width={10} />}
                            </div>
                            <span style={{ fontSize: 13, flex: 1 }}>{u.nombre}</span>
                            <span style={{ fontSize: 11, color: 'var(--texto-muted)' }}>{u.sede_nombre || '—'}</span>
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </>
              )}
            </div>
          )}

          {/* Opciones */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="checkbox" id="obligatorio" checked={obligatorio}
                onChange={e => setObligatorio(e.target.checked)} style={{ width: 16, height: 16 }} />
              <label htmlFor="obligatorio" style={{ fontSize: 13, cursor: 'pointer' }}>
                Marcar como <strong>curso obligatorio</strong> para las personas asignadas
              </label>
            </div>
          </div>

          {/* Botones */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-primary" onClick={handleAsignar} disabled={usuariosAAsignar.length === 0}
              style={{ opacity: usuariosAAsignar.length === 0 ? 0.5 : 1 }}>
              Asignar a {usuariosAAsignar.length > 0 ? `${usuariosAAsignar.length} persona${usuariosAAsignar.length !== 1 ? 's' : ''}` : 'personas'}
            </button>
            <button onClick={() => navigate('/profesor')}
              style={{ background: 'none', border: '0.5px solid var(--gris-borde)', borderRadius: 8, padding: '8px 16px', fontSize: 13, color: 'var(--texto-muted)', cursor: 'pointer' }}>
              Cancelar
            </button>
          </div>
        </main>
      </div>
    </div>
  )
}
