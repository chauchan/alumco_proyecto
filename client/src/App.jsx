import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'

import Login        from './pages/Login'
import Colaborador  from './pages/Colaborador'
import Profesor     from './pages/Profesor'
import AdminSede    from './pages/AdminSede'
import Jefatura     from './pages/Jefatura'
import GeneradorIA  from './pages/GeneradorIA'

// Ruta protegida: redirige al login si no hay sesión
function ProtectedRoute({ children, roles }) {
  const { usuario, cargando } = useAuth()
  if (cargando) return <div style={{ padding: 40, textAlign: 'center' }}>Cargando...</div>
  if (!usuario) return <Navigate to="/login" replace />
  if (roles && !roles.includes(usuario.rol)) return <Navigate to="/" replace />
  return children
}

// Redirige según el rol del usuario al ingresar
function RolRedirect() {
  const { usuario } = useAuth()
  if (!usuario) return <Navigate to="/login" replace />
  const rutas = {
    colaborador: '/colaborador',
    profesor: '/profesor',
    admin_sede: '/admin',
    jefatura: '/jefatura',
  }
  return <Navigate to={rutas[usuario.rol] || '/login'} replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<RolRedirect />} />

          <Route path="/colaborador" element={
            <ProtectedRoute roles={['colaborador']}>
              <Colaborador />
            </ProtectedRoute>
          } />

          <Route path="/profesor" element={
            <ProtectedRoute roles={['profesor']}>
              <Profesor />
            </ProtectedRoute>
          } />

          <Route path="/admin" element={
            <ProtectedRoute roles={['admin_sede']}>
              <AdminSede />
            </ProtectedRoute>
          } />

          <Route path="/jefatura" element={
            <ProtectedRoute roles={['jefatura']}>
              <Jefatura />
            </ProtectedRoute>
          } />

          <Route path="/jefatura/ia" element={
            <ProtectedRoute roles={['jefatura', 'admin_sede']}>
              <GeneradorIA />
            </ProtectedRoute>
          } />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
