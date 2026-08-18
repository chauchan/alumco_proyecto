import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '@iconify/react'
import api from '../services/api'

// Buscador global: Cmd/Ctrl+K desde cualquier pantalla autenticada, o el
// ícono de lupa en el topbar. Los resultados respetan el mismo alcance por
// rol que sus pantallas dedicadas (ver server/src/routes/buscar.js) — este
// componente solo pinta lo que el backend ya filtró.
export default function BuscadorGlobal() {
  const navigate = useNavigate()
  const [abierto, setAbierto] = useState(false)
  const [q, setQ] = useState('')
  const [resultados, setResultados] = useState({ cursos: [], usuarios: [] })
  const [buscando, setBuscando] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    const onKey = e => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setAbierto(v => !v)
      } else if (e.key === 'Escape' && abierto) {
        setAbierto(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [abierto])

  useEffect(() => {
    if (abierto) {
      requestAnimationFrame(() => inputRef.current?.focus())
    } else {
      setQ('')
      setResultados({ cursos: [], usuarios: [] })
    }
  }, [abierto])

  useEffect(() => {
    const texto = q.trim()
    if (texto.length < 2) {
      setResultados({ cursos: [], usuarios: [] })
      setBuscando(false)
      return
    }
    setBuscando(true)
    const t = setTimeout(() => {
      api.get('/buscar', { params: { q: texto } })
        .then(r => setResultados(r.data))
        .catch(() => setResultados({ cursos: [], usuarios: [] }))
        .finally(() => setBuscando(false))
    }, 300)
    return () => clearTimeout(t)
  }, [q])

  const ir = (path) => { setAbierto(false); navigate(path) }
  const hayResultados = resultados.cursos.length > 0 || resultados.usuarios.length > 0
  const texto = q.trim()

  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        title="Buscar (Ctrl+K)"
        aria-label="Buscar"
        style={{
          background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)',
          borderRadius: 7, padding: '4px 8px', cursor: 'pointer', color: '#fff',
          display: 'flex', alignItems: 'center',
        }}>
        <Icon icon="lucide:search" width={15} />
      </button>

      {abierto && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            zIndex: 1000, padding: '12vh 16px 16px',
          }}
          onClick={() => setAbierto(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 12, width: '100%', maxWidth: 520,
              boxShadow: '0 8px 32px rgba(0,0,0,0.25)', overflow: 'hidden',
            }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '0.5px solid var(--gris-borde)' }}>
              <Icon icon="lucide:search" width={16} style={{ color: 'var(--texto-muted)', flexShrink: 0 }} />
              <input
                ref={inputRef}
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Buscar cursos, colaboradores..."
                style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, background: 'transparent' }}
              />
              <button onClick={() => setAbierto(false)} aria-label="Cerrar"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--texto-muted)', display: 'flex' }}>
                <Icon icon="lucide:x" width={16} />
              </button>
            </div>

            <div style={{ maxHeight: '55vh', overflowY: 'auto' }}>
              {texto.length < 2 ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--texto-muted)', fontSize: 13 }}>
                  Escribe al menos 2 letras para buscar
                </div>
              ) : buscando ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--texto-muted)', fontSize: 13 }}>
                  Buscando...
                </div>
              ) : !hayResultados ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--texto-muted)', fontSize: 13 }}>
                  Sin resultados para "{texto}"
                </div>
              ) : (
                <>
                  {resultados.cursos.length > 0 && (
                    <div style={{ padding: '8px 0' }}>
                      <div style={{ padding: '4px 16px', fontSize: 10, fontWeight: 700, color: 'var(--texto-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Cursos
                      </div>
                      {resultados.cursos.map(c => (
                        <div key={c.id} onClick={() => ir(`/capacitaciones/${c.id}`)}
                          style={{ padding: '9px 16px', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, color: 'var(--texto)' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--gris-fondo)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <Icon icon="lucide:graduation-cap" width={14} style={{ color: 'var(--texto-muted)', flexShrink: 0 }} />
                          {c.nombre}
                        </div>
                      ))}
                    </div>
                  )}
                  {resultados.usuarios.length > 0 && (
                    <div style={{ padding: '8px 0', borderTop: resultados.cursos.length > 0 ? '0.5px solid var(--gris-borde)' : 'none' }}>
                      <div style={{ padding: '4px 16px', fontSize: 10, fontWeight: 700, color: 'var(--texto-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Colaboradores
                      </div>
                      {resultados.usuarios.map(u => (
                        <div key={u.id} onClick={() => ir(`/jefatura/usuarios?busqueda=${encodeURIComponent(u.nombre)}`)}
                          style={{ padding: '9px 16px', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, color: 'var(--texto)' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--gris-fondo)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <Icon icon="lucide:user" width={14} style={{ color: 'var(--texto-muted)', flexShrink: 0 }} />
                          {u.nombre}
                          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--texto-muted)' }}>{u.identificador}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
