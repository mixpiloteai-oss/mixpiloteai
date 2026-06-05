// Minimal Vite config used only in CI to serve the renderer as a plain web
// app (no Electron) so Playwright can run UI smoke tests against it.
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  plugins: [react()],
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'src/renderer/src'),
      '@':         resolve(__dirname, 'src/renderer/src'),
    },
  },
  define: {
    // Suppress Electron-specific global that doesn't exist in browser context
    'import.meta.env.ELECTRON': JSON.stringify(false),
  },
  server: {
    port: 5174,
    strictPort: true,
    host: '127.0.0.1',
  },
})
