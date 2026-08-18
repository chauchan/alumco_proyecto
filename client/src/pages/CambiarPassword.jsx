import { useState } from 'react'
import { Icon } from '@iconify/react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

export default function CambiarPassword() {
  const { usuario, logout } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ password_actual: '', password_nueva: '', password_confirmar: '' })
  const [error, setError] = useState('')
  const [exito, setExito] = useState('')
  const [cargando, setCargando] = useState(false)
  const [ver, setVer] = useState({ actual: false, nueva: false, confirmar: false })

  const rutaVolver = {
    colaborador: '/colaborador',
    profesor:    '/profesor',
    admin_sede:  '/admin',
    jefatura:    '/jefatura',
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(''); setExito('')

    if (!form.password_actual || !form.password_nueva || !form.password_confirmar) {
      return setError('Todos los campos son obligatorios')
    }
    if (form.password_nueva.length < 6) {
      return setError('La nueva contraseña debe tener al menos 6 caracteres')
    }
    if (form.password_nueva !== form.password_confirmar) {
      return setError('Las contraseñas nuevas no coinciden')
    }
    if (form.password_nueva === form.password_actual) {
      return setError('La nueva contraseña debe ser diferente a la actual')
    }

    setCargando(true)
    try {
      await api.post('/auth/cambiar-password', {
        password_actual: form.password_actual,
        password_nueva:  form.password_nueva,
      })
      setExito('Contraseña actualizada correctamente. Serás redirigido al inicio de sesión.')
      setForm({ password_actual: '', password_nueva: '', password_confirmar: '' })
      // Cerrar sesión y redirigir al login después de 2 segundos
      setTimeout(() => {
        logout()
        navigate('/login')
      }, 2000)
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cambiar la contraseña')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--gris-fondo)', display: 'flex', flexDirection: 'column' }}>

      {/* Topbar simple */}
      <header style={{
        background: 'var(--azul)', height: 56,
        display: 'flex', alignItems: 'center', padding: '0 24px', gap: 12
      }}>
        <span style={{ fontSize: 18, fontWeight: 500, color: '#fff', letterSpacing: 0.5 }}>alumco</span>
        <div style={{ width: 1, height: 22, background: 'rgba(255,255,255,0.25)' }} />
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>Cambiar contraseña</span>
      </header>

      {/* Contenido centrado */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{
          background: 'white', borderRadius: 14,
          border: '0.5px solid var(--gris-borde)',
          padding: '32px 36px', width: '100%', maxWidth: 440
        }}>
          {/* Ícono candado */}
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            background: 'var(--azul-claro)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', marginBottom: 20
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--azul)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>

          <div style={{ fontSize: 20, fontWeight: 500, marginBottom: 4 }}>Cambiar contraseña</div>
          <div style={{ fontSize: 13, color: 'var(--texto-muted)', marginBottom: 28 }}>
            Hola, <strong>{usuario?.nombre?.split(' ')[0]}</strong>. Ingresa tu contraseña actual y la nueva.
          </div>

          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>Contraseña actual</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={ver.actual ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form.password_actual}
                  onChange={e => setForm({ ...form, password_actual: e.target.value })}
                  style={{ height: 42, width: '100%', paddingRight: 40 }}
                />
                <button type="button" onClick={() => setVer(v => ({ ...v, actual: !v.actual }))}
                  style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--texto-muted)', padding:0, display:'flex', alignItems:'center' }}>
                  <Icon icon={ver.actual ? 'lucide:eye-off' : 'lucide:eye'} width={18} />
                </button>
              </div>
            </div>

            <div className="field">
              <label>Nueva contraseña</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={ver.nueva ? 'text' : 'password'}
                  placeholder="Mínimo 6 caracteres"
                  value={form.password_nueva}
                  onChange={e => setForm({ ...form, password_nueva: e.target.value })}
                  style={{ height: 42, width: '100%', paddingRight: 40 }}
                />
                <button type="button" onClick={() => setVer(v => ({ ...v, nueva: !v.nueva }))}
                  style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--texto-muted)', padding:0, display:'flex', alignItems:'center' }}>
                  <Icon icon={ver.nueva ? 'lucide:eye-off' : 'lucide:eye'} width={18} />
                </button>
              </div>
            </div>

            <div className="field">
              <label>Confirmar nueva contraseña</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={ver.confirmar ? 'text' : 'password'}
                  placeholder="Repite la nueva contraseña"
                  value={form.password_confirmar}
                  onChange={e => setForm({ ...form, password_confirmar: e.target.value })}
                  style={{ height: 42, width: '100%', paddingRight: 40 }}
                />
                <button type="button" onClick={() => setVer(v => ({ ...v, confirmar: !v.confirmar }))}
                  style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--texto-muted)', padding:0, display:'flex', alignItems:'center' }}>
                  <Icon icon={ver.confirmar ? 'lucide:eye-off' : 'lucide:eye'} width={18} />
                </button>
              </div>
            </div>

            {error && (
              <div style={{
                background: 'var(--danger-bg)', border: '0.5px solid var(--rojo)',
                borderRadius: 8, padding: '10px 14px',
                fontSize: 13, color: 'var(--danger)', marginBottom: 16
              }}>
                {error}
              </div>
            )}

            {exito && (
              <div style={{
                background: 'var(--success-bg)', border: '0.5px solid var(--verde)',
                borderRadius: 8, padding: '10px 14px',
                fontSize: 13, color: 'var(--success)', marginBottom: 16
              }}>
                <Icon icon="lucide:check" width={14} style={{verticalAlign:"middle",marginRight:4}} /> {exito}
              </div>
            )}

            <button
              type="submit"
              disabled={cargando}
              style={{
                width: '100%', height: 44, background: 'var(--azul)',
                color: 'white', border: 'none', borderRadius: 8,
                fontSize: 14, fontWeight: 500, cursor: 'pointer', marginBottom: 12
              }}
            >
              {cargando ? 'Actualizando...' : 'Actualizar contraseña'}
            </button>

            <button
              type="button"
              onClick={() => navigate(rutaVolver[usuario?.rol] || '/')}
              style={{
                width: '100%', height: 40, background: 'none',
                color: 'var(--texto-muted)', border: '0.5px solid var(--gris-borde)',
                borderRadius: 8, fontSize: 13, cursor: 'pointer'
              }}
            >
              Volver
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
