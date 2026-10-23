import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Prefix '' reads all variables, not only VITE_*, from the environment and frontend/.env*.local files.
  const env = loadEnv(mode, process.cwd(), '')

  // Backend services in local development (`npm run dev` in services/<name>).
  // Another port: IDENTITY_URL, CATALOG_URL or COMMUNITY_URL in frontend/.env.local.
  const identity = env.IDENTITY_URL || 'http://localhost:3001'
  const catalog = env.CATALOG_URL || 'http://localhost:3002'
  const community = env.COMMUNITY_URL || 'http://localhost:3003'
  const health = (target: string) => ({ target, rewrite: () => '/health' })

  return {
    plugins: [react()],
    build: {
      // Built JS/CSS go to /static, so /assets/... stays free for app pages (see README, routing rules).
      assetsDir: 'static',
    },
    server: {
      // The same split of /api as deploy/Caddyfile does in production; keep both in sync.
      // The first matching entry wins.
      proxy: {
        '/api/health/identity': health(identity),
        '/api/health/catalog': health(catalog),
        '/api/health/community': health(community),
        '^/api/(auth|users)(/|$)': identity,
        '^/api/assets/[^/]+/(reviews|reports)(/|$)': community,
        '^/api/(reviews|collections|reports)(/|$)': community,
        '^/api/(assets|tags)(/|$)': catalog,
      },
    },
  }
})
