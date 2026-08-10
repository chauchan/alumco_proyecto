import { useState, useRef, useEffect, useId } from 'react'
import { Icon } from '@iconify/react'

/**
 * Ícono "?" con explicación emergente, para términos y métricas que no se
 * entienden solos ("doble fallo", "cobertura"). §4 del plan de mejoras UX.
 *
 * Se abre con hover y con foco de teclado, porque un tooltip que solo responde
 * al mouse deja fuera a quien navega tabulando. Es un <button> y no un <span>
 * con title: el atributo title nativo no es accesible por teclado ni se puede
 * leer con calma en un lector de pantalla.
 *
 * El estado se separa en dos: `hover` (pasajero) y `fijado` (por clic). Si el
 * clic simplemente alternara un único booleano, con mouse el resultado sería
 * que el hover abre la burbuja y el clic inmediatamente la cierra, que es lo
 * que parecía un botón roto. Además en pantallas táctiles no hay hover, así
 * que el clic tiene que poder abrir por sí solo.
 */
export default function Ayuda({ texto, etiqueta = 'Más información' }) {
  const [hover, setHover] = useState(false)
  const [fijado, setFijado] = useState(false)
  const abierto = hover || fijado
  const id = useId()
  const ref = useRef(null)

  // El listener se engancha mientras la burbuja esté visible, sin importar si
  // se abrió por clic, por hover o por foco: WCAG 1.4.13 pide que Escape la
  // descarte en los tres casos y sin mover el foco de sitio.
  useEffect(() => {
    if (!abierto) return
    const onKey = (e) => { if (e.key === 'Escape') { setFijado(false); setHover(false) } }
    const onClickFuera = (e) => {
      if (ref.current && !ref.current.contains(e.target)) { setFijado(false); setHover(false) }
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClickFuera)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClickFuera)
    }
  }, [abierto])

  return (
    <span
      className="tooltip-wrap"
      ref={ref}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button
        type="button"
        className="tooltip-trigger"
        aria-label={etiqueta}
        aria-expanded={abierto}
        aria-describedby={abierto ? id : undefined}
        onFocus={() => setHover(true)}
        onBlur={() => { setHover(false); setFijado(false) }}
        onClick={(e) => { e.stopPropagation(); setFijado(f => !f) }}
      >
        <Icon icon="lucide:help-circle" width={14} />
      </button>
      {abierto && (
        <span role="tooltip" id={id} className="tooltip-burbuja">
          {texto}
        </span>
      )}
    </span>
  )
}
