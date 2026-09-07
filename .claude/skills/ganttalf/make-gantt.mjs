#!/usr/bin/env node
// Ganttalf chart generator / reader.
//
//   node make-gantt.mjs rows.json out.xlsx     write a chart (.xlsx + share URL)
//   node make-gantt.mjs --read <source>        read an existing chart back to rows JSON
//
// <source> is a snapshot link ('…/#g=…'), a live share link ('…/s/<token>'), a
// bare #g= token, or a path to an .xlsx.
// Override the share link's host with GANTTALF_URL.
//
// The URL encoding (compact arrays → JSON → deflate-raw → base64url) and the
// spreadsheet header handling must stay byte-compatible with src/lib/share.js
// and src/lib/excel.js in this repo.
import { deflateRawSync, inflateRawSync } from 'node:zlib'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

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
  node make-gantt.mjs --read <source> [rows.json]   read a link or .xlsx back to rows

Sources for --read: a /s/<token> share link, a #g=… snapshot link, or an .xlsx.

Env:
  GANTTALF_URL                  base URL for generated links (default ${BASE_URL})
  GANTTALF_SUPABASE_URL         override the project discovered from the app
  GANTTALF_SUPABASE_ANON_KEY    override the public key discovered from the app`

const fail = (msg) => {
  console.error(msg)
  process.exit(1)
}

// xlsx is only needed to read or write the spreadsheet. Share links use node's
// built-in zlib, so the skill still works with no dependencies installed.
let XLSX = null
const loadXlsx = async () => {
  if (XLSX) return XLSX
  try {
    XLSX = (await import('xlsx')).default
  } catch {
    return null
  }
  return XLSX
}

const NEED_XLSX = `The 'xlsx' package is not installed. Run this once, in the skill's own directory:\n  npm install --prefix "${import.meta.dirname}"`

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

const readWorkbook = async (path) => {
  const XLSX = await loadXlsx()
  if (!XLSX) fail(NEED_XLSX)
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

// --- live share links ('/s/<token>') ---------------------------------------
// Reading one needs the app's Supabase project URL and anon key. Both are public
// by design — they ship in the browser bundle, and row-level security is the real
// boundary — so they are discovered from the deployment rather than committed
// here, which also survives a key rotation. Override via env when self-hosting.
//
// get_shared_chart is the only anonymous read path: a security-definer function
// granted to 'anon', matching an exact random token. It cannot list or reach
// anything the owner has not chosen to share.
const CONFIG_TTL_MS = 24 * 60 * 60 * 1000

const discoverConfig = async (baseUrl) => {
  const env = { url: process.env.GANTTALF_SUPABASE_URL, key: process.env.GANTTALF_SUPABASE_ANON_KEY }
  if (env.url && env.key) return env

  const cacheFile = join(tmpdir(), `ganttalf-config-${Buffer.from(baseUrl).toString('hex').slice(0, 24)}.json`)
  try {
    const cached = JSON.parse(readFileSync(cacheFile, 'utf8'))
    if (Date.now() - cached.at < CONFIG_TTL_MS && cached.url && cached.key) return cached
  } catch {
    // no usable cache; fall through and discover
  }

  const page = await fetch(baseUrl).then((r) => r.text())
  const asset = page.match(/\/assets\/index-[A-Za-z0-9_-]+\.js/)
  if (!asset) fail(`Could not find the app bundle at ${baseUrl}. Set GANTTALF_SUPABASE_URL and GANTTALF_SUPABASE_ANON_KEY to read share links.`)
  const bundle = await fetch(`${baseUrl}${asset[0]}`).then((r) => r.text())
  const url = bundle.match(/https:\/\/[a-z0-9]+\.supabase\.co/)
  const key = bundle.match(/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+/)
  if (!url || !key) fail(`Could not read the Supabase settings from ${baseUrl}. Set GANTTALF_SUPABASE_URL and GANTTALF_SUPABASE_ANON_KEY instead.`)

  const found = { url: url[0], key: key[0], at: Date.now() }
  try {
    writeFileSync(cacheFile, JSON.stringify(found))
  } catch {
    // cache is an optimisation; ignore a read-only tmpdir
  }
  return found
}

const readSharedChart = async (baseUrl, token) => {
  const { url, key } = await discoverConfig(baseUrl)
  let res
  try {
    res = await fetch(`${url}/rest/v1/rpc/get_shared_chart`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_token: token }),
    })
  } catch (e) {
    fail(`Could not reach ${url}: ${e.message}`)
  }
  if (!res.ok) fail(`Share lookup failed (HTTP ${res.status}). ${await res.text()}`)
  const rows = await res.json()
  if (!Array.isArray(rows) || !rows.length) {
    fail('That share link is not valid any more — sharing may have been turned off by the owner.')
  }
  const chart = rows[0]
  const data = chart?.data?.rows
  if (!Array.isArray(data)) fail('The shared chart has no rows.')
  console.error(`Read "${chart.name}" (${data.length} rows, saved ${String(chart.updated_at).slice(0, 10)})`)
  return data.map((r) => FIELDS.reduce((o, f) => ((o[f] = r[f] ?? null), o), {}))
}

// --- read mode -------------------------------------------------------------
const readChart = async (source, outFile) => {
  let rows
  if (/#?g=/.test(source)) {
    rows = decodeToken(source.slice(source.search(/#?g=/)).replace(/^#?g=/, '').split(/[&?]/)[0])
  } else if (/\.xlsx?$/i.test(source)) {
    if (!existsSync(source)) fail(`No such file: ${source}`)
    rows = await readWorkbook(source)
  } else if (/^https?:\/\//i.test(source)) {
    const u = new URL(source)
    const shared = u.pathname.match(/^\/s\/([A-Za-z0-9_-]{16,})$/)
    if (shared) {
      rows = await readSharedChart(`${u.protocol}//${u.host}`, shared[1])
    } else if (/^\/c\//.test(u.pathname)) {
      fail(
        'That is a saved-chart link (/c/…). It lives in the database behind the owner\'s sign-in,\n' +
        'so it cannot be read without their account. Two ways to share it with me:\n' +
        '  • Export → Share live link, then pass the /s/… link — I can read that directly.\n' +
        '  • Export → Excel, then pass the .xlsx.'
      )
    } else {
      fail(`Not a readable Ganttalf link: ${source}\nUse a /s/<token> share link, a #g=… snapshot link, or an .xlsx file.`)
    }
  } else if (existsSync(source)) {
    rows = await readWorkbook(source)
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
const writeChart = async (inFile, outFile) => {
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

  const shareUrl = `${BASE_URL}/#g=${encodeRows(rows)}`
  const XLSX = await loadXlsx()
  if (!XLSX) {
    console.log(`Share URL: ${shareUrl}`)
    console.error(`\nSkipped ${outFile} — ${NEED_XLSX}`)
    process.exit(0)
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
  console.log(`Share URL: ${shareUrl}`)
}

// --- entry -----------------------------------------------------------------
const argv = process.argv.slice(2)
if (!argv.length || argv[0] === '-h' || argv[0] === '--help') {
  console.log(usage)
  process.exit(argv.length ? 0 : 1)
}
if (argv[0] === '--read') {
  if (!argv[1]) fail(usage)
  await readChart(argv[1], argv[2])
} else {
  if (argv.length < 2) fail(usage)
  await writeChart(argv[0], argv[1])
}
