import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

import LOGO from '../assets/logo'


const RUTA_POR_ROL = {
  colaborador: '/colaborador',
  profesor: '/profesor',
  admin_sede: '/admin',
  jefatura: '/jefatura',
}

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ identificador: '', password: '' })
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.identificador || !form.password) {
      return setError('Completa todos los campos')
    }
    setCargando(true)
    setError('')
    try {
      const usuario = await login(form.identificador, form.password)
      navigate(RUTA_POR_ROL[usuario.rol] || '/')
    } catch (err) {
      setError(err.response?.data?.error || 'Error al iniciar sesión')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Panel izquierdo */}
      <div style={{
        width: '44%', background: '#2B4BA0',
        display: 'flex', flexDirection: 'column',
        justifyContent: 'space-between', padding: '40px 32px'
      }}>
        <div>
          <img src={LOGO} alt="ALUMCO" style={{ height: 56, marginBottom: 16 }} />
          <p style={{ color: 'rgba(255,255,255,0.88)', fontSize: 16, fontStyle: 'italic', lineHeight: 1.7 }}>
            "Nuestros cuidados son el reflejo de la empatía."
          </p>
        </div>
        <div>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
            Sedes activas
          </p>
          {['Hualpén', 'Coyhaique'].map(s => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(255,255,255,0.45)' }} />
              <span style={{ color: 'rgba(255,255,255,0.72)', fontSize: 13 }}>{s}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Panel derecho */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        justifyContent: 'center', padding: '40px 60px',
        background: 'white'
      }}>
        <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 4 }}>Bienvenida/o</h1>
        <p style={{ color: '#666', fontSize: 14, marginBottom: 32 }}>
          Ingresa con las credenciales entregadas por tu organización
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#555', marginBottom: 6 }}>
              RUT o correo
            </label>
            <input
              type="text"
              placeholder="12.345.678-9"
              value={form.identificador}
              onChange={e => setForm({ ...form, identificador: e.target.value })}
              style={{
                width: '100%', height: 46, border: '1px solid #E0E0E0',
                borderRadius: 8, padding: '0 14px', fontSize: 14,
                background: '#F4F5F7', outline: 'none'
              }}
            />
          </div>

          <div style={{ marginBottom: 8 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#555', marginBottom: 6 }}>
              Contraseña
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              style={{
                width: '100%', height: 46, border: '1px solid #E0E0E0',
                borderRadius: 8, padding: '0 14px', fontSize: 14,
                background: '#F4F5F7', outline: 'none'
              }}
            />
          </div>

          {error && (
            <p style={{ color: '#E8505B', fontSize: 13, marginBottom: 12 }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={cargando}
            className="btn-primary"
            style={{ width: '100%', height: 48, marginTop: 16, fontSize: 15 }}
          >
            {cargando ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <div style={{
          marginTop: 24, background: '#FFF8EC', borderLeft: '3px solid #F5A623',
          borderRadius: '0 8px 8px 0', padding: '10px 14px', fontSize: 12, color: '#7A5C1E'
        }}>
          Las cuentas son creadas por el administrador de tu sede.
          Si no tienes acceso, contacta al encargado de tu ELEAM.
        </div>
      </div>
    </div>
  )
}
