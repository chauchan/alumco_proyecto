import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Topbar from '../components/Topbar'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

export default function MisDatos() {
  const { usuario, setUsuario } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', telefono: '' })
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [exito, setExito] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/auth/me')
      .then(res => {
        setForm({
          email:    res.data.email    || '',
          telefono: res.data.telefono || '',
        })
      })
      .catch(() => {})
      .finally(() => setCargando(false))
  }, [])

  const handleGuardar = async (e) => {
    e.preventDefault()
    setError(''); setExito('')

    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      return setError('El correo electrónico no tiene un formato válido')
    }
    if (form.telefono && !/^[0-9+\s\-()]{7,15}$/.test(form.telefono)) {
      return setError('El teléfono no tiene un formato válido')
    }

    setGuardando(true)
    try {
      await api.patch('/auth/mis-datos', {
        email:    form.email    || null,
        telefono: form.telefono || null,
      })
      setExito('Datos actualizados correctamente')
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar los datos')
    } finally {
      setGuardando(false)
    }
  }

  const rutaVolver = {
    colaborador: '/colaborador', profesor: '/profesor',
    admin_sede: '/admin', jefatura: '/jefatura',
  }

  return (
    <div className="app-shell">
      <Topbar seccion="Mis datos" />
      <div className="app-body">
        <Sidebar />
        <main className="main-content" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          <div>
            <div className="page-title">Mis datos</div>
            <div className="page-sub">Actualiza tu información de contacto</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>

            {/* Formulario */}
            <div className="card">
              <div className="card-title" style={{ marginBottom: 20 }}>Información de contacto</div>

              {cargando ? (
                <div style={{ textAlign: 'center', color: '#888', padding: 24 }}>Cargando...</div>
              ) : (
                <form onSubmit={handleGuardar}>
                  <div className="field">
                    <label>Correo electrónico</label>
                    <input
                      type="email"
                      placeholder="correo@ejemplo.com"
                      value={form.email}
                      onChange={e => setForm({ ...form, email: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label>Teléfono</label>
                    <input
                      type="tel"
                      placeholder="+56 9 1234 5678"
                      value={form.telefono}
                      onChange={e => setForm({ ...form, telefono: e.target.value })}
                    />
                  </div>

                  {exito && (
                    <div style={{ background: '#EDFAF3', border: '0.5px solid #7BC67A', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#1A7A45', marginBottom: 14 }}>
                      ✓ {exito}
                    </div>
                  )}
                  {error && (
                    <div style={{ background: '#FFF0F0', border: '0.5px solid #E8505B', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#C0392B', marginBottom: 14 }}>
                      ✗ {error}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="submit" className="btn-primary" disabled={guardando}>
                      {guardando ? 'Guardando...' : 'Guardar cambios'}
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(rutaVolver[usuario?.rol] || '/')}
                      style={{ background: 'none', border: '0.5px solid #E8E8E8', borderRadius: 8, padding: '8px 14px', fontSize: 13, color: '#888', cursor: 'pointer' }}
                    >
                      Volver
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Info no editable */}
            <div className="card">
              <div className="card-title" style={{ marginBottom: 20 }}>Información de cuenta</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[
                  { label: 'Nombre completo', value: usuario?.nombre },
                  { label: 'Identificador (RUT)', value: usuario?.identificador },
                  { label: 'Rol', value: {
                    colaborador: 'Colaborador',
                    profesor: 'Profesor',
                    admin_sede: 'Administrador de sede',
                    jefatura: 'Jefatura',
                  }[usuario?.rol] },
                  { label: 'Sede', value: usuario?.sede_nombre || '—' },
                  { label: 'Tipo de contrato', value: usuario?.tipo_contrato === 'fijo' ? 'Fijo' : usuario?.tipo_contrato === 'reemplazo' ? 'Reemplazo' : '—' },
                ].map(item => (
                  <div key={item.label}>
                    <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>{item.label}</div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{item.value || '—'}</div>
                  </div>
                ))}
              </div>
              <div className="notice" style={{ marginTop: 20 }}>
                Para modificar tu nombre, RUT, sede o rol, contacta al administrador de tu sede.
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
