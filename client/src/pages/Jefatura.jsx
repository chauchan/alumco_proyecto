import { useNavigate } from 'react-router-dom'
import Topbar from '../components/Topbar'
export default function Jefatura() {
  const navigate = useNavigate()
  return (
    <div style={{ minHeight: '100vh' }}>
      <Topbar seccion="Panel de jefatura — vista global" />
      <div style={{ padding: 32 }}>
        <h1 className="page-title">Jefatura</h1>
        <p className="page-sub">Métricas globales de toda la ONG</p>
        <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
          <button className="btn-primary" onClick={() => navigate('/jefatura/ia')}>
            ✨ Generador de cursos con IA
          </button>
        </div>
        <div className="card" style={{ color: '#888', textAlign: 'center', padding: 40 }}>
          Dashboard en construcción — Sprint 3
        </div>
      </div>
    </div>
  )
}
