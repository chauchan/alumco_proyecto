import { useState, useEffect, useCallback, useRef } from 'react'
import { Icon } from '@iconify/react'
import Topbar from '../components/Topbar'
import Sidebar from '../components/Sidebar'
import Paginacion from '../components/Paginacion'
import { useAuth } from '../context/AuthContext'
import api, { descargarCertificado } from '../services/api'

const ESTAMENTOS = [
  'Profesional de Atención Directa',
  'Técnico de Atención Directa',
  'Asistente de Trato Directo',
  'Auxiliares de Servicio',
  'Manipuladores de Alimentos',
  'Administración y Apoyo',
  'Directivos',
]

const LIMIT = 20


export default function CertificadosGlobales() {
  const { usuario } = useAuth()
  const [certificados, setCertificados] = useState([])
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(1)
  const [sedes, setSedes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroSede, setFiltroSede] = useState('')
  const [filtroEstamento, setFiltroEstamento] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')

  const busquedaRef = useRef(busqueda)
  busquedaRef.current = busqueda
  const prevBusquedaRef = useRef(busqueda)

  const cargar = useCallback((pag = 1) => {
    setCargando(true)
    const params = { page: pag, limit: LIMIT }
    if (busquedaRef.current) params.q = busquedaRef.current
    if (filtroSede) params.sede_id = filtroSede
    if (filtroEstamento) params.estamento = filtroEstamento
    if (filtroEstado) params.estado = filtroEstado

    Promise.all([api.get('/certificados/todos', { params }), api.get('/sedes')])
      .then(([c, s]) => {
        setCertificados(c.data.rows)
        setTotal(c.data.total)
        setPagina(c.data.page)
        setSedes(s.data)
      })
      .catch(() => {})
      .finally(() => setCargando(false))
  }, [filtroSede, filtroEstamento, filtroEstado])

  useEffect(() => {
    const delay = busqueda !== prevBusquedaRef.current ? 300 : 0
    prevBusquedaRef.current = busqueda
    const t = setTimeout(() => cargar(1), delay)
    return () => clearTimeout(t)
  }, [busqueda, filtroSede, filtroEstamento, filtroEstado])

  const aprobados = certificados.filter(c => c.estado === 'aprobado').length
  const pendientes = certificados.filter(c => c.estado === 'pendiente').length

  const titulo = usuario?.rol === 'jefatura' ? 'Certificados ONG' : 'Certificados de la sede'

  return (
    <div className="app-shell">
      <Topbar seccion={titulo} />
      <div className="app-body">
        <Sidebar />
        <main className="main-content" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Header */}
          <div>
            <div className="page-title">{titulo}</div>
            <div className="page-sub">
              {usuario?.rol === 'jefatura'
                ? 'Certificados de todos los colaboradores de la ONG'
                : `Certificados de los colaboradores de ${usuario?.sede_nombre || 'tu sede'}`}
            </div>
          </div>

          {/* Stats */}
          <div className="stats-grid-3">
            {[
              { val: total,     label: 'Total (con filtros)', color: 'var(--azul)' },
              { val: aprobados, label: 'Aprobados (pág. actual)',  color: 'var(--success)' },
              { val: pendientes,label: 'Pendientes (pág. actual)', color: 'var(--warning)' },
            ].map(s => (
              <div key={s.label} className="stat-card">
                <div className="stat-label">{s.label}</div>
                <div className="stat-value" style={{ color: s.color }}>{s.val}</div>
              </div>
            ))}
          </div>

          {/* Filtros */}
          <div className="card" style={{ padding: '12px 14px' }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Buscar por nombre, RUT o curso..."
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                style={{ flex: 1, minWidth: 220, height: 36, border: '0.5px solid var(--gris-borde)', borderRadius: 8, padding: '0 12px', fontSize: 13, background: 'var(--gris-fondo)' }}
              />
              {usuario?.rol === 'jefatura' && (
                <select value={filtroSede} onChange={e => setFiltroSede(e.target.value)}
                  style={{ height: 36, border: '0.5px solid var(--gris-borde)', borderRadius: 8, padding: '0 10px', fontSize: 13, background: 'var(--gris-fondo)' }}>
                  <option value="">Todas las sedes</option>
                  {sedes.map(s => <option key={s.id} value={String(s.id)}>{s.nombre}</option>)}
                </select>
              )}
              <select value={filtroEstamento} onChange={e => setFiltroEstamento(e.target.value)}
                style={{ height: 36, border: '0.5px solid var(--gris-borde)', borderRadius: 8, padding: '0 10px', fontSize: 13, background: 'var(--gris-fondo)' }}>
                <option value="">Todos los estamentos</option>
                {ESTAMENTOS.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
              <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
                style={{ height: 36, border: '0.5px solid var(--gris-borde)', borderRadius: 8, padding: '0 10px', fontSize: 13, background: 'var(--gris-fondo)' }}>
                <option value="">Todos los estados</option>
                <option value="aprobado">Aprobado</option>
                <option value="pendiente">Pendiente</option>
                <option value="rechazado">Rechazado</option>
              </select>
              {(busqueda || filtroSede || filtroEstamento || filtroEstado) && (
                <button
                  onClick={() => { setBusqueda(''); setFiltroSede(''); setFiltroEstamento(''); setFiltroEstado(''); setPagina(1) }}
                  style={{ height: 36, background: 'none', border: '0.5px solid var(--gris-borde)', borderRadius: 8, padding: '0 12px', fontSize: 12, color: 'var(--texto-muted)', cursor: 'pointer' }}
                >
                  Limpiar
                </button>
              )}
              <span style={{ fontSize: 12, color: 'var(--texto-muted)', marginLeft: 'auto' }}>
                {total} resultado{total !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Tabla */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {cargando ? (
              <div style={{ textAlign: 'center', color: 'var(--texto-muted)', padding: 32 }}>Cargando...</div>
            ) : certificados.length === 0 ? (
              <div style={{ display: 'flex',flexDirection: 'column', alignItems: 'center', textAlign: 'center', color: 'var(--texto-muted)', padding: 40 }}>
                <Icon icon="lucide:clipboard-list" width={32} style={{marginBottom:8,display:"block",color:"#CCC"}} />
                <div style={{ fontSize: 14, fontWeight: 500 }}>No se encontraron certificados</div>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--gris-fondo)' }}>
                    {['Colaborador', 'RUT', 'Estamento', 'Sede', 'Curso', 'Fecha', 'Estado', 'Acción'].map(h => (
                      <th key={h} style={{ fontSize: 11, fontWeight: 500, color: 'var(--texto-muted)', textAlign: 'left', padding: '10px 14px', borderBottom: '0.5px solid var(--gris-borde)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {certificados.map(cert => (
                    <tr key={cert.id} style={{ borderBottom: '0.5px solid var(--gris-borde)' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 500 }}>{cert.usuario_nombre}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--texto-muted)', fontSize: 12 }}>{cert.usuario_rut || '—'}</td>
                      <td style={{ padding: '10px 14px', fontSize: 11, color: 'var(--texto-sec)' }}>{cert.estamento || '—'}</td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--texto-muted)' }}>{cert.sede_nombre || '—'}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ fontSize: 13 }}>{cert.curso_nombre}</div>
                      </td>
                      <td style={{ padding: '10px 14px', color: 'var(--texto-muted)', fontSize: 12 }}>
                        {cert.fecha_emision
                          ? new Date(cert.fecha_emision).toLocaleDateString('es-CL')
                          : '—'}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span className={`status-pill ${
                          cert.estado === 'aprobado' ? 'status-ok' :
                          cert.estado === 'rechazado' ? 'status-fallo' : 'status-pend'
                        }`}>
                          {cert.estado === 'aprobado' ? 'Aprobado' :
                           cert.estado === 'rechazado' ? 'Rechazado' : 'Pendiente'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        {cert.estado === 'aprobado' ? (
                          <button
                            type="button"
                            onClick={() => descargarCertificado(cert.id, `certificado_${(cert.usuario_nombre || 'colaborador').replace(/[^a-zA-Z0-9_-]+/g, '_')}_${cert.id}.pdf`)}
                            style={{ fontSize: 11, color: 'var(--azul)', border: '0.5px solid var(--gris-borde)', borderRadius: 8, padding: '5px 10px', display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', cursor: 'pointer' }}
                          >
                            <Icon icon="lucide:download" width={12} style={{verticalAlign:"middle",marginRight:2}} /> Descargar
                          </button>
                        ) : cert.estado === 'pendiente' && (usuario?.rol === 'profesor' || usuario?.rol === 'admin_sede' || usuario?.rol === 'jefatura') ? (
                          <button
                            className="btn-aprobar"
                            onClick={() => api.patch(`/certificados/${cert.id}/validar`, { estado: 'aprobado' })
                              .then(() => cargar(pagina))
                            }
                          >
                            Validar
                          </button>
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--texto-muted)' }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <Paginacion total={total} limit={LIMIT} pagina={pagina} onChange={p => cargar(p)} />
        </main>
      </div>
    </div>
  )
}
