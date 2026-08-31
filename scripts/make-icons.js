// Generates the PNG favicon set in public/ from the two SVG masters in the
// brand handoff. The mark is flat rectangles only, so the PNGs are drawn
// directly into a pixel buffer — no rasterizer dependency needed.
//
//   node scripts/make-icons.js
//
// Outputs: favicon-16.png, favicon-32.png (from the 16×16 pixel master),
// apple-touch-icon.png 180×180 and icon-512.png 512×512 (vector master,
// mark inset 12% on a #F0EFEB field).
import { deflateSync, crc32 } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const FIELD = 0xf0efeb // Cloud Dancer
const RAMP = [0xdda893, 0xc9705c, 0xb23a26, 0x7a2618]

// 16×16 pixel master (favicon-16.svg): [x, y, w, h] per ramp step
const PIXEL_BARS = [
  [7, 2, 2, 2],
  [5, 5, 6, 2],
  [3, 8, 10, 2],
  [1, 11, 14, 2],
]

// Vector master (favicon.svg), viewBox 0 0 100 100
const VECTOR_BARS = [
  [42, 16, 16, 13],
  [28, 36, 44, 13],
  [14, 56, 72, 13],
  [0, 76, 100, 13],
]

function makeCanvas(size) {
  const px = new Uint8Array(size * size * 3)
  const fill = (x0, y0, x1, y1, rgb) => {
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = (y * size + x) * 3
        px[i] = (rgb >> 16) & 0xff
        px[i + 1] = (rgb >> 8) & 0xff
        px[i + 2] = rgb & 0xff
      }
    }
  }
  return { px, fill }
}

function encodePng(px, size) {
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
    const head = Buffer.alloc(4)
    head.writeUInt32BE(data.length)
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(body) >>> 0)
    return Buffer.concat([head, body, crc])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // color type: truecolor
  // scanlines, each prefixed with filter byte 0
  const raw = Buffer.alloc(size * (size * 3 + 1))
  for (let y = 0; y < size; y++) {
    Buffer.from(px.buffer, y * size * 3, size * 3).copy(raw, y * (size * 3 + 1) + 1)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// 16 and 32 px: the pixel master scaled by an integer factor — stays crisp
function pixelIcon(scale) {
  const size = 16 * scale
  const { px, fill } = makeCanvas(size)
  fill(0, 0, size, size, FIELD)
  PIXEL_BARS.forEach(([x, y, w, h], i) =>
    fill(x * scale, y * scale, (x + w) * scale, (y + h) * scale, RAMP[i]),
  )
  return encodePng(px, size)
}

// 48 px and above: the vector master, inset 12% on a Cloud Dancer field
function vectorIcon(size, inset = 0.12) {
  const { px, fill } = makeCanvas(size)
  fill(0, 0, size, size, FIELD)
  const off = size * inset
  const s = (size - off * 2) / 100
  VECTOR_BARS.forEach(([x, y, w, h], i) =>
    fill(
      Math.round(off + x * s),
      Math.round(off + y * s),
      Math.round(off + (x + w) * s),
      Math.round(off + (y + h) * s),
      RAMP[i],
    ),
  )
  return encodePng(px, size)
}

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')
writeFileSync(join(out, 'favicon-16.png'), pixelIcon(1))
writeFileSync(join(out, 'favicon-32.png'), pixelIcon(2))
writeFileSync(join(out, 'apple-touch-icon.png'), vectorIcon(180))
writeFileSync(join(out, 'icon-512.png'), vectorIcon(512))
console.log('Wrote favicon-16.png, favicon-32.png, apple-touch-icon.png, icon-512.png to public/')
