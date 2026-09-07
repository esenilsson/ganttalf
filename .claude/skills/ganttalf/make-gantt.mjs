#!/usr/bin/env node
// Ganttalf chart generator / reader.
//
//   node make-gantt.mjs rows.json out.xlsx     write a chart (.xlsx + share URL)
//   node make-gantt.mjs --read <source>        read an existing chart back to rows JSON
//
// <source> is a share link ('…/#g=…'), a bare #g= token, or a path to an .xlsx.
// Override the share link's host with GANTTALF_URL.
//
// The URL encoding (compact arrays → JSON → deflate-raw → base64url) and the
// spreadsheet header handling must stay byte-compatible with src/lib/share.js
// and src/lib/excel.js in this repo.
import XLSX from 'xlsx'
import { deflateRawSync, inflateRawSync } from 'node:zlib'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

// Where the generated share link points. Override with the GANTTALF_URL env var
// to target another deployment, e.g. GANTTALF_URL=http://localhost:5173
const BASE_URL = (process.env.GANTTALF_URL || 'https://ganttalf.app').replace(/\/+$/, '')

const FIELDS = ['group', 'activity', 'tentativeStart', 'start', 'end', 'tentativeEnd', 'milestone', 'responsible', 'dependsOn']
const HEADER = ['Group', 'Activity', 'Tentative Start', 'Start', 'End', 'Tentative End', 'Milestone', 'Responsible', 'Depends On']
const DATE_FIELDS = new Set(['tentativeStart', 'start', 'end', 'tentativeEnd', 'milestone'])
const HEADER_ALIASES = { dependson: 'dependsOn', dependency: 'dependsOn', dependencies: 'dependsOn' }
const ISO = /^\d{4}-\d{2}-\d{2}$/

const usage = `Usage:
  node make-gantt.mjs rows.json out.xlsx     write a chart
  node make-gantt.mjs --read <source> [rows.json]   read a share link or .xlsx back to rows

Env:
  GANTTALF_URL   base URL for the share link (default ${BASE_URL})`

const fail = (msg) => {
  console.error(msg)
  process.exit(1)
}

// --- date helpers (mirror src/lib/dates.js) --------------------------------
const DAY_MS = 86400000

const dateToIso = (dt) => {
  if (!(dt instanceof Date) || isNaN(dt)) return null
  if (dt.getUTCHours() === 0 && dt.getUTCMinutes() === 0) {
    const days = Math.floor(dt.getTime() / DAY_MS)
    const d = new Date(days * DAY_MS)
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
  }
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

const parseDateValue = (v) => {
  if (v == null || v === '') return null
  if (v instanceof Date) return dateToIso(v)
  if (typeof v === 'number') return dateToIso(new Date(Math.round((v - 25569) * DAY_MS)))
  const s = String(v).trim()
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  m = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return null
}

const isoToDate = (iso) => {
  if (!iso) return null
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

// --- share link codec ------------------------------------------------------
const encodeRows = (rows) =>
  deflateRawSync(Buffer.from(JSON.stringify(rows.map((r) => FIELDS.map((f) => r[f] || null)))))
    .toString('base64').replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')

const decodeToken = (token) => {
  const b64 = token.replaceAll('-', '+').replaceAll('_', '/')
  let compact
  try {
    compact = JSON.parse(inflateRawSync(Buffer.from(b64, 'base64')).toString('utf8'))
  } catch {
    fail('Could not decode that share token. Copy the whole link, including everything after "#g=".')
  }
  if (!Array.isArray(compact)) fail('Decoded share token is not a row array.')
  return compact.map((arr, i) => {
    const r = {}
    FIELDS.forEach((f, j) => (r[f] = arr[j] ?? null))
    if (typeof r.activity !== 'string' || !r.activity) fail(`Row ${i + 1} in the share link has no activity name.`)
    return r
  })
}

// --- spreadsheet reader (mirrors src/lib/excel.js) -------------------------
const norm = (s) => String(s ?? '').toLowerCase().replace(/[\s_-]/g, '')

const readWorkbook = (path) => {
  const wb = XLSX.read(readFileSync(path), { cellDates: true })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  if (!sheet) fail(`${path} has no readable first sheet.`)
  const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null })
  const headerIdx = grid.findIndex((row) => row?.some((c) => norm(c) === 'activity'))
  if (headerIdx === -1) fail(`No "Activity" column found in the first sheet of ${path}.`)
  const header = grid[headerIdx].map(norm)
  const colOf = {}
  FIELDS.forEach((f, i) => (colOf[f] = header.indexOf(norm(HEADER[i]))))
  if (colOf.dependsOn === -1) colOf.dependsOn = header.findIndex((h) => HEADER_ALIASES[h] === 'dependsOn')

  const rows = []
  for (const raw of grid.slice(headerIdx + 1)) {
    if (!raw) continue
    const activity = colOf.activity >= 0 ? raw[colOf.activity] : null
    if (activity == null || String(activity).trim() === '') continue
    const row = { activity: String(activity).trim() }
    for (const f of ['group', 'responsible', 'dependsOn']) {
      row[f] = colOf[f] >= 0 && raw[colOf[f]] != null ? String(raw[colOf[f]]).trim() || null : null
    }
    for (const f of DATE_FIELDS) row[f] = colOf[f] >= 0 ? parseDateValue(raw[colOf[f]]) : null
    rows.push(FIELDS.reduce((o, f) => ((o[f] = row[f] ?? null), o), {}))
  }
  if (!rows.length) fail(`No activity rows found under the header in ${path}.`)
  return rows
}

