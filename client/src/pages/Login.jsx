import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { LogoSVG } from '../components/Topbar'

const RUTA = { colaborador:'/colaborador', profesor:'/profesor', admin_sede:'/admin', jefatura:'/jefatura' }

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ identificador:'', password:'' })
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.identificador || !form.password) return setError('Completa todos los campos')
    setCargando(true); setError('')
    try {
      const u = await login(form.identificador, form.password)
      navigate(RUTA[u.rol] || '/')
    } catch (err) {
      setError(err.response?.data?.error || 'Credenciales incorrectas')
    } finally { setCargando(false) }
  }

  return (
    <div style={{ display:'flex', minHeight:'100vh' }}>

      {/* Panel izquierdo */}
      <div style={{
        width:'44%', background:'#2B4BA0', display:'flex', flexDirection:'column',
        justifyContent:'space-between', padding:'2.5rem 2rem', position:'relative', overflow:'hidden'
      }}>
        {/* Logo */}
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:8 }}>
            <LogoSVG size={48} />
            <div>
              <div style={{ fontSize:28, fontWeight:500, color:'#fff', letterSpacing:1 }}>alumco</div>
              <div style={{ fontSize:12, color:'rgba(255,255,255,0.6)', marginTop:2 }}>Plataforma de Capacitación</div>
            </div>
          </div>
          <p style={{ fontSize:15, color:'rgba(255,255,255,0.88)', fontStyle:'italic', lineHeight:1.75, marginTop:24 }}>
            "Nuestros cuidados son el<br/>reflejo de la empatía."
          </p>
        </div>

        {/* Deco geométrica fondo */}
        <svg style={{ position:'absolute', bottom:-30, right:-30, opacity:0.12 }} width="180" height="180" viewBox="0 0 100 100">
          <polygon points="50,5 95,50 50,95 5,50" fill="white"/>
        </svg>
      </div>

      {/* Panel derecho */}
      <div style={{ flex:1, background:'white', display:'flex', flexDirection:'column' }}>
        <div style={{ flex:1, padding:'2.5rem', display:'flex', flexDirection:'column', justifyContent:'center' }}>
          <div style={{ fontSize:20, fontWeight:500, marginBottom:4 }}>Bienvenida/o</div>
          <div style={{ fontSize:13, color:'#888', marginBottom:32, lineHeight:1.6 }}>
            Ingresa con las credenciales entregadas<br/>por tu organización
          </div>

          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>RUT o correo</label>
              <input type="text" placeholder="12.345.678-9"
                value={form.identificador}
                onChange={e => setForm({...form, identificador: e.target.value})}
                style={{ height:42 }}
              />
            </div>
            <div className="field">
              <label>Contraseña</label>
              <input type="password" placeholder="••••••••"
                value={form.password}
                onChange={e => setForm({...form, password: e.target.value})}
                style={{ height:42 }}
              />
            </div>

            <div style={{ textAlign:'right', fontSize:12, color:'#2B4BA0', cursor:'pointer', marginBottom:18 }}>
              ¿Olvidaste tu contraseña?
            </div>

            {error && <p style={{ color:'#E8505B', fontSize:13, marginBottom:12 }}>{error}</p>}

            <button type="submit" disabled={cargando} style={{
              width:'100%', height:44, background:'#2B4BA0', color:'#fff', border:'none',
              borderRadius:8, fontSize:14, fontWeight:500, cursor:'pointer',
              display:'flex', alignItems:'center', justifyContent:'center', gap:8
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                <polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>
              </svg>
              {cargando ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>

          <div className="notice" style={{ marginTop:24 }}>
            Las cuentas son creadas por el administrador de tu sede. Si no tienes acceso, contacta al encargado de tu ELEAM.
          </div>
        </div>

        {/* Barra accesibilidad */}
        <div style={{
          borderTop:'0.5px solid #E8E8E8', padding:'10px 2.5rem',
          display:'flex', alignItems:'center', gap:10, background:'#F9F9F9'
        }}>
          <span style={{ fontSize:11, color:'#888' }}>Accesibilidad:</span>
          {['A+ Texto grande','Alto contraste'].map(l => (
            <button key={l} style={{
              fontSize:11, color:'#888', background:'white', border:'0.5px solid #E8E8E8',
              borderRadius:20, padding:'4px 10px', cursor:'pointer'
            }}>{l}</button>
          ))}
        </div>
      </div>
    </div>
  )
}
