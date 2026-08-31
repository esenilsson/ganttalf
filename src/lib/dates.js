// All dates flow through the app as ISO strings ('yyyy-mm-dd') or null.
// Conversions use UTC throughout so day arithmetic is immune to DST.

const DAY_MS = 86400000

export function isoToDays(iso) {
  if (!iso) return null
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y, m - 1, d) / DAY_MS
}

export function daysToIso(days) {
  const dt = new Date(days * DAY_MS)
  const y = dt.getUTCFullYear()
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const d = String(dt.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function shiftIso(iso, deltaDays) {
  if (!iso) return null
  return daysToIso(isoToDays(iso) + deltaDays)
}

export function todayIso() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// dd/mm/yyyy — the label format used on the chart (thinkcell style)
export function formatDMY(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export function dateToIso(dt) {
  if (!(dt instanceof Date) || isNaN(dt)) return null
  // SheetJS cellDates produces dates at UTC-ish midnight; read UTC first,
  // falling back to local calendar date when the UTC reading is off-midnight.
  if (dt.getUTCHours() === 0 && dt.getUTCMinutes() === 0) {
    return daysToIso(Math.floor(dt.getTime() / DAY_MS))
  }
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, '0')
  const d = String(dt.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Accepts Date, 'yyyy-mm-dd', 'dd/mm/yyyy', 'dd.mm.yyyy', 'dd-mm-yyyy'
export function parseDateValue(v) {
  if (v == null || v === '') return null
  if (v instanceof Date) return dateToIso(v)
  if (typeof v === 'number') {
    // Excel serial date (1900 epoch)
    const dt = new Date(Math.round((v - 25569) * DAY_MS))
    return dateToIso(dt)
  }
  const s = String(v).trim()
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return null
}

// ISO-8601 week number for an epoch-day value
export function isoWeekNum(day) {
  const target = new Date(day * DAY_MS)
  const dayNr = (target.getUTCDay() + 6) % 7
  target.setUTCDate(target.getUTCDate() - dayNr + 3)
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4))
  const ftDayNr = (firstThursday.getUTCDay() + 6) % 7
  firstThursday.setUTCDate(firstThursday.getUTCDate() - ftDayNr + 3)
  return 1 + Math.round((target - firstThursday) / (7 * DAY_MS))
}

export function isoToDate(iso) {
  if (!iso) return null
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}
