import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    legacy({
      targets: ['Android >= 4', 'iOS >= 8', 'Chrome >= 49', 'Firefox >= 45', 'Safari >= 10'],
      modernPolyfills: true,
    })
  ],
  build: {
    target: ['es5', 'chrome49', 'firefox45', 'safari10', 'edge18'],
    minify: false, // Disable minification for debugging
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
        ws: true,
      }
    }
  },
  define: {
    global: 'globalThis',
  }
})
