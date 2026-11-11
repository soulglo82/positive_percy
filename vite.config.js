import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'path'
import tokensPlugin from './scripts/vite-tokens-plugin.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tokensPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    // e2e/ is Playwright (npm run test:ui), not vitest.
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
    // Server test files each drop and rebuild the test database schema, so
    // they must not run at the same time.
    fileParallelism: false,
  },
});
