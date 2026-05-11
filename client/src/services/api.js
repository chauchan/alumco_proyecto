import axios from 'axios'

const base = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api'

const api = axios.create({
  baseURL: base,
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

export async function descargarCertificado(certId, nombreArchivo) {
  try {
    const res = await api.get(`/certificados/${certId}/descargar`, { responseType: 'blob' })
    const ct = res.headers?.['content-type'] || ''
    // Si el servidor devolvió JSON/HTML en vez de PDF, leerlo como texto y mostrar el error
    if (!ct.includes('pdf')) {
      const text = await res.data.text()
      throw new Error(text || 'Respuesta inesperada del servidor')
    }
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url
    a.download = nombreArchivo || `certificado_${certId}.pdf`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch (err) {
    let msg = 'No se pudo descargar el certificado.'
    if (err.response?.data) {
      try {
        const text = err.response.data instanceof Blob
          ? await err.response.data.text()
          : JSON.stringify(err.response.data)
        const parsed = (() => { try { return JSON.parse(text) } catch { return null } })()
        msg = parsed?.error || text || msg
      } catch {}
    } else if (err.message) {
      msg = err.message
    }
    console.error('[descargarCertificado]', err)
    alert(`Error al descargar certificado: ${msg}`)
  }
}

export default api
