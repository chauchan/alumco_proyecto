import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'alumcoproyecto-production-3949.up.railway.app', changeOrigin: true },
      '/uploads': { target: 'alumcoproyecto-production-3949.up.railway.app', changeOrigin: true }
    }
  }
})