// --- read mode -------------------------------------------------------------
const readChart = (source, outFile) => {
  let rows
  if (/#?g=/.test(source)) {
    rows = decodeToken(source.slice(source.search(/#?g=/)).replace(/^#?g=/, '').split(/[&?]/)[0])
  } else if (/\.xlsx?$/i.test(source)) {
    if (!existsSync(source)) fail(`No such file: ${source}`)
    rows = readWorkbook(source)
  } else if (/^https?:\/\//i.test(source)) {
    fail(
      'That looks like a saved-chart link (/c/… or /s/…), which lives in the database and cannot be read offline.\n' +
      'Open it in Ganttalf and use Export → Excel, then pass the .xlsx here. A snapshot link (#g=…) works directly.'
    )
  } else if (existsSync(source)) {
    rows = readWorkbook(source)
  } else {
    rows = decodeToken(source)
  }

  const json = JSON.stringify(rows.map((r) => Object.fromEntries(Object.entries(r).filter(([, v]) => v != null))), null, 2)
  if (outFile) {
    writeFileSync(outFile, json + '\n')
    console.log(`Wrote ${outFile} (${rows.length} rows)`)
  } else {
    console.log(json)
  }
}

// --- write mode ------------------------------------------------------------
const writeChart = (inFile, outFile) => {
  let rows
  try {
    rows = JSON.parse(readFileSync(inFile, 'utf8'))
  } catch (e) {
    fail(`Could not read ${inFile}: ${e.message}`)
  }
  if (!Array.isArray(rows) || !rows.length) fail('rows.json must be a non-empty array')
  for (const r of rows) {
    if (!r.activity) fail(`Row missing activity: ${JSON.stringify(r)}`)
    for (const f of DATE_FIELDS) {
      if (r[f] != null && !ISO.test(r[f])) fail(`Bad date in "${r.activity}" ${f}: ${r[f]} (need yyyy-mm-dd)`)
    }
  }

  const aoa = [HEADER, ...rows.map((r) => FIELDS.map((f) => (DATE_FIELDS.has(f) ? isoToDate(r[f]) : r[f] || null)))]
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

  console.log(`Wrote ${outFile} (${rows.length} rows)`)
  console.log(`Share URL: ${BASE_URL}/#g=${encodeRows(rows)}`)
}

// --- entry -----------------------------------------------------------------
const argv = process.argv.slice(2)
if (!argv.length || argv[0] === '-h' || argv[0] === '--help') {
  console.log(usage)
  process.exit(argv.length ? 0 : 1)
}
if (argv[0] === '--read') {
  if (!argv[1]) fail(usage)
  readChart(argv[1], argv[2])
} else {
  if (argv.length < 2) fail(usage)
  writeChart(argv[0], argv[1])
}
