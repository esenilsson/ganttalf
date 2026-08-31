import { isoToDays, daysToIso, isoWeekNum } from './dates.js'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Builds the date→x mapping plus month/week ticks for a set of rows.
// Domain spans every date on any row, padded a few days on each side.
export function makeTimescale(rows, chartWidth, todayIsoStr) {
  let min = Infinity
  let max = -Infinity
  for (const r of rows) {
    for (const iso of [r.tentativeStart, r.start, r.end, r.tentativeEnd, r.milestone]) {
      const d = isoToDays(iso)
      if (d == null) continue
      if (d < min) min = d
      if (d > max) max = d
    }
  }
  if (!isFinite(min)) {
    const t = isoToDays(todayIsoStr)
    min = t - 7
    max = t + 30
  }
  min -= 4
  max += 6
  const span = Math.max(max - min, 1)
  const dayWidth = chartWidth / span

  const dateToX = (iso) => (isoToDays(iso) - min) * dayWidth
  const daysToX = (d) => (d - min) * dayWidth
  const xToDays = (x) => Math.round(x / dayWidth) + min

  // Week ticks: every Monday inside the domain. Day 0 (1970-01-01) was a Thursday.
  const weeks = []
  for (let d = Math.ceil(min); d <= max; d++) {
    if (((d % 7) + 7) % 7 === 4) {
      weeks.push({ x: daysToX(d), day: d, label: `W${isoWeekNum(d)}` })
    }
  }

  // Day ticks (used by week mode when there's room)
  const days = []
  for (let d = Math.ceil(min); d <= max; d++) days.push(daysToX(d))

  // Month boundaries + labels
  const months = []
  const first = new Date(min * 86400000)
  let y = first.getUTCFullYear()
  let mo = first.getUTCMonth()
  for (;;) {
    const startDay = Date.UTC(y, mo, 1) / 86400000
    const nextDay = Date.UTC(y, mo + 1, 1) / 86400000
    if (startDay > max) break
    if (nextDay > min) {
      const x0 = Math.max(daysToX(startDay), 0)
      const x1 = Math.min(daysToX(nextDay), chartWidth)
      months.push({
        label: MONTHS[mo],
        year: y,
        boundaryX: startDay >= min ? daysToX(startDay) : null,
        labelX: x0 + 8,
        width: x1 - x0,
        showLabel: x1 - x0 > 48 && x0 + 52 <= chartWidth,
      })
    }
    mo++
    if (mo === 12) { mo = 0; y++ }
  }

  return { min, max, dayWidth, dateToX, daysToX, xToDays, weeks, days, months, snap: daysToIso }
}
