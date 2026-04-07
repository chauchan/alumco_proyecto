import { useState, useEffect } from 'react'
import Topbar from '../components/Topbar'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../context/AuthContext'
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

export default function CertificadosGlobales() {
  const { usuario } = useAuth()
  const [certificados, setCertificados] = useState([])
  const [sedes, setSedes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroSede, setFiltroSede] = useState('')
  const [filtroEstamento, setFiltroEstamento] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')

  useEffect(() => {
    Promise.all([
      api.get('/certificados/todos'),
      api.get('/sedes'),
    ])
      .then(([c, s]) => { setCertificados(c.data); setSedes(s.data) })
      .catch(() => {})
      .finally(() => setCargando(false))
  }, [])

  const filtrados = certificados.filter(c => {
    const matchBusqueda = !busqueda ||
      c.usuario_nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
      c.usuario_rut?.toLowerCase().includes(busqueda.toLowerCase()) ||
      c.curso_nombre?.toLowerCase().includes(busqueda.toLowerCase())
    const matchSede = !filtroSede || String(c.sede_id) === filtroSede
    const matchEstamento = !filtroEstamento || c.estamento === filtroEstamento
    const matchEstado = !filtroEstado || c.estado === filtroEstado
    return matchBusqueda && matchSede && matchEstamento && matchEstado
  })

  const aprobados = filtrados.filter(c => c.estado === 'aprobado').length
  const pendientes = filtrados.filter(c => c.estado === 'pendiente').length

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
              { val: filtrados.length, label: 'Total (con filtros)', color: '#2B4BA0' },
              { val: aprobados,         label: 'Aprobados',          color: '#7BC67A' },
              { val: pendientes,        label: 'Pendientes',         color: '#F5A623' },
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
                style={{ flex: 1, minWidth: 220, height: 36, border: '0.5px solid #E8E8E8', borderRadius: 8, padding: '0 12px', fontSize: 13, background: '#F4F5F7' }}
              />
              {usuario?.rol === 'jefatura' && (
                <select value={filtroSede} onChange={e => setFiltroSede(e.target.value)}
                  style={{ height: 36, border: '0.5px solid #E8E8E8', borderRadius: 8, padding: '0 10px', fontSize: 13, background: '#F4F5F7' }}>
                  <option value="">Todas las sedes</option>
                  {sedes.map(s => <option key={s.id} value={String(s.id)}>{s.nombre}</option>)}
                </select>
              )}
              <select value={filtroEstamento} onChange={e => setFiltroEstamento(e.target.value)}
                style={{ height: 36, border: '0.5px solid #E8E8E8', borderRadius: 8, padding: '0 10px', fontSize: 13, background: '#F4F5F7' }}>
                <option value="">Todos los estamentos</option>
                {ESTAMENTOS.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
              <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
                style={{ height: 36, border: '0.5px solid #E8E8E8', borderRadius: 8, padding: '0 10px', fontSize: 13, background: '#F4F5F7' }}>
                <option value="">Todos los estados</option>
                <option value="aprobado">Aprobado</option>
                <option value="pendiente">Pendiente</option>
                <option value="rechazado">Rechazado</option>
              </select>
              {(busqueda || filtroSede || filtroEstamento || filtroEstado) && (
                <button
                  onClick={() => { setBusqueda(''); setFiltroSede(''); setFiltroEstamento(''); setFiltroEstado('') }}
                  style={{ height: 36, background: 'none', border: '0.5px solid #E8E8E8', borderRadius: 8, padding: '0 12px', fontSize: 12, color: '#888', cursor: 'pointer' }}
                >
                  Limpiar
                </button>
              )}
              <span style={{ fontSize: 12, color: '#888', marginLeft: 'auto' }}>
                {filtrados.length} resultado{filtrados.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Tabla */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {cargando ? (
              <div style={{ textAlign: 'center', color: '#888', padding: 32 }}>Cargando...</div>
            ) : filtrados.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#888', padding: 40 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>No se encontraron certificados</div>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#F4F5F7' }}>
                    {['Colaborador', 'RUT', 'Estamento', 'Sede', 'Curso', 'Fecha', 'Estado', 'Acción'].map(h => (
                      <th key={h} style={{ fontSize: 11, fontWeight: 500, color: '#888', textAlign: 'left', padding: '10px 14px', borderBottom: '0.5px solid #E8E8E8' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map(cert => (
                    <tr key={cert.id} style={{ borderBottom: '0.5px solid #E8E8E8' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 500 }}>{cert.usuario_nombre}</td>
                      <td style={{ padding: '10px 14px', color: '#888', fontSize: 12 }}>{cert.usuario_rut || '—'}</td>
                      <td style={{ padding: '10px 14px', fontSize: 11, color: '#555' }}>{cert.estamento || '—'}</td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: '#888' }}>{cert.sede_nombre || '—'}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ fontSize: 13 }}>{cert.curso_nombre}</div>
                      </td>
                      <td style={{ padding: '10px 14px', color: '#888', fontSize: 12 }}>
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
                        {cert.estado === 'aprobado' && cert.archivo_url ? (
                          <a
                            href={`/api/certificados/${cert.id}/descargar`}
                            style={{ fontSize: 11, color: '#2B4BA0', border: '0.5px solid #E8E8E8', borderRadius: 8, padding: '5px 10px' }}
                          >
                            ↓ Descargar
                          </a>
                        ) : cert.estado === 'pendiente' && (usuario?.rol === 'profesor' || usuario?.rol === 'admin_sede' || usuario?.rol === 'jefatura') ? (
                          <button
                            className="btn-aprobar"
                            onClick={() => api.patch(`/certificados/${cert.id}/validar`, { estado: 'aprobado' })
                              .then(() => setCertificados(prev => prev.map(c => c.id === cert.id ? {...c, estado:'aprobado'} : c)))
                            }
                          >
                            Validar
                          </button>
                        ) : (
                          <span style={{ fontSize: 11, color: '#AAA' }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
