export type Feed = { url: string; source: string; tag: 'Mercado' | 'Mundo' | 'Política' | 'Tecnologia'; lang: string }

// Feeds com foto conferidos ao vivo. O servidor só busca estes ids, para não virar proxy aberto.
export const FEEDS = {
  'g1-economia': { url: 'https://g1.globo.com/rss/g1/economia/', source: 'g1', tag: 'Mercado', lang: 'pt' },
  infomoney: { url: 'https://www.infomoney.com.br/feed/', source: 'InfoMoney', tag: 'Mercado', lang: 'pt' },
  'g1-politica': { url: 'https://g1.globo.com/rss/g1/politica/', source: 'g1', tag: 'Política', lang: 'pt' },
  'g1-tecnologia': { url: 'https://g1.globo.com/rss/g1/tecnologia/', source: 'g1', tag: 'Tecnologia', lang: 'pt' },
  tecmundo: { url: 'https://rss.tecmundo.com.br/feed', source: 'TecMundo', tag: 'Tecnologia', lang: 'pt' },
  'bbc-world': { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', source: 'BBC', tag: 'Mundo', lang: 'en' },
  'bbc-business': { url: 'https://feeds.bbci.co.uk/news/business/rss.xml', source: 'BBC', tag: 'Mercado', lang: 'en' },
  'guardian-world': { url: 'https://www.theguardian.com/world/rss', source: 'The Guardian', tag: 'Mundo', lang: 'en' },
  'guardian-business': { url: 'https://www.theguardian.com/uk/business/rss', source: 'The Guardian', tag: 'Mercado', lang: 'en' },
  'nyt-world': { url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', source: 'The New York Times', tag: 'Mundo', lang: 'en' },
  'nyt-business': { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml', source: 'The New York Times', tag: 'Mercado', lang: 'en' },
  lemonde: { url: 'https://www.lemonde.fr/international/rss_full.xml', source: 'Le Monde', tag: 'Mundo', lang: 'fr' },
  elpais: {
    url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/internacional/portada',
    source: 'El País',
    tag: 'Mundo',
    lang: 'es',
  },
  spiegel: { url: 'https://www.spiegel.de/schlagzeilen/index.rss', source: 'Der Spiegel', tag: 'Mundo', lang: 'de' },
  theverge: { url: 'https://www.theverge.com/rss/index.xml', source: 'The Verge', tag: 'Tecnologia', lang: 'en' },
} satisfies Record<string, Feed>

export type FeedId = keyof typeof FEEDS
export const FEED_IDS = Object.keys(FEEDS) as FeedId[]
export const isFeedId = (id: string): id is FeedId => Object.hasOwn(FEEDS, id)
