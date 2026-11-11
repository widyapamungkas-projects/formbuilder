import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Inside Docker the browser talks only to :5173; Vite forwards API calls to the
// nginx container. This avoids CORS in dev and keeps cookies same-origin (Sanctum SPA).
const target = process.env.API_PROXY_TARGET ?? 'http://localhost:8000'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    // File events from Windows bind mounts are unreliable, so poll.
    watch: { usePolling: true, interval: 300 },
    proxy: {
      '/api': target,
      '/sanctum': target,
      '/up': target,
    },
  },
})
