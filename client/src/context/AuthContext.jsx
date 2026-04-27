import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../services/api'

const AuthContext = createContext(null)

function decodificarJWT(token) {
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(b64))
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [mostrarRenovacion, setMostrarRenovacion] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      api.get('/auth/me')
        .then(res => setUsuario(res.data))
        .catch(() => localStorage.removeItem('token'))
        .finally(() => setCargando(false))
    } else {
      setCargando(false)
    }
  }, [])

  // Revisa cada minuto si el token expira en menos de 30 min
  useEffect(() => {
    if (!usuario) return
    const check = () => {
      const token = localStorage.getItem('token')
      if (!token) return
      const payload = decodificarJWT(token)
      if (!payload?.exp) return
      const remaining = payload.exp * 1000 - Date.now()
      if (remaining > 0 && remaining < 30 * 60 * 1000) setMostrarRenovacion(true)
    }
    check()
    const interval = setInterval(check, 60 * 1000)
    return () => clearInterval(interval)
  }, [usuario])

  const login = async (identificador, password) => {
    const res = await api.post('/auth/login', { identificador, password })
    localStorage.setItem('token', res.data.token)
    setUsuario(res.data.usuario)
    return res.data.usuario
  }

  const logout = () => {
    localStorage.removeItem('token')
    setUsuario(null)
    setMostrarRenovacion(false)
  }

  const simularRol = (rol) => {
    if (usuario) setUsuario({ ...usuario, rol })
  }

  const renovarSesion = useCallback(async () => {
    try {
      const res = await api.post('/auth/renovar')
      localStorage.setItem('token', res.data.token)
      setMostrarRenovacion(false)
    } catch (err) {
      console.error('[renovar]', err.message)
    }
  }, [])

  const ignorarRenovacion = useCallback(() => setMostrarRenovacion(false), [])

  return (
    <AuthContext.Provider value={{
      usuario, cargando, login, logout, simularRol,
      mostrarRenovacion, renovarSesion, ignorarRenovacion,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
