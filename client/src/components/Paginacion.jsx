export default function Paginacion({ total, limit, pagina, onChange }) {
  const totalPaginas = Math.ceil(total / limit)
  if (totalPaginas <= 1) return null

  const delta = 2
  const pages = []
  const left  = Math.max(1, pagina - delta)
  const right = Math.min(totalPaginas, pagina + delta)

  if (left > 1) { pages.push(1); if (left > 2) pages.push('...') }
  for (let i = left; i <= right; i++) pages.push(i)
  if (right < totalPaginas) { if (right < totalPaginas - 1) pages.push('...'); pages.push(totalPaginas) }

  const btnBase = {
    height: 32, minWidth: 32, border: '0.5px solid var(--gris-borde)', borderRadius: 7,
    fontSize: 13, cursor: 'pointer', display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center', padding: '0 8px',
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4, padding: '14px 0' }}>
      <button
        onClick={() => onChange(pagina - 1)}
        disabled={pagina <= 1}
        style={{ ...btnBase, background: pagina <= 1 ? 'var(--gris-fondo)' : '#fff', color: pagina <= 1 ? '#CCC' : 'var(--texto-sec)' }}
      >
        ‹
      </button>

      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`e${i}`} style={{ padding: '0 4px', color: 'var(--texto-muted)', fontSize: 13 }}>…</span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p)}
            style={{
              ...btnBase,
              background: pagina === p ? 'var(--azul)' : '#fff',
              color: pagina === p ? '#fff' : '#333',
              border: pagina === p ? 'none' : '0.5px solid var(--gris-borde)',
              fontWeight: pagina === p ? 600 : 400,
            }}
          >
            {p}
          </button>
        )
      )}

      <button
        onClick={() => onChange(pagina + 1)}
        disabled={pagina >= totalPaginas}
        style={{ ...btnBase, background: pagina >= totalPaginas ? 'var(--gris-fondo)' : '#fff', color: pagina >= totalPaginas ? '#CCC' : 'var(--texto-sec)' }}
      >
        ›
      </button>

      <span style={{ fontSize: 12, color: 'var(--texto-muted)', marginLeft: 8 }}>
        {total} en total
      </span>
    </div>
  )
}
