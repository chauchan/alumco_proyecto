import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import api from '../services/api'
import { useToast } from '../context/ToastContext'
import { LOGO_SIMBOLO, LOGO_LETRAS } from '../assets/logo'

export default function ResetPassword() {
  const { token } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [form, setForm] = useState({ password: '', confirmar: '' })
  const [cargando, setCargando] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.password || !form.confirmar) return toast.warn('Completa ambos campos')
    if (form.password !== form.confirmar) return toast.error('Las contraseñas no coinciden')
    if (form.password.length < 6) return toast.error('La contraseña debe tener al menos 6 caracteres')

    setCargando(true)
    try {
      await api.post('/auth/reset-password', { token, nueva_password: form.password })
      toast.success('Contraseña actualizada correctamente')
      navigate('/login')
    } catch (err) {
      toast.error(err.response?.data?.error || 'El enlace es inválido o ha expirado')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--gris-fondo)' }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: '2.5rem', width: '100%', maxWidth: 420, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <img src={LOGO_SIMBOLO} alt="ALUMCO" style={{ height: 36 }} />
          <img src={LOGO_LETRAS} alt="alumco" style={{ height: 18 }} />
        </div>

        <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 6 }}>Nueva contraseña</div>
        <div style={{ fontSize: 13, color: 'var(--texto-muted)', marginBottom: 24, lineHeight: 1.6 }}>
          Ingresa tu nueva contraseña. Debe tener al menos 6 caracteres.
        </div>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Nueva contraseña</label>
            <input
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              style={{ height: 42 }}
            />
          </div>
          <div className="field">
            <label>Confirmar contraseña</label>
            <input
              type="password"
              placeholder="••••••••"
              value={form.confirmar}
              onChange={e => setForm({ ...form, confirmar: e.target.value })}
              style={{ height: 42 }}
            />
          </div>
          <button type="submit" disabled={cargando} style={{
            width: '100%', height: 44, background: 'var(--azul)', color: '#fff',
            border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500,
            cursor: cargando ? 'not-allowed' : 'pointer', marginBottom: 16,
          }}>
            {cargando ? 'Guardando...' : 'Guardar contraseña'}
          </button>
        </form>
        <Link to="/login" style={{ fontSize: 13, color: 'var(--azul)' }}>← Volver al inicio de sesión</Link>
      </div>
    </div>
  )
}
