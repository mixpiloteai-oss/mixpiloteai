import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  build: {
    // Target modern browsers — smaller output than default ES2015
    target: 'es2020',
    // Warn on chunks > 500 KB
    chunkSizeWarningLimit: 500,
    // Hidden source maps for Sentry error tracking in production
    sourcemap: mode === 'production' ? 'hidden' : true,
    rollupOptions: {
      output: {
        // Manual chunk splitting — keeps vendor libs in separate files
        // for long-term CDN caching independent of app changes
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/framer-motion')) {
            return 'vendor-motion';
          }
          if (id.includes('node_modules/i18next') || id.includes('node_modules/react-i18next')) {
            return 'vendor-i18n';
          }
          if (id.includes('node_modules/axios')) {
            return 'vendor-axios';
          }
          if (id.includes('node_modules/zustand')) {
            return 'vendor-zustand';
          }
          // Remaining node_modules go into a shared vendor chunk
          if (id.includes('node_modules/')) {
            return 'vendor';
          }
        },
        // Hashed filenames for long-term cache busting
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
      },
    },
    // Terser for minification — drop console.log in production
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: mode === 'production',
        drop_debugger: true,
      },
    },
  },
}))
