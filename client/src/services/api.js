import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 840000, // 14 min — cubre generación secuencial de 7 módulos PPT (90s×2 intentos × 7 = ~1300s peor caso, caso típico ~3 min)
})

// Agregar token automáticamente a cada request
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Manejo global de errores
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api
