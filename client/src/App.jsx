import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'

import Login                from './pages/Login'
import Colaborador          from './pages/Colaborador'
import Profesor             from './pages/Profesor'
import AdminSede            from './pages/AdminSede'
import Jefatura             from './pages/Jefatura'
import GeneradorIA          from './pages/GeneradorIA'
import Protocolos           from './pages/Protocolos'
import GestionUsuarios      from './pages/GestionUsuarios'
import NuevoCurso           from './pages/NuevoCurso'
import CambiarPassword      from './pages/CambiarPassword'
import Capacitaciones       from './pages/Capacitaciones'
import AsignarCurso         from './pages/AsignarCurso'
import Practicos            from './pages/Practicos'
import MisCertificados      from './pages/MisCertificados'
import CertificadosGlobales from './pages/CertificadosGlobales'
import MisDatos            from './pages/MisDatos'

function ProtectedRoute({ children, roles }) {
  const { usuario, cargando } = useAuth()
  if (cargando) return <div style={{ padding:40, textAlign:'center' }}>Cargando...</div>
  if (!usuario) return <Navigate to="/login" replace />
  if (roles && !roles.includes(usuario.rol)) return <Navigate to="/" replace />
  return children
}

function RolRedirect() {
  const { usuario } = useAuth()
  if (!usuario) return <Navigate to="/login" replace />
  const rutas = { colaborador:'/colaborador', profesor:'/profesor', admin_sede:'/admin', jefatura:'/jefatura' }
  return <Navigate to={rutas[usuario.rol] || '/login'} replace />
}

const TODOS  = ['colaborador','profesor','admin_sede','jefatura']
const ADMIN  = ['admin_sede','jefatura','profesor']

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<RolRedirect />} />

          <Route path="/colaborador"   element={<ProtectedRoute roles={['colaborador']}><Colaborador /></ProtectedRoute>} />
          <Route path="/profesor"      element={<ProtectedRoute roles={['profesor']}><Profesor /></ProtectedRoute>} />
          <Route path="/profesor/nuevo-curso" element={<ProtectedRoute roles={['profesor']}><NuevoCurso /></ProtectedRoute>} />
          <Route path="/profesor/asignar/:id" element={<ProtectedRoute roles={['profesor']}><AsignarCurso /></ProtectedRoute>} />
          <Route path="/admin"         element={<ProtectedRoute roles={['admin_sede']}><AdminSede /></ProtectedRoute>} />
          <Route path="/jefatura"      element={<ProtectedRoute roles={['jefatura']}><Jefatura /></ProtectedRoute>} />
          <Route path="/jefatura/usuarios" element={<ProtectedRoute roles={['jefatura']}><GestionUsuarios /></ProtectedRoute>} />
          <Route path="/jefatura/ia"          element={<ProtectedRoute roles={['jefatura','admin_sede']}><GeneradorIA /></ProtectedRoute>} />
          <Route path="/jefatura/protocolos"  element={<ProtectedRoute roles={['jefatura','admin_sede']}><Protocolos /></ProtectedRoute>} />

          <Route path="/capacitaciones"        element={<ProtectedRoute roles={TODOS}><Capacitaciones /></ProtectedRoute>} />
          <Route path="/practicos"             element={<ProtectedRoute roles={TODOS}><Practicos /></ProtectedRoute>} />
          <Route path="/mis-certificados"      element={<ProtectedRoute roles={TODOS}><MisCertificados /></ProtectedRoute>} />
          <Route path="/certificados-globales" element={<ProtectedRoute roles={ADMIN}><CertificadosGlobales /></ProtectedRoute>} />
          <Route path="/cambiar-password"      element={<ProtectedRoute roles={TODOS}><CambiarPassword /></ProtectedRoute>} />
          <Route path="/mis-datos"              element={<ProtectedRoute roles={TODOS}><MisDatos /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
