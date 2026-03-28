import Topbar from '../components/Topbar'
export default function Profesor() {
  return (
    <div style={{ minHeight: '100vh' }}>
      <Topbar seccion="Panel del profesor" />
      <div style={{ padding: 32 }}>
        <h1 className="page-title">Panel del Profesor</h1>
        <p className="page-sub">Gestión de cursos y validación de certificados</p>
        {/* TODO: implementar vistas de cursos, subida de contenido y validación */}
        <div className="card" style={{ color: '#888', textAlign: 'center', padding: 40 }}>
          Módulo en construcción — Sprint 2
        </div>
      </div>
    </div>
  )
}
