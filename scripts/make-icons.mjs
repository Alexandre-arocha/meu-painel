// Gera public/icon-192.png e public/icon-512.png (fundo azul com três barras brancas).
// Uso: node scripts/make-icons.mjs
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'

const T = new Int32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c
})
const crc = (b) => {
  let c = -1
  for (const x of b) c = T[(c ^ x) & 255] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type), data])
  const sum = Buffer.alloc(4)
  sum.writeUInt32BE(crc(body))
  return Buffer.concat([len, body, sum])
}

function png(size) {
  const stride = size * 4 + 1
  const raw = Buffer.alloc(stride * size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size
      const v = y / size
      const bar =
        (u > 0.25 && u < 0.38 && v > 0.55 && v < 0.75) ||
        (u > 0.44 && u < 0.57 && v > 0.4 && v < 0.75) ||
        (u > 0.63 && u < 0.76 && v > 0.28 && v < 0.75)
      const o = y * stride + 1 + x * 4
      const [r, g, b] = bar ? [255, 255, 255] : [29, 78, 216]
      raw[o] = r
      raw[o + 1] = g
      raw[o + 2] = b
      raw[o + 3] = 255
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // 8 bits por canal
  ihdr[9] = 6 // RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

mkdirSync('public', { recursive: true })
writeFileSync('public/icon-192.png', png(192))
writeFileSync('public/icon-512.png', png(512))
