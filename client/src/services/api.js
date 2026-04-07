import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 180000, // 3 min — Ollama puede tardar en generar
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
