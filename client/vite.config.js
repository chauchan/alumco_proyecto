import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Se puede sobreescribir sin tocar el archivo:  VITE_BACKEND=http://localhost:3001 npm run dev
const BACKEND = process.env.VITE_BACKEND || 'http://44.217.200.211'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Backend al que apunta el cliente en desarrollo. Railway quedó atrás; hoy
    // es la EC2 de AWS. Para trabajar contra un servidor local, cambiar por
    // 'http://localhost:3001'.
    proxy: {
      '/api': { target: BACKEND, changeOrigin: true },
      '/uploads': { target: BACKEND, changeOrigin: true }
    }
  }
})
