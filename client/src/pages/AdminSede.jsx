import Topbar from '../components/Topbar'
export default function AdminSede() {
  return (
    <div style={{ minHeight: '100vh' }}>
      <Topbar seccion="Administración de sede" />
      <div style={{ padding: 32 }}>
        <h1 className="page-title">Admin de Sede</h1>
        <p className="page-sub">Gestión de usuarios, reportes y configuración del ELEAM</p>
        <div className="card" style={{ color: '#888', textAlign: 'center', padding: 40 }}>
          Módulo en construcción — Sprint 2
        </div>
      </div>
    </div>
  )
}
