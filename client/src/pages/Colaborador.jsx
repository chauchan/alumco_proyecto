import { useState, useEffect } from 'react'
import Topbar from '../components/Topbar'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

export default function Colaborador() {
  const { usuario } = useAuth()
  const [cursos, setCursos] = useState([])
  const [certificados, setCertificados] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/cursos'),
      api.get('/certificados')
    ]).then(([c, cert]) => {
      setCursos(c.data)
      setCertificados(cert.data)
    }).finally(() => setCargando(false))
  }, [])

  const completados = cursos.filter(c => c.completado).length
  const pendientes = cursos.filter(c => !c.completado)
  const certAprobados = certificados.filter(c => c.estado === 'aprobado')

  if (cargando) return <div style={{ padding: 40, textAlign: 'center' }}>Cargando...</div>

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Topbar seccion="Mi capacitación" />
      <div style={{ display: 'flex', flex: 1 }}>

        {/* Sidebar */}
        <aside style={{ width: 210, background: 'white', borderRight: '1px solid #E8E8E8', padding: '20px 0' }}>
          {[
            { label: 'Inicio', active: true },
            { label: 'Mis cursos', active: false },
            { label: 'Certificados', active: false },
            { label: 'Mi perfil', active: false },
          ].map(item => (
            <div key={item.label} style={{
              padding: '9px 20px', fontSize: 13, cursor: 'pointer',
              background: item.active ? '#EEF2FF' : 'transparent',
              color: item.active ? '#2B4BA0' : '#555',
              fontWeight: item.active ? 500 : 400,
              borderLeft: item.active ? '3px solid #2B4BA0' : '3px solid transparent'
            }}>
              {item.label}
            </div>
          ))}
        </aside>

        {/* Main */}
        <main style={{ flex: 1, padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Banner saludo */}
          <div style={{
            background: '#2B4BA0', borderRadius: 12, padding: '16px 20px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <div>
              <div style={{ color: 'white', fontSize: 18, fontWeight: 600 }}>
                Hola, {usuario?.nombre?.split(' ')[0]} 👋
              </div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 4 }}>
                {usuario?.sede_nombre} · {usuario?.tipo_contrato === 'fijo' ? 'Funcionaria/o fija/o' : 'Reemplazo'}
              </div>
            </div>
            <div style={{
              background: 'rgba(255,255,255,0.15)', borderRadius: 10,
              padding: '10px 16px', textAlign: 'center'
            }}>
              <div style={{ color: '#F5A623', fontSize: 24, fontWeight: 600 }}>{pendientes.length}</div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10 }}>cursos pendientes</div>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {[
              { val: completados, label: 'Completados', color: '#7BC67A' },
              { val: certAprobados.length, label: 'Certificados', color: '#2B4BA0' },
              { val: 'Hoy', label: 'Último acceso', color: '#F5A623' },
            ].map(s => (
              <div key={s.label} className="card" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 600, color: s.color }}>{s.val}</div>
                <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Cursos pendientes */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 500 }}>Cursos pendientes</span>
              <span style={{ fontSize: 12, color: '#2B4BA0', cursor: 'pointer' }}>Ver todos →</span>
            </div>
            {pendientes.length === 0 ? (
              <div className="card" style={{ color: '#888', textAlign: 'center', padding: 24 }}>
                ¡Estás al día con todos tus cursos!
              </div>
            ) : (
              pendientes.map(curso => (
                <div key={curso.id} className="card" style={{
                  display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: '#FFF0EC', flexShrink: 0
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{curso.nombre}</div>
                    <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                      {curso.area} · {curso.modulos_count || 0} módulos
                    </div>
                    <div style={{ height: 4, background: '#EEE', borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${curso.progreso || 0}%`, background: '#2B4BA0', borderRadius: 2 }} />
                    </div>
                  </div>
                  <button
                    className="btn-primary"
                    style={{ padding: '8px 16px', fontSize: 12 }}
                    onClick={() => window.location.href = `/curso/${curso.id}`}
                  >
                    {curso.progreso > 0 ? 'Continuar' : 'Iniciar'}
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Certificados recientes */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 500 }}>Certificados recientes</span>
              <span style={{ fontSize: 12, color: '#2B4BA0', cursor: 'pointer' }}>Ver todos →</span>
            </div>
            {certAprobados.slice(0, 3).map(cert => (
              <div key={cert.id} className="card" style={{
                display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8
              }}>
                <div style={{ width: 32, height: 32, background: '#EEF2FF', borderRadius: 8, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 13 }}>{cert.curso_nombre}</span>
                <span style={{ fontSize: 11, color: '#888' }}>
                  {cert.fecha_emision ? new Date(cert.fecha_emision).toLocaleDateString('es-CL') : ''}
                </span>
                <a
                  href={`/api/certificados/${cert.id}/descargar`}
                  style={{
                    fontSize: 11, color: '#2B4BA0', border: '1px solid #E8E8E8',
                    borderRadius: 8, padding: '5px 10px'
                  }}
                >
                  ⬇ Descargar
                </a>
              </div>
            ))}
          </div>

        </main>
      </div>
    </div>
  )
}
