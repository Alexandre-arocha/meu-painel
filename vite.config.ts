import type { ServerResponse } from 'node:http'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'
import { feedResponse } from './server/api.ts'
import { manifest } from './src/pwa-manifest.ts'

async function send(res: ServerResponse, r: Response) {
  res.statusCode = r.status
  r.headers.forEach((value, key) => res.setHeader(key, value))
  res.end(await r.text())
}

// Em desenvolvimento não há funções da Vercel: estas rotas chamam o mesmo código do servidor, sem a senha.
const devApi = (): Plugin => ({
  name: 'dev-api',
  configureServer(server) {
    server.middlewares.use('/api/news/feed', async (req, res) => {
      const id = new URL(req.url ?? '', 'http://localhost').searchParams.get('src') ?? ''
      await send(res, await feedResponse(id, fetch))
    })
  },
})

export default defineConfig({
  plugins: [react(), devApi(), VitePWA({ registerType: 'autoUpdate', manifest, includeAssets: ['icon-192.png', 'icon-512.png'] })],
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
