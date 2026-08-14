import { Link } from 'react-router-dom'
import { Icon } from '@iconify/react'

// items: [{ label, path? }] — el último no lleva path (es la página actual)
export default function Breadcrumb({ items }) {
  return (
    <nav aria-label="Breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#888', marginBottom: 6, flexWrap: 'wrap' }}>
      {items.map((item, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {i > 0 && <Icon icon="lucide:chevron-right" width={12} style={{ color: '#CCC' }} />}
          {item.path ? (
            <Link to={item.path} style={{ color: '#888', textDecoration: 'none' }}>{item.label}</Link>
          ) : (
            <span style={{ color: '#555', fontWeight: 500 }}>{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}
