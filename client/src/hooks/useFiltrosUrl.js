import { useSearchParams } from 'react-router-dom'

// Sincroniza filtros/búsqueda/página con la URL en vez de useState local,
// para que sobrevivan a un recargo y el enlace filtrado se pueda compartir.
// Uso: const [filtros, setFiltro] = useFiltrosUrl({ busqueda: '', pagina: '1' })
export function useFiltrosUrl(defaults) {
  const [searchParams, setSearchParams] = useSearchParams()

  const valores = {}
  for (const key in defaults) {
    valores[key] = searchParams.get(key) ?? defaults[key]
  }

  const aplicar = (next, key, value) => {
    if (value === '' || value === null || value === undefined || String(value) === String(defaults[key])) {
      next.delete(key)
    } else {
      next.set(key, value)
    }
  }

  const setValor = (key, value) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      aplicar(next, key, value)
      return next
    }, { replace: true })
  }

  // Actualiza varios filtros de una sola vez (ej. "Limpiar filtros")
  setValor.multiple = (patch) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      for (const key in patch) aplicar(next, key, patch[key])
      return next
    }, { replace: true })
  }

  return [valores, setValor]
}
