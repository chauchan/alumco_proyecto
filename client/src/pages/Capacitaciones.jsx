import { useState, useEffect } from 'react'
import { Icon } from '@iconify/react'
import { useNavigate } from 'react-router-dom'
import Topbar from '../components/Topbar'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../context/AuthContext'
import { useFiltrosUrl } from '../hooks/useFiltrosUrl'
import api from '../services/api'

const FORMATO_CLASS = { pdf: 'tag-pdf', video: 'tag-video', ppt: 'tag-ppt' }

export default function Capacitaciones() {
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const [cursos, setCursos] = useState([])
  const [misCursos, setMisCursos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [filtros, setFiltro] = useFiltrosUrl({ busqueda: '', filtroArea: '' })
  const { busqueda, filtroArea } = filtros


  const esRolNoColaborador = usuario?.rol && usuario.rol !== 'colaborador'

  const cargarCursos = () => {
    const peticiones = [api.get('/cursos')]
    if (esRolNoColaborador) peticiones.push(api.get('/cursos/mis-capacitaciones'))
    Promise.all(peticiones)
      .then(([res, misRes]) => {
        setCursos(res.data)
        if (misRes) setMisCursos(misRes.data)
      })
      .catch(() => {})
      .finally(() => setCargando(false))
  }

  useEffect(() => { cargarCursos() }, [])

  const areas = [...new Set(cursos.map(c => c.area).filter(Boolean))]

  const cursosFiltrados = cursos.filter(c => {
    const matchBusqueda = !busqueda || c.nombre.toLowerCase().includes(busqueda.toLowerCase())
    const matchArea = !filtroArea || c.area === filtroArea
    return matchBusqueda && matchArea
  })

  const seccionPorRol = {
    colaborador: 'Mi capacitación',
    profesor: 'Panel del profesor',
    admin_sede: 'Administración',
    jefatura: 'Jefatura',
  }

  return (
    <div className="app-shell">
      <Topbar seccion={`${seccionPorRol[usuario?.rol]} — Capacitaciones`} />
      <div className="app-body">

        <Sidebar />

        <main className="main-content" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="page-title">Capacitaciones</div>
              <div className="page-sub">
                {usuario?.rol === 'colaborador'
                  ? 'Cursos asignados a tu estamento y sede'
                  : `${cursosFiltrados.length} cursos disponibles en la plataforma`}
              </div>
            </div>
            {usuario?.rol === 'profesor' && (
              <button className="btn-primary" onClick={() => navigate('/profesor/nuevo-curso')}>
                + Nuevo curso
              </button>
            )}
          </div>

          {/* Mis capacitaciones (solo roles no-colaborador) */}
          {esRolNoColaborador && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--texto)', marginBottom: 10 }}>
                Mis capacitaciones
              </div>
              {misCursos.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', color: 'var(--texto-muted)', padding: 24, fontSize: 13 }}>
                  No hay capacitaciones publicadas disponibles
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {misCursos.map(curso => (
                    <div key={curso.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                        background: 'var(--azul-claro)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        <Icon icon="lucide:clipboard-list" width={22} style={{ color: 'var(--azul)' }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 500 }}>{curso.nombre}</span>
                          {curso.obligatorio === 1 && (
                            <span style={{ fontSize: 10, background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 20, padding: '2px 7px', fontWeight: 600 }}>OBLIGATORIO</span>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--texto-muted)' }}>
                          {curso.area && <span>{curso.area}</span>}
                          {curso.profesor_nombre && <span>Prof. {curso.profesor_nombre}</span>}
                        </div>
                        <div style={{ marginTop: 6 }}>
                          <div className="progress-bar-wrap" style={{ width: 200 }}>
                            <div className="progress-bar-fill" style={{ width: `${curso.progreso || 0}%` }} />
                          </div>
                          <span style={{ fontSize: 10, color: 'var(--texto-muted)' }}>{curso.progreso || 0}% completado</span>
                        </div>
                      </div>
                      <div style={{ flexShrink: 0 }}>
                        <button className="btn-primary" style={{ fontSize: 12, padding: '7px 14px' }}
                          onClick={() => navigate(`/capacitaciones/${curso.id}`)}>
                          {curso.progreso > 0 ? 'Continuar' : 'Iniciar'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Separador y título de gestión */}
          {esRolNoColaborador && (
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--texto)', marginTop: 4 }}>
              {usuario?.rol === 'profesor' ? 'Mis cursos creados' : 'Gestión de cursos'}
            </div>
          )}

          {/* Filtros */}
          <div className="card" style={{ padding: '12px 16px' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <input type="text" placeholder="Buscar curso..."
                value={busqueda} onChange={e => setFiltro('busqueda', e.target.value)}
                style={{ flex: 1, minWidth: 200, height: 36, border: '0.5px solid var(--gris-borde)', borderRadius: 8, padding: '0 12px', fontSize: 13, background: 'var(--gris-fondo)' }}
              />
              {areas.length > 0 && (
                <select value={filtroArea} onChange={e => setFiltro('filtroArea', e.target.value)}
                  style={{ height: 36, border: '0.5px solid var(--gris-borde)', borderRadius: 8, padding: '0 10px', fontSize: 13, background: 'var(--gris-fondo)' }}>
                  <option value="">Todas las áreas</option>
                  {areas.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              )}
              <span style={{ fontSize: 12, color: 'var(--texto-muted)', marginLeft: 'auto' }}>
                {cursosFiltrados.length} curso{cursosFiltrados.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Lista cursos */}
          {cargando ? (
            <div className="card" style={{ textAlign: 'center', color: 'var(--texto-muted)', padding: 32 }}>Cargando capacitaciones...</div>
          ) : cursosFiltrados.length === 0 ? (
            <div className="card" style={{ display: 'flex',flexDirection: 'column', alignItems: 'center', textAlign: 'center', color: 'var(--texto-muted)', padding: 40 }}>
              <Icon icon="lucide:book-open" width={32} style={{marginBottom:12,display:"block",color:"#CCC"}} />
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>
                {busqueda || filtroArea ? 'No se encontraron cursos con ese criterio' : 'No hay cursos disponibles aún'}
              </div>
              <div style={{ fontSize: 13 }}>
                {usuario?.rol === 'profesor' ? 'Crea el primer curso desde "Nuevo curso"' : 'Contacta a tu profesor o administrador'}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {cursosFiltrados.map(curso => (
                <div key={curso.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>

                  {/* Ícono área */}
                  <div style={{
                    width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                    background: 'var(--azul-claro)', display: 'flex', alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Icon icon="lucide:clipboard-list" width={22} style={{color:'var(--azul)'}} />
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{curso.nombre}</span>
                      {!curso.publicado && <span className="format-tag tag-borrador">Borrador</span>}
                      {curso.generado_por_ia && <span style={{ fontSize: 10, background: '#F4F0FF', color: '#6B4DC4', borderRadius: 20, padding: '2px 7px', display:'inline-flex', alignItems:'center', gap:3 }}><Icon icon="lucide:sparkles" width={10} /> IA</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--texto-muted)' }}>
                      {curso.area && <span>{curso.area}</span>}
                      {curso.profesor_nombre && <span>Prof. {curso.profesor_nombre}</span>}
                      {curso.inscritos > 0 && <span>{curso.inscritos} inscritos</span>}
                    </div>
                    {/* Barra de progreso para colaborador */}
                    {usuario?.rol === 'colaborador' && (
                      <div style={{ marginTop: 6 }}>
                        <div className="progress-bar-wrap" style={{ width: 200 }}>
                          <div className="progress-bar-fill" style={{ width: `${curso.progreso || 0}%` }} />
                        </div>
                        <span style={{ fontSize: 10, color: 'var(--texto-muted)' }}>{curso.progreso || 0}% completado</span>
                      </div>
                    )}
                  </div>

                  {/* Acciones según rol */}
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    {usuario?.rol === 'colaborador' && (
                      <button className="btn-primary" style={{ fontSize: 12, padding: '7px 14px' }}
                        onClick={() => navigate(`/capacitaciones/${curso.id}`)}>
                        {curso.progreso > 0 ? 'Continuar' : 'Iniciar'}
                      </button>
                    )}
                    {usuario?.rol === 'profesor' && (
                      <>
                        <button className="btn-sm btn-sm-outline" onClick={() => navigate(`/profesor/nuevo-curso`)}>
                          Editar
                        </button>
                        {!curso.publicado ? (
                          <button className="btn-sm btn-sm-primary"
                            onClick={() => api.patch(`/cursos/${curso.id}/publicar`, { publicado: true }).then(cargarCursos)}>
                            Publicar
                          </button>
                        ) : (
                          <span className="format-tag tag-publicado" style={{ padding: '5px 10px' }}>Publicado</span>
                        )}
                      </>
                    )}
                    {(usuario?.rol === 'admin_sede' || usuario?.rol === 'jefatura') && (
                      <span className={`format-tag ${curso.publicado ? 'tag-publicado' : 'tag-borrador'}`} style={{ padding: '5px 10px' }}>
                        {curso.publicado ? 'Publicado' : 'Borrador'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>


    </div>
  )
}
