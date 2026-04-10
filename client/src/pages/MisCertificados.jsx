import { useState, useEffect } from 'react'
import { Icon } from '@iconify/react'
import { useNavigate } from 'react-router-dom'
import Topbar from '../components/Topbar'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

export default function MisCertificados() {
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const [certificados, setCertificados] = useState([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    api.get('/certificados')
      .then(res => setCertificados(res.data))
      .catch(() => {})
      .finally(() => setCargando(false))
  }, [])

  const filtrados = certificados.filter(c =>
    !busqueda || c.curso_nombre?.toLowerCase().includes(busqueda.toLowerCase())
  )

  const aprobados  = certificados.filter(c => c.estado === 'aprobado')
  const pendientes = certificados.filter(c => c.estado === 'pendiente')

  return (
    <div className="app-shell">
      <Topbar seccion="Mis certificados" />
      <div className="app-body">
        <Sidebar />
        <main className="main-content" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Header */}
          <div>
            <div className="page-title">Mis certificados</div>
            <div className="page-sub">Historial de certificaciones obtenidas</div>
          </div>

          {/* Stats */}
          <div className="stats-grid-3">
            {[
              { val: aprobados.length,   label: 'Certificados obtenidos', color: '#7BC67A' },
              { val: pendientes.length,  label: 'Pendientes de validar',  color: '#F5A623' },
              { val: certificados.length, label: 'Total de cursos',       color: '#2B4BA0' },
            ].map(s => (
              <div key={s.label} className="stat-card">
                <div className="stat-label">{s.label}</div>
                <div className="stat-value" style={{ color: s.color }}>{s.val}</div>
              </div>
            ))}
          </div>

          {/* Buscador */}
          <div className="card" style={{ padding: '10px 14px' }}>
            <input
              type="text"
              placeholder="Buscar por nombre de curso..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              style={{
                width: '100%', height: 36, border: '0.5px solid #E8E8E8',
                borderRadius: 8, padding: '0 12px', fontSize: 13, background: '#F4F5F7'
              }}
            />
          </div>

          {/* Lista */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {cargando ? (
              <div style={{ display: 'flex',flexDirection: 'column', alignItems: 'center', textAlign: 'center', color: '#888', padding: 32 }}>Cargando...</div>
            ) : filtrados.length === 0 ? (
              <div style={{ display: 'flex',flexDirection: 'column', alignItems: 'center',textAlign: 'center', color: '#888', padding: 40 }}>
                <Icon icon="lucide:medal" width={32} style={{marginBottom:8,display:"block",color:"#F5A623"}} />
                <div style={{ fontSize: 14, fontWeight: 500 }}>
                  {busqueda ? 'No se encontraron resultados' : 'Aún no tienes certificados'}
                </div>
                <div style={{ fontSize: 12, marginTop: 4 }}>
                  {!busqueda && 'Completa tus capacitaciones para obtener certificados'}
                </div>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#F4F5F7' }}>
                    {['Curso', 'Fecha de emisión', 'Validado por', 'Estado', 'Acciones'].map(h => (
                      <th key={h} style={{ fontSize: 11, fontWeight: 500, color: '#888', textAlign: 'left', padding: '10px 14px', borderBottom: '0.5px solid #E8E8E8' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map(cert => (
                    <tr key={cert.id} style={{ borderBottom: '0.5px solid #E8E8E8' }}>
                      <td style={{ padding: '12px 14px', fontWeight: 500 }}>
                        <div>{cert.curso_nombre}</div>
                        {cert.area && <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{cert.area}</div>}
                      </td>
                      <td style={{ padding: '12px 14px', color: '#888', fontSize: 12 }}>
                        {cert.fecha_emision
                          ? new Date(cert.fecha_emision).toLocaleDateString('es-CL')
                          : '—'}
                      </td>
                      <td style={{ padding: '12px 14px', color: '#888', fontSize: 12 }}>
                        {cert.validado_por_nombre || '—'}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span className={`status-pill ${
                          cert.estado === 'aprobado' ? 'status-ok' :
                          cert.estado === 'rechazado' ? 'status-fallo' : 'status-pend'
                        }`}>
                          {cert.estado === 'aprobado' ? 'Aprobado' :
                           cert.estado === 'rechazado' ? 'Rechazado' : 'Pendiente'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        {cert.estado === 'aprobado' && cert.archivo_url ? (
                          <a
                            href={`/api/certificados/${cert.id}/descargar`}
                            style={{
                              fontSize: 11, color: '#2B4BA0',
                              border: '0.5px solid #E8E8E8', borderRadius: 8,
                              padding: '5px 10px', display: 'inline-flex',
                              alignItems: 'center', gap: 4
                            }}
                          >
                            <><Icon icon="lucide:download" width={12} style={{verticalAlign:"middle",marginRight:2}} /> Descargar</>
                          </a>
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
