import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'
import { manifest } from './src/pwa-manifest.ts'

export default defineConfig({
  plugins: [react(), VitePWA({ registerType: 'autoUpdate', manifest, includeAssets: ['icon-192.png', 'icon-512.png'] })],
  server: {
    proxy: {
      '/news-proxy': {
        target: 'https://news.google.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/news-proxy/, '/rss'),
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    globals: true,
  },
})
