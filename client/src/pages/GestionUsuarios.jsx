import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
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

const ROLES = ['colaborador', 'profesor', 'admin_sede', 'jefatura']
const ROL_LABEL = {
  colaborador: 'Colaborador', profesor: 'Profesor',
  admin_sede: 'Admin sede', jefatura: 'Jefatura'
}
const ROL_COLOR = {
  colaborador: '#2B4BA0', profesor: '#E8505B',
  admin_sede: '#7BC67A', jefatura: '#F5A623'
}

const FORM_INICIAL = {
  nombre: '', identificador: '', rol: 'colaborador',
  tipo_contrato: 'fijo', sede_id: '', estamento: ''
}

export default function GestionUsuarios() {
  const navigate = useNavigate()
  const [usuarios, setUsuarios] = useState([])
  const [sedes, setSedes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm] = useState(FORM_INICIAL)
  const [error, setError] = useState('')
  const [exito, setExito] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [filtroRol, setFiltroRol] = useState('')
  const [filtroSede, setFiltroSede] = useState('')

  const cargar = () => {
    setCargando(true)
    Promise.all([api.get('/usuarios'), api.get('/sedes')])
      .then(([u, s]) => { setUsuarios(u.data); setSedes(s.data) })
      .catch(() => {})
      .finally(() => setCargando(false))
  }

  useEffect(() => { cargar() }, [])

  const handleCrear = async (e) => {
    e.preventDefault()
    setError(''); setExito('')
    if (!form.nombre || !form.identificador || !form.rol) {
      return setError('Nombre, identificador y rol son obligatorios')
    }
    try {
      await api.post('/usuarios', { ...form, password: 'alumco2026' })
      setExito(`Usuario "${form.nombre}" creado correctamente. Contraseña inicial: alumco2026`)
      setForm(FORM_INICIAL)
      setMostrarForm(false)
      cargar()
    } catch (err) {
      setError(err.response?.data?.error || 'Error al crear usuario')
    }
  }

  const handleDesactivar = async (id, nombre) => {
    if (!confirm(`¿Desactivar a ${nombre}? El usuario no podrá ingresar al sistema pero su historial se conservará.`)) return
    try {
      await api.patch(`/usuarios/${id}`, { activo: false })
      setExito(`Usuario "${nombre}" desactivado correctamente`)
      cargar()
    } catch {
      setError('Error al desactivar usuario')
    }
  }

  const handleReactivar = async (id, nombre) => {
    if (!confirm(`¿Reactivar a ${nombre}?`)) return
    try {
      await api.patch(`/usuarios/${id}`, { activo: true })
      setExito(`Usuario "${nombre}" reactivado correctamente`)
      cargar()
    } catch {
      setError('Error al reactivar usuario')
    }
  }

  const usuariosFiltrados = usuarios.filter(u => {
    const matchBusqueda = !busqueda ||
      u.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      u.identificador.toLowerCase().includes(busqueda.toLowerCase())
    const matchRol = !filtroRol || u.rol === filtroRol
    const matchSede = !filtroSede || String(u.sede_id) === filtroSede
    return matchBusqueda && matchRol && matchSede
  })

  const navItems = [
    { label: 'Resumen global', active: false, path: '/jefatura' },
    { label: 'Gestión de usuarios', active: true, path: '/jefatura/usuarios' },
    { label: 'Métricas y reportes', active: false, path: '/jefatura' },
    { label: 'Generador IA', active: false, path: '/jefatura/ia', new: true },
  ]

  return (
    <div className="app-shell">
      <Topbar seccion="Jefatura — Gestión de usuarios" />
      <div className="app-body">
        <Sidebar />

        <main className="main-content" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="page-title">Gestión de usuarios</div>
              <div className="page-sub">Crear y administrar usuarios de todas las sedes · {usuarios.filter(u => u.activo).length} activos</div>
            </div>
            <button className="btn-primary" onClick={() => { setMostrarForm(!mostrarForm); setError(''); setExito('') }}>
              {mostrarForm ? '✕ Cancelar' : '+ Nuevo usuario'}
            </button>
          </div>

          {/* Mensajes */}
          {exito && <div style={{ background:'#EDFAF3', border:'0.5px solid #7BC67A', borderRadius:8, padding:'10px 14px', fontSize:13, color:'#1A7A45' }}>✓ {exito}</div>}
          {error && <div style={{ background:'#FFF0F0', border:'0.5px solid #E8505B', borderRadius:8, padding:'10px 14px', fontSize:13, color:'#C0392B' }}>✗ {error}</div>}

          {/* Formulario */}
          {mostrarForm && (
            <div className="card">
              <div className="card-title" style={{ marginBottom: 16 }}>Nuevo usuario</div>
              <form onSubmit={handleCrear}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="field">
                    <label>Nombre completo *</label>
                    <input type="text" placeholder="Ej: María González"
                      value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>RUT o correo *</label>
                    <input type="text" placeholder="Ej: 12.345.678-9"
                      value={form.identificador} onChange={e => setForm({ ...form, identificador: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>Rol *</label>
                    <select value={form.rol} onChange={e => setForm({ ...form, rol: e.target.value })}>
                      {ROLES.map(r => <option key={r} value={r}>{ROL_LABEL[r]}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label>Sede</label>
                    <select value={form.sede_id} onChange={e => setForm({ ...form, sede_id: e.target.value })}>
                      <option value="">Sin sede asignada</option>
                      {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                    </select>
                  </div>
                  {form.rol === 'colaborador' && (
                    <>
                      <div className="field">
                        <label>Estamento</label>
                        <select value={form.estamento} onChange={e => setForm({ ...form, estamento: e.target.value })}>
                          <option value="">Seleccionar estamento</option>
                          {ESTAMENTOS.map(e => <option key={e} value={e}>{e}</option>)}
                        </select>
                      </div>
                      <div className="field">
                        <label>Tipo de contrato</label>
                        <select value={form.tipo_contrato} onChange={e => setForm({ ...form, tipo_contrato: e.target.value })}>
                          <option value="fijo">Fijo</option>
                          <option value="reemplazo">Reemplazo</option>
                        </select>
                      </div>
                    </>
                  )}
                </div>
                <div className="notice" style={{ marginBottom: 12 }}>
                  La contraseña inicial será <strong>alumco2026</strong>. El usuario podrá cambiarla después de su primer ingreso.
                </div>
                <button type="submit" className="btn-primary">Crear usuario</button>
              </form>
            </div>
          )}

          {/* Filtros */}
          <div className="card" style={{ padding: '12px 16px' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <input type="text" placeholder="Buscar por nombre o RUT..."
                value={busqueda} onChange={e => setBusqueda(e.target.value)}
                style={{ flex: 1, minWidth: 200, height: 36, border: '0.5px solid #E8E8E8', borderRadius: 8, padding: '0 12px', fontSize: 13, background: '#F4F5F7' }}
              />
              <select value={filtroRol} onChange={e => setFiltroRol(e.target.value)}
                style={{ height: 36, border: '0.5px solid #E8E8E8', borderRadius: 8, padding: '0 10px', fontSize: 13, background: '#F4F5F7' }}>
                <option value="">Todos los roles</option>
                {ROLES.map(r => <option key={r} value={r}>{ROL_LABEL[r]}</option>)}
              </select>
              <select value={filtroSede} onChange={e => setFiltroSede(e.target.value)}
                style={{ height: 36, border: '0.5px solid #E8E8E8', borderRadius: 8, padding: '0 10px', fontSize: 13, background: '#F4F5F7' }}>
                <option value="">Todas las sedes</option>
                {sedes.map(s => <option key={s.id} value={String(s.id)}>{s.nombre}</option>)}
              </select>
              {(busqueda || filtroRol || filtroSede) && (
                <button onClick={() => { setBusqueda(''); setFiltroRol(''); setFiltroSede('') }}
                  style={{ height: 36, background: 'none', border: '0.5px solid #E8E8E8', borderRadius: 8, padding: '0 12px', fontSize: 12, color: '#888', cursor: 'pointer' }}>
                  Limpiar filtros
                </button>
              )}
              <span style={{ fontSize: 12, color: '#888', marginLeft: 'auto' }}>
                {usuariosFiltrados.length} resultado{usuariosFiltrados.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Tabla usuarios */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {cargando ? (
              <div style={{ textAlign: 'center', color: '#888', padding: 32 }}>Cargando...</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#F4F5F7' }}>
                    {['Nombre', 'Identificador', 'Rol', 'Estamento', 'Sede', 'Contrato', 'Estado', 'Acciones'].map(h => (
                      <th key={h} style={{ fontSize: 11, fontWeight: 500, color: '#888', textAlign: 'left', padding: '10px 14px', borderBottom: '0.5px solid #E8E8E8' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {usuariosFiltrados.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', color: '#888', padding: 32 }}>No se encontraron usuarios</td></tr>
                  ) : usuariosFiltrados.map(u => (
                    <tr key={u.id} style={{ borderBottom: '0.5px solid #E8E8E8', opacity: u.activo ? 1 : 0.5 }}>
                      <td style={{ padding: '10px 14px', fontWeight: 500 }}>{u.nombre}</td>
                      <td style={{ padding: '10px 14px', color: '#888', fontSize: 12 }}>{u.identificador}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ fontSize: 10, background: `${ROL_COLOR[u.rol]}22`, color: ROL_COLOR[u.rol], borderRadius: 20, padding: '2px 8px', fontWeight: 500 }}>
                          {ROL_LABEL[u.rol]}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 11, color: '#555' }}>{u.estamento || '—'}</td>
                      <td style={{ padding: '10px 14px', color: '#888', fontSize: 12 }}>{u.sede_nombre || '—'}</td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: '#888' }}>
                        {u.tipo_contrato ? (u.tipo_contrato === 'fijo' ? 'Fijo' : 'Reemplazo') : '—'}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span className={`status-pill ${u.activo ? 'status-ok' : 'status-fallo'}`}>
                          {u.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        {u.activo ? (
                          <button className="btn-rechazar" onClick={() => handleDesactivar(u.id, u.nombre)}>
                            Desactivar
                          </button>
                        ) : (
                          <button className="btn-aprobar" onClick={() => handleReactivar(u.id, u.nombre)}>
                            Reactivar
                          </button>
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
