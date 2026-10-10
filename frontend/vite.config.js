import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Forward /api calls to the Express backend, so the browser only talks to the Vite server
const apiProxy = {
  '/api': {
    target: 'http://localhost:5000',
    changeOrigin: true,
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(),],
  server: { proxy: apiProxy },
  preview: { proxy: apiProxy },
  // `npm test`: component tests in a simulated browser (src/**/*.test.jsx)
  // (rendering a 50-ticket page can take a few seconds on a cold start, hence the time limit)
  test: { environment: 'jsdom', testTimeout: 20000 },
})
