/*
 * Charli3 Hackathon settlement demo. MIT License.
 */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Same-origin proxy to the Oracle Engineer's Python wrapper of
// `request_fresh_price` (CHA-18). The wrapper binds to 127.0.0.1:8001 with no
// CORS headers so we proxy from the dev origin to avoid a preflight. Routes:
//   GET  /api/oracle/price       -> http://127.0.0.1:8001/price
//   POST /api/oracle/odv/submit  -> http://127.0.0.1:8001/odv/submit
// Until the wrapper is up the stub feed at /stub/oracle-feed.json is used.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/oracle': {
        target: 'http://127.0.0.1:8001',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/oracle/, ''),
      },
    },
  },
})
