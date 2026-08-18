import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '@iconify/react'
import Topbar from '../components/Topbar'
import Sidebar from '../components/Sidebar'
import api from '../services/api'
import ModalDetalleCursoProfesor from '../components/ModalDetalleCursoProfesor'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useConfirm } from '../context/ConfirmContext'

export default function Profesor() {
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const [cursos, setCursos] = useState([])
  const [bloqueados, setBloqueados] = useState([])
  const [desbloqueando, setDesbloqueando] = useState(new Set())
  const [certificados, setCertificados] = useState([])
  const [borradoresIA, setBorradoresIA] = useState([])
  const [cursoAbierto, setCursoAbierto] = useState(null)
  // selección masiva de cursos
  const [modoSeleccion, setModoSeleccion] = useState(false)
  const [seleccionados, setSeleccionados] = useState(new Set())
  const [eliminandoMasivo, setEliminandoMasivo] = useState(false)

  const [busquedaCert, setBusquedaCert] = useState('')

  useEffect(() => {
    // /certificados son los del propio usuario; esta pantalla necesita los de
    // sus alumnos, que es lo que devuelve /por-validar.
    Promise.all([api.get('/cursos'), api.get('/certificados/por-validar'), api.get('/cursos/pendientes-ia'), api.get('/evaluaciones/dobles-fallos')])
      .then(([c, cert, bIA, bl]) => { setCursos(c.data); setCertificados(cert.data); setBorradoresIA(bIA.data); setBloqueados(bl.data || []) })
      .catch(() => {})
  }, [])

  const recargar = () => {
    // /certificados son los del propio usuario; esta pantalla necesita los de
    // sus alumnos, que es lo que devuelve /por-validar.
    Promise.all([api.get('/cursos'), api.get('/certificados/por-validar'), api.get('/cursos/pendientes-ia'), api.get('/evaluaciones/dobles-fallos')])
      .then(([c, cert, bIA, bl]) => { setCursos(c.data); setCertificados(cert.data); setBorradoresIA(bIA.data); setBloqueados(bl.data || []) })
      .catch(() => {})
  }

  const desbloquear = async (curso_id, usuario_id) => {
    const key = `${curso_id}-${usuario_id}`
    setDesbloqueando(prev => new Set([...prev, key]))
    try {
      await api.post(`/cursos/${curso_id}/desbloquear/${usuario_id}`)
      setBloqueados(prev => prev.filter(b => !(b.curso_id === curso_id && b.usuario_id === usuario_id)))
      toast.success('Colaborador desbloqueado correctamente')
    } catch {
      toast.error('Error al desbloquear colaborador')
    } finally {
      setDesbloqueando(prev => { const n = new Set(prev); n.delete(key); return n })
    }
  }

  const eliminarMasivo = async () => {
    if (!seleccionados.size) return
    const ok = await confirm({
      title: `Eliminar ${seleccionados.size} curso${seleccionados.size === 1 ? '' : 's'}`,
      message: 'Se eliminarán permanentemente junto con sus módulos, evaluaciones y certificados emitidos. Esta acción no se puede deshacer.',
      confirmText: 'Eliminar',
      danger: true,
    })
    if (!ok) return
    setEliminandoMasivo(true)
    try {
      await Promise.all([...seleccionados].map(id => api.delete(`/cursos/${id}`)))
      setSeleccionados(new Set())
      setModoSeleccion(false)
      recargar()
    } catch {
      toast.error('No pudimos eliminar algunos de los cursos seleccionados. Revisa la lista e inténtalo de nuevo.')
    } finally {
      setEliminandoMasivo(false)
    }
  }

  const toggleSeleccion = (id) => {
    setSeleccionados(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  const pendientes = certificados.filter(c => c.estado === 'pendiente')

  // Buscador de certificados por validar (Fase 2 del plan). Filtra por
  // colaborador o por curso, que son los dos criterios con que el profesor
  // llega a esta lista.
  const pendientesFiltrados = busquedaCert.trim()
    ? pendientes.filter(c => {
        const q = busquedaCert.trim().toLowerCase()
        return (c.usuario_nombre || '').toLowerCase().includes(q)
            || (c.curso_nombre || '').toLowerCase().includes(q)
      })
    : pendientes

  const validarCertificado = async (cert, estado) => {
    if (estado === 'rechazado') {
      const ok = await confirm({
        title: `Rechazar el certificado de ${cert.usuario_nombre}`,
        message: `El colaborador no obtendrá el certificado de "${cert.curso_nombre}" y deberá volver a rendir la evaluación.`,
        confirmText: 'Rechazar',
        danger: true,
      })
      if (!ok) return
    }
    try {
      await api.patch(`/certificados/${cert.id}/validar`, { estado })
      recargar()
      if (estado === 'rechazado') {
        // Rechazar obliga al colaborador a rendir de nuevo la evaluación: es la
        // acción más cara de deshacer a mano, así que además del diálogo de
        // confirmación se ofrecen 5 s para revertirla.
        toast.undo(`Certificado de ${cert.usuario_nombre} rechazado`, async () => {
          await api.patch(`/certificados/${cert.id}/validar`, { estado: 'pendiente' })
          recargar()
        })
      } else {
        toast.success(`Certificado de ${cert.usuario_nombre} aprobado`)
      }
    } catch {
      toast.error('No pudimos actualizar el certificado. Inténtalo de nuevo; si el problema sigue, avisa a tu administrador de sede.')
    }
  }

  return (
    <div className="app-shell">
      <Topbar seccion="Panel del profesor" />
      <div className="app-body">

        <Sidebar />

        <main className="main-content" style={{ display:'flex', flexDirection:'column', gap:16 }}>

          {/* Header */}
          <div className="page-header">
            <div>
              <div className="page-title">Panel del Profesor</div>
              <div className="page-sub">Gestión de cursos y validación de certificados</div>
            </div>
            <button className="btn-primary" onClick={() => navigate('/profesor/nuevo-curso')}>+ Nuevo curso</button>
          </div>

          {/* Stats */}
          <div className="stats-grid-4">
            {[
              { val: cursos.filter(c=>c.publicado).length, label:'Cursos publicados', color:'var(--success)' },
              { val: cursos.filter(c=>!c.publicado).length, label:'Borradores', color:'var(--texto-muted)' },
              { val: pendientes.length, label:'Por validar', color:'var(--danger)' },
              { val: certificados.filter(c=>c.estado==='aprobado').length, label:'Certificados emitidos', color:'var(--azul)' },
            ].map(s => (
              <div key={s.label} className="stat-card">
                <div className="stat-label">{s.label}</div>
                <div className="stat-value" style={{ color:s.color }}>{s.val}</div>
              </div>
            ))}
          </div>

          {/* ── MODAL DETALLE CURSO IA ── */}
          {cursoAbierto && (
            <ModalDetalleCursoProfesor
              cursoResumen={cursoAbierto}
              usuario={usuario}
              onClose={() => setCursoAbierto(null)}
              onCambioEstado={recargar}
            />
          )}

          {/* Borradores IA pendientes */}
          {borradoresIA.length > 0 && (
            <div className="card" style={{ borderLeft: '3px solid var(--amarillo)' }}>
              <div className="card-header" style={{ marginBottom: 12 }}>
                <span className="card-title">Borradores IA pendientes de validación</span>
                <span style={{ fontSize: 11, background: 'var(--warning-bg)', color: 'var(--warning)', borderRadius: 20, padding: '2px 10px', border: '1px solid var(--warning-graphic)' }}>
                  {borradoresIA.length} pendiente{borradoresIA.length > 1 ? 's' : ''}
                </span>
              </div>
              {borradoresIA.map(curso => (
                <div key={curso.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '0.5px solid #F0F0F0' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--warning-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon icon="lucide:sparkles" width={18} style={{color:'var(--amarillo)'}} /></div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#222' }}>{curso.nombre}</div>
                    <div style={{ fontSize: 11, color: 'var(--texto-muted)', marginTop: 2 }}>
                      {curso.modulos_count} módulos · {curso.preguntas_count} preguntas
                    </div>
                  </div>
                  <button
                    style={{ height: 32, padding: '0 14px', background: 'var(--azul-oscuro)', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, cursor: 'pointer' }}
                    onClick={() => setCursoAbierto(curso)}>
                    Revisar
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="two-col">
            {/* Mis cursos */}
            <div className="card">
              <div className="card-header" style={{ flexWrap:'wrap', gap:6 }}>
                <span className="card-title">Mis cursos ({cursos.length})</span>
                <div style={{ display:'flex', gap:6, marginLeft:'auto' }}>
                  {modoSeleccion ? (
                    <>
                      <button style={{ fontSize:11, padding:'3px 10px', borderRadius:6, border:'1px solid #CCC', background:'#fff', cursor:'pointer', color:'var(--texto-sec)' }}
                        onClick={() => { setModoSeleccion(false); setSeleccionados(new Set()) }}>
                        Cancelar
                      </button>
                      <button style={{ fontSize:11, padding:'3px 10px', borderRadius:6, border:'none', background: seleccionados.size===cursos.length?'var(--texto-sec)':'#EEE', color: seleccionados.size===cursos.length?'#fff':'#333', cursor:'pointer' }}
                        onClick={() => setSeleccionados(seleccionados.size===cursos.length ? new Set() : new Set(cursos.map(c=>c.id)))}>
                        {seleccionados.size===cursos.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
                      </button>
                      {seleccionados.size === 1 && (
                        <button style={{ fontSize:11, padding:'3px 10px', borderRadius:6, border:'1px solid var(--azul-oscuro)', background:'#fff', color:'var(--azul-oscuro)', cursor:'pointer', fontWeight:500 }}
                          onClick={() => {
                            const c = cursos.find(c => seleccionados.has(c.id))
                            if (c) { setModoSeleccion(false); setSeleccionados(new Set()); setCursoAbierto(c) }
                          }}>
                          <><Icon icon="lucide:pencil" width={11} style={{verticalAlign:'middle',marginRight:3}} /> Editar</>
                        </button>
                      )}
                      {seleccionados.size > 0 && (
                        <button style={{ fontSize:11, padding:'3px 10px', borderRadius:6, border:'none', background:'var(--rojo)', color:'#fff', cursor:'pointer', fontWeight:500 }}
                          onClick={eliminarMasivo} disabled={eliminandoMasivo}>
                          {eliminandoMasivo ? 'Eliminando...' : `Eliminar (${seleccionados.size})`}
                        </button>
                      )}
                    </>
                  ) : (
                    <button style={{ fontSize:11, padding:'3px 10px', borderRadius:6, border:'1px solid var(--gris-borde)', background:'#fff', cursor:'pointer', color:'#666' }}
                      onClick={() => setModoSeleccion(true)}>
                      Seleccionar
                    </button>
                  )}
                </div>
              </div>
              <div style={{ maxHeight: 380, overflowY: 'auto' }}>
                {cursos.map(c => (
                  <div key={c.id} className="row-divider" style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', cursor: modoSeleccion ? 'pointer' : 'default' }}
                    onClick={modoSeleccion ? () => toggleSeleccion(c.id) : undefined}>
                    {modoSeleccion && (
                      <div style={{ width:18, height:18, borderRadius:4, border: seleccionados.has(c.id) ? '2px solid var(--azul-oscuro)' : '1.5px solid #CCC', background: seleccionados.has(c.id) ? 'var(--azul-oscuro)' : '#fff', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        {seleccionados.has(c.id) && <Icon icon="lucide:check" color="#fff" width={11} />}
                      </div>
                    )}
                    {!modoSeleccion && <div style={{ width:28, height:28, background:'#FFEEEC', borderRadius:6, flexShrink:0 }} />}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{c.nombre}</div>
                      <div style={{ display:'flex', gap:6, marginTop:4, flexWrap:'wrap' }}>
                        <span className={`format-tag ${c.publicado ? 'tag-publicado' : 'tag-borrador'}`}>
                          {c.publicado ? 'Publicado' : 'Borrador'}
                        </span>
                        {c.obligatorio ? <span style={{ fontSize:9, background:'var(--rojo)', color:'#fff', borderRadius:4, padding:'2px 6px', fontWeight:700, letterSpacing:'0.04em' }}>OBLIGATORIO</span> : null}
                        {(() => {
                          let ests = null
                          try { ests = c.estamento_objetivo ? (typeof c.estamento_objetivo === 'string' ? JSON.parse(c.estamento_objetivo) : c.estamento_objetivo) : null } catch { ests = c.estamento_objetivo ? [c.estamento_objetivo] : null }
                          return ests && ests.length > 0
                            ? <span style={{ fontSize:9, background:'var(--azul-claro)', color:'var(--azul)', borderRadius:4, padding:'2px 6px', fontWeight:500 }}>{ests.length === 1 ? ests[0].split(' ').slice(0,2).join(' ') : `${ests.length} estamentos`}</span>
                            : <span style={{ fontSize:9, background:'#F0FBF4', color:'var(--success)', borderRadius:4, padding:'2px 6px', fontWeight:500 }}>Todos</span>
                        })()}
                      </div>
                    </div>
                    {!modoSeleccion && (
                      <button className={`btn-sm ${c.publicado ? 'btn-sm-outline' : 'btn-sm-primary'}`}
                        onClick={() => setCursoAbierto(c)}>
                        {c.publicado ? 'Editar' : 'Editar / Publicar'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Certificados por validar */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Certificados por validar</span>
                {pendientes.length > 0 && (
                  <span style={{ fontSize:10, background:'var(--danger-bg)', color:'var(--danger)', borderRadius:20, padding:'2px 8px' }}>
                    {pendientes.length}
                  </span>
                )}
              </div>
              {/* Buscador: aparece solo cuando la lista es larga, para no
                  agregar ruido a un panel que casi siempre tiene 2 o 3 filas. */}
              {pendientes.length > 5 && (
                <div style={{ position:'relative', marginBottom:10 }}>
                  <Icon icon="lucide:search" width={14}
                    style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--texto-muted)' }} />
                  <input
                    type="search"
                    value={busquedaCert}
                    onChange={e => setBusquedaCert(e.target.value)}
                    placeholder="Buscar por colaborador o curso"
                    aria-label="Buscar entre los certificados por validar"
                    style={{
                      width:'100%', height:34, paddingLeft:32, paddingRight:10,
                      border:'0.5px solid var(--gris-borde)', borderRadius:'var(--radius-md)',
                      fontSize:13, background:'var(--gris-fondo)', color:'var(--texto)',
                    }}
                  />
                </div>
              )}
              {pendientes.length === 0 ? (
                <div style={{ textAlign:'center', color:'var(--texto-muted)', padding:24, fontSize:13 }}>No hay certificados pendientes</div>
              ) : pendientesFiltrados.length === 0 ? (
                <div style={{ textAlign:'center', color:'var(--texto-muted)', padding:24, fontSize:13 }}>
                  Ningún certificado coincide con “{busquedaCert}”
                </div>
              ) : pendientesFiltrados.slice(0,6).map(cert => (
                <div key={cert.id} className="row-divider" style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0' }}>
                  <div className="avatar" style={{ width:30, height:30, fontSize:12, background:'var(--azul)', flexShrink:0 }}>
                    {cert.usuario_nombre?.split(' ').map(n=>n[0]).slice(0,2).join('')}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:500 }}>{cert.usuario_nombre}</div>
                    <div style={{ fontSize:12, color:'var(--texto-muted)', marginTop:2 }}>{cert.curso_nombre}</div>
                  </div>
                  <div style={{ display:'flex', gap:6 }}>
                    <button className="btn-aprobar" onClick={() => validarCertificado(cert, 'aprobado')}>Aprobar</button>
                    <button className="btn-rechazar" onClick={() => validarCertificado(cert, 'rechazado')}>Rechazar</button>
                  </div>
                </div>
              ))}
              {pendientesFiltrados.length > 6 && (
                <div style={{ fontSize:12, color:'var(--texto-muted)', textAlign:'center', paddingTop:10 }}>
                  Mostrando 6 de {pendientesFiltrados.length}. Usa el buscador para acotar la lista.
                </div>
              )}
            </div>
          </div>

          {/* Colaboradores bloqueados */}
          {bloqueados.length > 0 && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">
                  Colaboradores bloqueados en mis cursos
                  <span style={{ marginLeft:8, background:'var(--rojo)', color:'#fff', borderRadius:10, fontSize:10, fontWeight:700, padding:'2px 7px' }}>
                    {bloqueados.length}
                  </span>
                </span>
              </div>
              {bloqueados.map(b => {
                const key = `${b.curso_id}-${b.usuario_id}`
                return (
                  <div key={key} className="row-divider fila-card" style={{ gap:10, padding:'8px 0' }}>
                    <div className="fila-card-info">
                      <div style={{ fontSize:12, fontWeight:500 }}>{b.usuario_nombre}</div>
                      <div style={{ fontSize:11, color:'var(--texto-muted)', marginTop:2 }}>{b.curso_nombre}</div>
                    </div>
                    <div className="fila-card-acciones" style={{ gap:10 }}>
                      <span style={{ fontSize:11, color:'var(--texto-muted)', whiteSpace:'nowrap' }}>
                        {b.ultimo_intento ? new Date(b.ultimo_intento).toLocaleDateString('es-CL') : '—'}
                      </span>
                      <button
                        className="btn-sm btn-sm-primary"
                        disabled={desbloqueando.has(key)}
                        onClick={() => desbloquear(b.curso_id, b.usuario_id)}
                        style={{ background:'var(--success)', color:'#fff', minWidth:100 }}
                      >
                        {desbloqueando.has(key) ? 'Desbloqueando…' : 'Desbloquear'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

        </main>
      </div>
    </div>
  )
}
