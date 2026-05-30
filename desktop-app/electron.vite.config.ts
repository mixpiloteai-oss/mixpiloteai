import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

const isProd = process.env.NODE_ENV === 'production'

export default defineConfig({
  // ── Main process ────────────────────────────────────────────────────────────
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      minify: isProd,
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/main/index.ts') },
      },
    },
    // Drop console/debugger in main process production build
    esbuild: isProd ? { drop: ['debugger'] } : {},
  },

  // ── Preload ─────────────────────────────────────────────────────────────────
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      minify: isProd,
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/preload/index.ts') },
      },
    },
  },

  // ── Renderer (React app) ────────────────────────────────────────────────────
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve(__dirname, 'src/renderer/src'),
        '@':         resolve(__dirname, 'src/renderer/src'),
      },
    },
    plugins: [react()],

    // Drop console/debugger from renderer in production
    esbuild: isProd ? { drop: ['console', 'debugger'] } : {},

    build: {
      target:     'chrome120',   // Electron 31 ships Chromium ~120
      minify:     isProd ? 'esbuild' : false,
      sourcemap:  !isProd,
      cssCodeSplit: true,

      rollupOptions: {
        output: {
          // Content-hash filenames for cache invalidation
          entryFileNames: 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]',

          manualChunks: {
            'vendor-react':   ['react', 'react-dom'],
            'vendor-zustand': ['zustand'],
          },
        },
      },
    },
  },
})
