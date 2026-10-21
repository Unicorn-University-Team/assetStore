import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // In dev /api goes to the local backend, like Caddy does in production.
    // Override the target with API_PROXY_TARGET, e.g. when the backend runs on another port.
    proxy: {
      '/api': process.env.API_PROXY_TARGET ?? 'http://localhost:3000',
    },
  },
})
