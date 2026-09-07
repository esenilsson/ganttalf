#!/usr/bin/env node
// Usage: [GANTTALF_URL=https://your-instance] node make-gantt.mjs rows.json out.xlsx
// rows.json: [{ group?, activity, tentativeStart?, start?, end?, tentativeEnd?, milestone?, responsible? }]
// Dates as 'yyyy-mm-dd'. Writes the .xlsx and prints a ganttalf share URL.
// The URL encoding (compact arrays → JSON → deflate-raw → base64url) must stay
// byte-compatible with src/lib/share.js in this repo.
import XLSX from 'xlsx'
import { deflateRawSync } from 'node:zlib'
import { readFileSync } from 'node:fs'

// Where the generated share link points. Override with the GANTTALF_URL env var
// to target your own deployment, e.g. GANTTALF_URL=https://gantt.example.com
const BASE_URL = (process.env.GANTTALF_URL || 'http://localhost:5173').replace(/\/+$/, '')
const FIELDS = ['group', 'activity', 'tentativeStart', 'start', 'end', 'tentativeEnd', 'milestone', 'responsible', 'dependsOn']
const HEADER = ['Group', 'Activity', 'Tentative Start', 'Start', 'End', 'Tentative End', 'Milestone', 'Responsible', 'Depends On']
const DATE_FIELDS = new Set(['tentativeStart', 'start', 'end', 'tentativeEnd', 'milestone'])

const [inFile, outFile] = process.argv.slice(2)
if (!inFile || !outFile) {
  console.error('Usage: [GANTTALF_URL=https://your-instance] node make-gantt.mjs rows.json out.xlsx')
  process.exit(1)
}

const rows = JSON.parse(readFileSync(inFile, 'utf8'))
if (!Array.isArray(rows) || !rows.length) throw new Error('rows.json must be a non-empty array')
const ISO = /^\d{4}-\d{2}-\d{2}$/
for (const r of rows) {
  if (!r.activity) throw new Error(`Row missing activity: ${JSON.stringify(r)}`)
  for (const f of DATE_FIELDS) {
    if (r[f] != null && !ISO.test(r[f])) throw new Error(`Bad date in "${r.activity}" ${f}: ${r[f]} (need yyyy-mm-dd)`)
  }
}

// --- xlsx ------------------------------------------------------------------
const toDate = (iso) => {
  if (!iso) return null
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}
const aoa = [HEADER, ...rows.map((r) => FIELDS.map((f) => (DATE_FIELDS.has(f) ? toDate(r[f]) : r[f] || null)))]
const ws = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true })
const range = XLSX.utils.decode_range(ws['!ref'])
for (let R = 1; R <= range.e.r; R++) {
  for (let C = 0; C <= range.e.c; C++) {
    const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })]
    if (cell && cell.t === 'd') cell.z = 'dd/mm/yyyy'
  }
}
ws['!cols'] = [{ wch: 14 }, { wch: 55 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 30 }]
const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, ws, 'Gantt')
XLSX.writeFile(wb, outFile)

// --- share URL -------------------------------------------------------------
const compact = rows.map((r) => FIELDS.map((f) => r[f] || null))
const b64url = deflateRawSync(Buffer.from(JSON.stringify(compact)))
  .toString('base64').replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')

console.log(`Wrote ${outFile} (${rows.length} rows)`)
console.log(`Share URL: ${BASE_URL}/#g=${b64url}`)
