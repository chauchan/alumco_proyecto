import { useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import { useToast } from '../context/ToastContext'
import { LOGO_SIMBOLO, LOGO_LETRAS } from '../assets/logo'

export default function ForgotPassword() {
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [cargando, setCargando] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim()) return toast.warn('Ingresa tu correo electrónico')
    setCargando(true)
    try {
      await api.post('/auth/forgot-password', { email: email.trim() })
    } catch {
      // el endpoint siempre responde 200; cualquier error de red igual mostramos el aviso
    } finally {
      setCargando(false)
      setEnviado(true)
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--gris-fondo)' }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: '2.5rem', width: '100%', maxWidth: 420, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <img src={LOGO_SIMBOLO} alt="ALUMCO" style={{ height: 36 }} />
          <img src={LOGO_LETRAS} alt="alumco" style={{ height: 18, filter: 'brightness(0) invert(0)' }} />
        </div>

        <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 6 }}>Recuperar contraseña</div>

        {enviado ? (
          <div>
            <div className="notice" style={{ marginBottom: 20 }}>
              Si el correo ingresado está registrado, recibirás un enlace para restablecer tu contraseña en los próximos minutos.
            </div>
            <Link to="/login" style={{ fontSize: 13, color: 'var(--azul)' }}>← Volver al inicio de sesión</Link>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 13, color: 'var(--texto-muted)', marginBottom: 24, lineHeight: 1.6 }}>
              Ingresa tu correo electrónico y te enviaremos instrucciones para restablecer tu contraseña.
            </div>
            <form onSubmit={handleSubmit}>
              <div className="field">
                <label>Correo electrónico</label>
                <input
                  type="email"
                  placeholder="tu@correo.cl"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  style={{ height: 42 }}
                />
              </div>
              <button type="submit" disabled={cargando} style={{
                width: '100%', height: 44, background: 'var(--azul)', color: '#fff',
                border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500,
                cursor: cargando ? 'not-allowed' : 'pointer', marginBottom: 16,
              }}>
                {cargando ? 'Enviando...' : 'Enviar instrucciones'}
              </button>
            </form>
            <Link to="/login" style={{ fontSize: 13, color: 'var(--azul)' }}>← Volver al inicio de sesión</Link>
          </>
        )}
      </div>
    </div>
  )
}
