import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { manifest } from './pwa-manifest'

test('manifesto tem nome, display standalone e dois ícones', () => {
  expect(manifest.name).toBe('Meu painel')
  expect(manifest.display).toBe('standalone')
  expect(manifest.icons.map((i) => i.sizes).sort()).toEqual(['192x192', '512x512'])
})

test('os arquivos dos ícones existem em public', () => {
  for (const icon of manifest.icons) {
    expect(existsSync(join(process.cwd(), 'public', icon.src))).toBe(true)
  }
})
