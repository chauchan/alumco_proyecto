import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Topbar from '../components/Topbar'
import api from '../services/api'

const ROLES = ['colaborador','profesor','admin_sede','jefatura']
const CONTRATOS = ['fijo','reemplazo']

export default function GestionUsuarios() {
  const navigate = useNavigate()
  const [usuarios, setUsuarios] = useState([])
  const [sedes, setSedes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm] = useState({ nombre:'', identificador:'', rol:'colaborador', tipo_contrato:'fijo', sede_id:'' })
  const [error, setError] = useState('')
  const [exito, setExito] = useState('')

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
      setExito(`Usuario "${form.nombre}" creado con contraseña: alumco2026`)
      setForm({ nombre:'', identificador:'', rol:'colaborador', tipo_contrato:'fijo', sede_id:'' })
      setMostrarForm(false)
      cargar()
    } catch (err) {
      setError(err.response?.data?.error || 'Error al crear usuario')
    }
  }

  const handleDesactivar = async (id, nombre) => {
    if (!confirm(`¿Desactivar a ${nombre}? Mantendrá su historial pero no podrá ingresar.`)) return
    try {
      await api.patch(`/usuarios/${id}`, { activo: false })
      setExito(`Usuario "${nombre}" desactivado correctamente`)
      cargar()
    } catch (err) {
      setError('Error al desactivar usuario')
    }
  }

  const rolColor = { jefatura:'#F5A623', admin_sede:'#7BC67A', profesor:'#E8505B', colaborador:'#2B4BA0' }
  const rolLabel = { jefatura:'Jefatura', admin_sede:'Admin sede', profesor:'Profesor', colaborador:'Colaborador' }

  const navItems = [
    { label:'Resumen global', active:false },
    { label:'Gestión de usuarios', active:true },
    { label:'Métricas y reportes', active:false },
    { label:'Generador IA', active:false, new:true },
  ]

  return (
    <div className="app-shell">
      <Topbar seccion="Jefatura — Gestión de usuarios" />
      <div className="app-body">
        <aside className="sidebar">
          <div className="nav-section-label">Global ONG</div>
          {navItems.map(item => (
            <div key={item.label}
              className={`nav-item ${item.active ? 'active' : ''}`}
              onClick={() => {
                if (item.label === 'Resumen global') navigate('/jefatura')
                if (item.label === 'Generador IA') navigate('/jefatura/ia')
              }}
            >
              <span style={{ flex:1 }}>{item.label}</span>
              {item.new && <span className="nav-new">Nuevo</span>}
            </div>
          ))}
        </aside>

        <main className="main-content" style={{ display:'flex', flexDirection:'column', gap:16 }}>

          {/* Header */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
            <div>
              <div className="page-title">Gestión de usuarios</div>
              <div className="page-sub">Crear, ver y administrar usuarios de todas las sedes</div>
            </div>
            <button className="btn-primary" onClick={() => { setMostrarForm(!mostrarForm); setError(''); setExito('') }}>
              {mostrarForm ? '✕ Cancelar' : '+ Nuevo usuario'}
            </button>
          </div>

          {/* Mensajes */}
          {exito && (
            <div style={{ background:'#EDFAF3', border:'0.5px solid #7BC67A', borderRadius:8, padding:'10px 14px', fontSize:13, color:'#1A7A45' }}>
              ✓ {exito}
            </div>
          )}
          {error && (
            <div style={{ background:'#FFF0F0', border:'0.5px solid #E8505B', borderRadius:8, padding:'10px 14px', fontSize:13, color:'#C0392B' }}>
              ✗ {error}
            </div>
          )}

          {/* Formulario crear usuario */}
          {mostrarForm && (
            <div className="card">
              <div className="card-title" style={{ marginBottom:16 }}>Nuevo usuario</div>
              <form onSubmit={handleCrear}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div className="field">
                    <label>Nombre completo *</label>
                    <input type="text" placeholder="Ej: María González"
                      value={form.nombre} onChange={e => setForm({...form, nombre:e.target.value})} />
                  </div>
                  <div className="field">
                    <label>RUT o correo *</label>
                    <input type="text" placeholder="Ej: 12.345.678-9"
                      value={form.identificador} onChange={e => setForm({...form, identificador:e.target.value})} />
                  </div>
                  <div className="field">
                    <label>Rol *</label>
                    <select value={form.rol} onChange={e => setForm({...form, rol:e.target.value})}>
                      {ROLES.map(r => <option key={r} value={r}>{rolLabel[r]}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label>Sede</label>
                    <select value={form.sede_id} onChange={e => setForm({...form, sede_id:e.target.value})}>
                      <option value="">Sin sede asignada</option>
                      {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                    </select>
                  </div>
                  {(form.rol === 'colaborador') && (
                    <div className="field">
                      <label>Tipo de contrato</label>
                      <select value={form.tipo_contrato} onChange={e => setForm({...form, tipo_contrato:e.target.value})}>
                        {CONTRATOS.map(c => <option key={c} value={c}>{c === 'fijo' ? 'Fijo' : 'Reemplazo'}</option>)}
                      </select>
                    </div>
                  )}
                </div>
                <div className="notice" style={{ marginBottom:12 }}>
                  La contraseña predeterminada será <strong>alumco2026</strong>. El usuario podrá cambiarla después de su primer ingreso.
                </div>
                <button type="submit" className="btn-primary">Crear usuario</button>
              </form>
            </div>
          )}

          {/* Tabla usuarios */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Todos los usuarios ({usuarios.length})</span>
            </div>
            {cargando ? (
              <div style={{ textAlign:'center', color:'#888', padding:24 }}>Cargando...</div>
            ) : (
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead>
                  <tr>
                    {['Nombre','Identificador','Rol','Sede','Contrato','Estado','Acciones'].map(h => (
                      <th key={h} style={{ fontSize:11, fontWeight:500, color:'#888', textAlign:'left', padding:'6px 8px', borderBottom:'0.5px solid #E8E8E8' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map(u => (
                    <tr key={u.id} style={{ borderBottom:'0.5px solid #E8E8E8', opacity: u.activo ? 1 : 0.5 }}>
                      <td style={{ padding:'10px 8px', fontWeight:500 }}>{u.nombre}</td>
                      <td style={{ padding:'10px 8px', color:'#888' }}>{u.identificador}</td>
                      <td style={{ padding:'10px 8px' }}>
                        <span style={{ fontSize:10, background:`${rolColor[u.rol]}22`, color:rolColor[u.rol], borderRadius:20, padding:'2px 8px', fontWeight:500 }}>
                          {rolLabel[u.rol]}
                        </span>
                      </td>
                      <td style={{ padding:'10px 8px', color:'#888', fontSize:12 }}>{u.sede_nombre || '—'}</td>
                      <td style={{ padding:'10px 8px', color:'#888', fontSize:12 }}>
                        {u.tipo_contrato ? (u.tipo_contrato === 'fijo' ? 'Fijo' : 'Reemplazo') : '—'}
                      </td>
                      <td style={{ padding:'10px 8px' }}>
                        <span className={`status-pill ${u.activo ? 'status-ok' : 'status-fallo'}`}>
                          {u.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td style={{ padding:'10px 8px' }}>
                        {u.activo && (
                          <button
                            className="btn-rechazar"
                            onClick={() => handleDesactivar(u.id, u.nombre)}
                          >
                            Desactivar
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
