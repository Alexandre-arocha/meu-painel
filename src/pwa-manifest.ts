export const manifest = {
  name: 'Meu painel',
  short_name: 'Painel',
  description: 'Investimentos e notícias do mercado num lugar só.',
  lang: 'pt-BR',
  start_url: '/',
  display: 'standalone' as const,
  background_color: '#0f1217',
  theme_color: '#1d4ed8',
  icons: [
    { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
    { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
  ],
}
