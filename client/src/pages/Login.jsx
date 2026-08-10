import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Icon } from '@iconify/react'
import { useAuth } from '../context/AuthContext'
import { LOGO_SIMBOLO, LOGO_LETRAS } from '../assets/logo'
import { useAccesibilidad } from '../hooks/useAccesibilidad'

const RUTA = { colaborador:'/colaborador', profesor:'/profesor', admin_sede:'/admin', jefatura:'/jefatura' }

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ identificador:'', password:'' })
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const [verPassword, setVerPassword] = useState(false)
  const { acc, toggle } = useAccesibilidad()

  // Qué campos marcar en rojo. 'ambos' cubre el caso de credenciales
  // incorrectas, donde el servidor no dice cuál de los dos falló.
  const [campoError, setCampoError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.identificador || !form.password) {
      setCampoError(!form.identificador ? 'identificador' : 'password')
      return setError('Completa todos los campos para poder ingresar.')
    }
    setCargando(true); setError(''); setCampoError(null)
    try {
      const u = await login(form.identificador, form.password)
      navigate(RUTA[u.rol] || '/')
    } catch (err) {
      setCampoError('ambos')
      setError(err.response?.data?.error || 'El RUT o la contraseña no coinciden. Revisa los datos e inténtalo de nuevo.')
    } finally { setCargando(false) }
  }

  const marcado = (campo) => campoError === campo || campoError === 'ambos'
  const estiloCampo = (campo) => marcado(campo)
    ? { height:42, borderColor:'var(--danger)', boxShadow:'0 0 0 3px rgba(192,57,43,0.10)' }
    : { height:42 }

  return (
    <div style={{ display:'flex', minHeight:'100vh' }}>

      {/* Panel izquierdo */}
      <div style={{
        width:'44%',
        background: 'var(--gradiente-login)',
        display:'flex', flexDirection:'column',
        justifyContent:'center', alignItems:'center',
        padding:'3rem 2.5rem', position:'relative', overflow:'hidden',
        gap: 0,
      }}>

        {/* Decoración superior derecha */}
        <div style={{
          position:'absolute', top:-60, right:-60,
          width:220, height:220, borderRadius:'50%',
          background:'rgba(255,255,255,0.06)'
        }} />
        <div style={{
          position:'absolute', top:30, right:30,
          width:90, height:90, borderRadius:'50%',
          background:'rgba(255,255,255,0.06)'
        }} />

        {/* Decoración inferior izquierda */}
        <div style={{
          position:'absolute', bottom:-80, left:-50,
          width:260, height:260, borderRadius:'50%',
          background:'rgba(255,255,255,0.05)'
        }} />
        <svg style={{ position:'absolute', bottom:32, right:32, opacity:0.08 }} width="140" height="140" viewBox="0 0 100 100">
          <polygon points="50,5 95,50 50,95 5,50" fill="white"/>
        </svg>

        {/* Logo centrado */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:20, zIndex:1 }}>
          <img src={LOGO_SIMBOLO} alt="ALUMCO" style={{ height: 100 }} />

          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <img src={LOGO_LETRAS} alt="alumco" style={{ height: 32, filter: 'brightness(0) invert(1)' }} />
              <div style={{
                width: 1, height: 28, background: 'rgba(255,255,255,0.35)'
              }} />
              <span style={{
                fontSize: 18, fontWeight: 300, color: '#fff',
                letterSpacing: '0.18em', textTransform: 'uppercase'
              }}>Capacitaciones</span>
            </div>
          </div>

          {/* Slogan */}
          <div style={{
            marginTop: 28,
            maxWidth: 300,
            textAlign: 'center',
            fontSize: 15,
            fontWeight: 400,
            color: 'rgba(255,255,255,0.75)',
            lineHeight: 1.65,
            fontStyle: 'italic',
            borderTop: '1px solid rgba(255,255,255,0.18)',
            paddingTop: 24,
          }}>
            "Nuestros Cuidados son el reflejo de la Empatía."
          </div>
        </div>
      </div>

      {/* Panel derecho */}
      <div style={{ flex:1, background:'white', display:'flex', flexDirection:'column' }}>
        <div style={{ flex:1, padding:'2.5rem', display:'flex', flexDirection:'column', justifyContent:'center' }}>
          <div style={{ fontSize:20, fontWeight:500, marginBottom:4 }}>Bienvenida/o</div>
          <div style={{ fontSize:13, color:'var(--texto-muted)', marginBottom:32, lineHeight:1.6 }}>
            Ingresa con las credenciales entregadas<br/>por tu organización
          </div>

          {/* noValidate: los campos siguen marcados como required para el lector
              de pantalla, pero la validación la hacemos nosotros para mostrar el
              mensaje diseñado y no la burbuja nativa del navegador. */}
          <form onSubmit={handleSubmit} noValidate>
            <div className="field">
              <label htmlFor="login-identificador">
                RUT o correo <span aria-hidden="true" style={{ color:'var(--danger)' }}>*</span>
              </label>
              <input id="login-identificador" type="text" placeholder="12.345.678-9"
                value={form.identificador}
                onChange={e => setForm({...form, identificador: e.target.value})}
                aria-invalid={marcado('identificador')}
                aria-describedby={error ? 'login-error' : undefined}
                required
                style={estiloCampo('identificador')}
              />
            </div>
            <div className="field">
              <label htmlFor="login-password">
                Contraseña <span aria-hidden="true" style={{ color:'var(--danger)' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input id="login-password" type={verPassword ? 'text' : 'password'} placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm({...form, password: e.target.value})}
                  aria-invalid={marcado('password')}
                  aria-describedby={error ? 'login-error' : undefined}
                  required
                  style={{ ...estiloCampo('password'), width:'100%', paddingRight: 40 }}
                />
                <button type="button" onClick={() => setVerPassword(v => !v)}
                  style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--texto-muted)', padding:0, display:'flex', alignItems:'center' }}>
                  <Icon icon={verPassword ? 'lucide:eye-off' : 'lucide:eye'} width={18} />
                </button>
              </div>
            </div>

            <div style={{ textAlign:'right', marginBottom:18 }}>
              <Link to="/forgot-password" style={{ fontSize:12, color:'var(--azul)' }}>
                ¿Olvidaste tu contraseña?
              </Link>
            </div>

            {/* role="alert" hace que el lector de pantalla anuncie el error sin
                que el usuario tenga que volver a recorrer el formulario. */}
            {error && (
              <p id="login-error" role="alert" style={{
                display:'flex', alignItems:'flex-start', gap:8,
                background:'var(--danger-bg)', color:'var(--danger)',
                border:'0.5px solid var(--danger)', borderRadius:'var(--radius-md)',
                padding:'9px 12px', fontSize:13, lineHeight:1.5, marginBottom:12,
              }}>
                <Icon icon="lucide:alert-circle" width={16} style={{ flexShrink:0, marginTop:1 }} />
                {error}
              </p>
            )}

            <button type="submit" disabled={cargando} style={{
              width:'100%', height:44, background:'var(--azul)', color:'#fff', border:'none',
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
          borderTop:'0.5px solid var(--gris-borde)', padding:'10px 2.5rem',
          display:'flex', alignItems:'center', gap:10, background:'#F9F9F9'
        }}>
          <span style={{ fontSize:11, color:'var(--texto-muted)' }}>Accesibilidad:</span>
          <button onClick={() => toggle('textoGrande')} style={{
            fontSize:11, cursor:'pointer', borderRadius:20, padding:'4px 10px',
            border: acc.textoGrande ? '1.5px solid var(--azul)' : '0.5px solid var(--gris-borde)',
            background: acc.textoGrande ? 'var(--azul-claro)' : 'white',
            color: acc.textoGrande ? 'var(--azul)' : 'var(--texto-muted)',
            fontWeight: acc.textoGrande ? 600 : 400,
          }}>A+ Texto grande</button>
          <button onClick={() => toggle('altoContraste')} style={{
            fontSize:11, cursor:'pointer', borderRadius:20, padding:'4px 10px',
            border: acc.altoContraste ? '1.5px solid var(--texto)' : '0.5px solid var(--gris-borde)',
            background: acc.altoContraste ? 'var(--texto)' : 'white',
            color: acc.altoContraste ? '#fff' : 'var(--texto-muted)',
            fontWeight: acc.altoContraste ? 600 : 400,
          }}>Alto contraste</button>
        </div>
      </div>
    </div>
  )
}