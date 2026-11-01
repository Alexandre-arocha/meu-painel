import type { ServerResponse } from 'node:http'
import react from '@vitejs/plugin-react'
import { loadEnv, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'
import { feedResponse, historyResponse, translateResponse } from './server/api.ts'
import { manifest } from './src/pwa-manifest.ts'

async function send(res: ServerResponse, r: Response) {
  res.statusCode = r.status
  r.headers.forEach((value, key) => res.setHeader(key, value))
  res.end(await r.text())
}

// Em desenvolvimento não há funções da Vercel: estas rotas chamam o mesmo código do servidor, sem a senha.
// A chave do DeepL vem de um .env.local, que fica fora do Git.
const devApi = (deeplKey: string | undefined): Plugin => ({
  name: 'dev-api',
  configureServer(server) {
    server.middlewares.use('/api/news/feed', async (req, res) => {
      const id = new URL(req.url ?? '', 'http://localhost').searchParams.get('src') ?? ''
      await send(res, await feedResponse(id, fetch))
    })
    server.middlewares.use('/api/history', async (req, res) => {
      const q = new URL(req.url ?? '', 'http://localhost').searchParams
      await send(res, await historyResponse(q.get('symbol') ?? '', q.get('range') ?? '', fetch))
    })
    server.middlewares.use('/api/translate', async (req, res) => {
      const chunks: Buffer[] = []
      for await (const chunk of req) chunks.push(chunk as Buffer)
      const request = new Request('http://localhost/api/translate', { method: 'POST', body: Buffer.concat(chunks) })
      await send(res, await translateResponse(request, deeplKey, fetch))
    })
  },
})

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    devApi(loadEnv(mode, process.cwd(), '').DEEPL_API_KEY),
    VitePWA({ registerType: 'autoUpdate', manifest, includeAssets: ['icon-192.png', 'icon-512.png'] }),
  ],
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
}))
