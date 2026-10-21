import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Prefix '' reads all variables, not only VITE_*, from the environment and frontend/.env*.local files.
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    build: {
      // Built JS/CSS go to /static, so /assets/... stays free for app pages (see README, routing rules).
      assetsDir: 'static',
    },
    server: {
      // In dev /api goes to the local backend, like Caddy does in production.
      // When the backend runs on another port, set API_PROXY_TARGET in frontend/.env.local.
      proxy: {
        '/api': env.API_PROXY_TARGET || 'http://localhost:3000',
      },
    },
  }
})
