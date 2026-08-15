import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const REMOTO = 'http://44.217.200.211'   // EC2 de AWS
const LOCAL  = 'http://localhost:3001'   // servidor que levanta `npm run dev`

/**
 * ¿Contesta algo en esa dirección?
 *
 * Sirve cualquier respuesta HTTP, incluido un 404 o un 401: lo único que se
 * está comprobando es que haya un servidor vivo al otro lado. Solo un error de
 * red o el timeout cuentan como "no está".
 */
async function responde(url, ms = 1500) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    await fetch(`${url}/api/`, { signal: ctrl.signal })
    return true
  } catch {
    return false
  } finally {
    clearTimeout(t)
  }
}

/**
 * Elige a qué backend apunta el cliente en desarrollo.
 *
 * Prioridad: VITE_BACKEND si está definido → la EC2 si responde → el servidor
 * local. El sondeo se hace en cada arranque, así que cuando la instancia vuelva
 * a estar encendida se reconecta sola sin tocar este archivo.
 *
 *   VITE_BACKEND=http://localhost:3001 npm run dev   # forzar local
 *   VITE_BACKEND=http://44.217.200.211 npm run dev   # forzar EC2
 */
async function elegirBackend() {
  if (process.env.VITE_BACKEND) return process.env.VITE_BACKEND
  return (await responde(REMOTO)) ? REMOTO : LOCAL
}

export default defineConfig(async () => {
  const BACKEND = await elegirBackend()

  // Este log no es decorativo. Que el cliente apuntara a la EC2 mientras el
  // servidor local corría sin que nadie le hablara costó una tarde entera de
  // depuración: los arreglos de backend no aparecían y parecía que el código
  // estaba mal. Decir en cada arranque contra qué se está probando evita
  // exactamente eso.
  const origen = process.env.VITE_BACKEND ? 'forzado por VITE_BACKEND'
    : BACKEND === REMOTO ? 'EC2 responde'
    : 'EC2 no responde, usando servidor local'
  console.log(`\n  ▸ backend: ${BACKEND}  (${origen})\n`)

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api':     { target: BACKEND, changeOrigin: true },
        '/uploads': { target: BACKEND, changeOrigin: true }
      }
    }
  }
})
