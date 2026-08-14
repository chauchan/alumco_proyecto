import { useState, useRef, useEffect } from 'react'

// Tooltip inline para explicar un término confuso ("doble fallo", "cobertura", etc.)
// Accesible por teclado (el ? es un <button>, Enter/Espacio lo abren) y cierra con Escape o clic afuera.
export default function Ayuda({ texto }) {
  const [abierto, setAbierto] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!abierto) return
    const onKey = e => { if (e.key === 'Escape') setAbierto(false) }
    const onClick = e => { if (ref.current && !ref.current.contains(e.target)) setAbierto(false) }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [abierto])

  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline-flex', verticalAlign: 'middle', marginLeft: 4 }}>
      <button
        type="button"
        onClick={() => setAbierto(v => !v)}
        aria-label="Ayuda"
        aria-expanded={abierto}
        style={{
          width: 16, height: 16, borderRadius: '50%', border: '1px solid #CCC', background: '#F4F5F7',
          color: '#888', fontSize: 10, fontWeight: 700, cursor: 'pointer', padding: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
        }}
      >?</button>
      {abierto && (
        <div role="tooltip" style={{
          position: 'absolute', top: 22, left: 0, zIndex: 300, width: 220,
          background: '#1a1a1a', color: '#fff', fontSize: 12, lineHeight: 1.5,
          borderRadius: 8, padding: '10px 12px', boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
        }}>
          {texto}
        </div>
      )}
    </span>
  )
}
