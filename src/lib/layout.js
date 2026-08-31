import { makeTimescale } from './timescale.js'
import { formatDMY, todayIso, isoToDays } from './dates.js'

export const FONT = "'Archivo', -apple-system, 'Segoe UI', system-ui, sans-serif"

const PAD = { left: 16, right: 16, top: 8 }
const HEADER_H = 40
const ROW_H = 32
const BAR_H = 13
const FOOTER_H = 58

let _ctx = null
function measure(text, px, bold = false) {
  if (typeof document !== 'undefined') {
    if (!_ctx) _ctx = document.createElement('canvas').getContext('2d')
    _ctx.font = `${bold ? '600 ' : ''}${px}px Archivo, sans-serif`
    return _ctx.measureText(text).width
  }
  return text.length * px * 0.55
}

// Groups = consecutive runs of the same (non-empty) group value.
export function clusterGroups(rows) {
  const groups = []
  let current = null
  rows.forEach((r, i) => {
    const name = r.group || ''
    if (!current || current.name !== name) {
      current = { name, startIdx: i, endIdx: i }
      groups.push(current)
    } else {
      current.endIdx = i
    }
  })
  return groups
}

// Pure geometry for one render: everything the SVG and the PPTX export need.
export function computeLayout(rows, { totalWidth = 1420, scale = 'month' } = {}) {
  const today = todayIso()
  const groups = clusterGroups(rows)
  const hasGroups = groups.some((g) => g.name)

  const groupColW = hasGroups
    ? Math.min(Math.max(...groups.map((g) => measure(g.name, 15, true)), 60) + 28, 180)
    : 12
  const activityColW = Math.min(
    Math.max(...rows.map((r) => measure(r.activity, 14)), 120) + 28,
    620,
  )
  const chartX = PAD.left + groupColW + activityColW
  const chartW = totalWidth - chartX - PAD.right
  const ts = makeTimescale(rows, chartW, today)

  // Week mode gets a second header row for W## labels
  const headerH = scale === 'week' ? HEADER_H + 18 : HEADER_H
  const bodyTop = PAD.top + headerH
  const bodyH = rows.length * ROW_H
  const totalHeight = bodyTop + bodyH + FOOTER_H

  const items = rows.map((r, i) => {
    const y = bodyTop + i * ROW_H
    const cy = y + ROW_H / 2
    const barY = cy - BAR_H / 2
    const seg = (a, b) => ({ x0: ts.dateToX(a), x1: ts.dateToX(b) })
    const item = {
      row: r,
      index: i,
      y,
      cy,
      barY,
      barH: BAR_H,
      labelY: cy,
      solid: r.start && r.end && isoToDays(r.end) >= isoToDays(r.start) ? seg(r.start, r.end) : null,
      preTentative: null,
      postTentative: null,
      milestoneX: r.milestone ? ts.dateToX(r.milestone) : null,
      milestoneLabel: r.milestone ? formatDMY(r.milestone) : null,
    }
    // Flip the milestone date label to the left when it would overflow the frame
    item.milestoneLabelLeft = item.milestoneX != null && item.milestoneX + 80 > chartW
    if (r.tentativeStart && r.start && isoToDays(r.tentativeStart) < isoToDays(r.start)) {
      item.preTentative = seg(r.tentativeStart, r.start)
    }
    if (r.tentativeEnd && r.end && isoToDays(r.tentativeEnd) > isoToDays(r.end)) {
      item.postTentative = seg(r.end, r.tentativeEnd)
    }
    // Tentative-only span (no confirmed start/end): draw fully dashed
    if (!item.solid && r.tentativeStart && r.tentativeEnd) {
      item.preTentative = seg(r.tentativeStart, r.tentativeEnd)
    }
    // Responsible label sits right of the rightmost drawn element
    const xs = [item.solid?.x1, item.preTentative?.x1, item.postTentative?.x1, item.milestoneX]
      .filter((v) => v != null)
    item.rightEdgeX = xs.length ? Math.max(...xs) : null
    return item
  })

  const groupBands = groups.map((g) => ({
    name: g.name,
    yTop: bodyTop + g.startIdx * ROW_H,
    yBottom: bodyTop + (g.endIdx + 1) * ROW_H,
    labelY: bodyTop + g.startIdx * ROW_H + ROW_H / 2 + 2,
  }))

  const todayDays = isoToDays(today)
  const todayX = todayDays >= ts.min && todayDays <= ts.max ? ts.daysToX(todayDays) : null

  // Dependency arrows: `dependsOn` references a predecessor by activity name
  // (case-insensitive) or 1-based row number; comma/semicolon-separated for
  // several. Routed as elbows from predecessor bar end into successor bar start.
  const nameIdx = new Map()
  rows.forEach((r, i) => nameIdx.set(r.activity.trim().toLowerCase(), i))
  const arrows = []
  for (const succ of items) {
    if (!succ.row.dependsOn) continue
    for (const ref of String(succ.row.dependsOn).split(/[,;]+/).map((s) => s.trim()).filter(Boolean)) {
      const pi = /^\d+$/.test(ref) ? Number(ref) - 1 : nameIdx.get(ref.toLowerCase())
      if (pi == null || pi < 0 || pi >= items.length || pi === succ.index) continue
      const pred = items[pi]
      const sx = pred.solid?.x1 ?? pred.postTentative?.x1 ?? pred.milestoneX
      const txRaw = succ.solid?.x0 ?? succ.preTentative?.x0 ?? succ.milestoneX
      if (sx == null || txRaw == null) continue
      const tx = succ.milestoneX != null && succ.solid == null && succ.preTentative == null
        ? txRaw - 8 // stop short of a milestone triangle
        : txRaw
      const sy = pred.cy
      const ty = succ.cy
      let pts
      if (tx >= sx + 14) {
        const xm = sx + 7
        pts = [[sx, sy], [xm, sy], [xm, ty], [tx - 7, ty]]
      } else {
        // Successor starts before predecessor ends: route around, entering from
        // the gap just outside the successor bar
        const yMid = ty > sy ? succ.barY - 4 : succ.barY + BAR_H + 4
        pts = [[sx, sy], [sx + 7, sy], [sx + 7, yMid], [tx - 12, yMid], [tx - 12, ty], [tx - 7, ty]]
      }
      arrows.push({ pts, headX: tx, headY: ty })
    }
  }

  // Gridlines by scale: month mode dots the weeks; week mode draws solid week
  // boundaries with W## labels and dots the days when there's room.
  const dottedX = scale === 'week'
    ? (ts.dayWidth >= 7 ? ts.days : [])
    : ts.weeks.map((w) => w.x)
  const solidWeeks = scale === 'week' ? ts.weeks : []
  const weekLabels = scale === 'week' && ts.dayWidth * 7 >= 34
    ? ts.weeks.filter((w) => w.x + 34 <= chartW)
    : []

  return {
    rows, items, groups: groupBands, hasGroups, ts, today, scale,
    dottedX, solidWeeks, weekLabels, arrows,
    todayX, todayLabel: formatDMY(today),
    dims: {
      totalWidth, totalHeight, chartX, chartW,
      groupColX: PAD.left, groupColW,
      activityColX: PAD.left + groupColW, activityColW,
      headerTop: PAD.top, headerH,
      bodyTop, bodyBottom: bodyTop + bodyH, rowH: ROW_H, barH: BAR_H,
      footerH: FOOTER_H,
    },
  }
}
