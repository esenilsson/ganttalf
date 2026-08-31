import { newId } from './excel.js'

// Share-link codec: rows ⇄ '#g=' URL fragment.
// Format: compact array-of-arrays → JSON → deflate-raw → base64url.
// Must stay in sync with the encoder in the Claude skill (make-gantt.mjs).
const FIELDS = ['group', 'activity', 'tentativeStart', 'start', 'end', 'tentativeEnd', 'milestone', 'responsible', 'dependsOn']
const TEXT_FIELDS = new Set(['group', 'activity', 'responsible', 'dependsOn'])

function toB64url(bytes) {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(bin).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

function fromB64url(str) {
  const bin = atob(str.replaceAll('-', '+').replaceAll('_', '/'))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

export async function encodeRows(rows) {
  const compact = rows.map((r) => FIELDS.map((f) => r[f] || null))
  const bytes = new TextEncoder().encode(JSON.stringify(compact))
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'))
  return toB64url(new Uint8Array(await new Response(stream).arrayBuffer()))
}

export async function decodeRows(str) {
  const stream = new Blob([fromB64url(str)]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  const compact = JSON.parse(await new Response(stream).text())
  return compact.map((arr) => {
    const r = { id: newId() }
    FIELDS.forEach((f, i) => (r[f] = arr[i] ?? (TEXT_FIELDS.has(f) ? '' : null)))
    if (typeof r.activity !== 'string' || !r.activity) throw new Error('bad row')
    return r
  })
}
