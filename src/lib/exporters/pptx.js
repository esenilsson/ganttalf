import Pptxgen from 'pptxgenjs'

// Rebuilds the chart from the shared layout as native, editable PowerPoint
// shapes — every bar is a rectangle, every label a text box.
const FONT_FACE = 'Arial'

export async function exportPptx(layout, filename = 'ganttalf.pptx') {
  const { items, groups, hasGroups, ts, dims: D, todayX, todayLabel, dottedX, solidWeeks, weekLabels, arrows } = layout

  const pptx = new Pptxgen()
  pptx.defineLayout({ name: 'WIDE', width: 13.33, height: 7.5 })
  pptx.layout = 'WIDE'
  const slide = pptx.addSlide()

  // px → inches, scaled to fit the slide with 0.4" margins
  const margin = 0.4
  const scale = Math.min(
    (13.33 - margin * 2) / D.totalWidth,
    (7.5 - margin * 2) / D.totalHeight,
  )
  const X = (px) => margin + px * scale
  const Y = (px) => margin + px * scale
  const S = (px) => px * scale
  const PT = (px) => Math.max(Math.round(px * scale * 72 * 10) / 10, 4)

  const text = (str, xPx, yPx, wPx, hPx, opts = {}) =>
    slide.addText(str, {
      x: X(xPx), y: Y(yPx), w: S(wPx), h: S(hPx),
      fontFace: FONT_FACE, color: '2B2320', margin: 0,
      align: 'left', valign: 'middle', ...opts,
    })
  const line = (x1, y1, x2, y2, opts = {}) =>
    slide.addShape(pptx.ShapeType.line, {
      x: X(x1), y: Y(y1), w: S(x2 - x1), h: S(y2 - y1),
      line: { color: '2B2320', width: 0.75, ...opts },
    })

  // Header labels
  text('Activity', D.activityColX, D.headerTop, D.activityColW, D.headerH, { fontSize: PT(19), bold: true })
  for (const m of ts.months) {
    if (m.showLabel) {
      text(m.label, D.chartX + m.labelX, D.headerTop, 120, D.headerH, { fontSize: PT(19), bold: true })
    }
  }

  // Gridlines: dotted (weeks in month mode / days in week mode), solid week
  // boundaries + W## labels in week mode, month boundaries always solid
  for (const gx of dottedX) {
    line(D.chartX + gx, D.bodyTop, D.chartX + gx, D.bodyBottom, { color: '9A948D', width: 0.5, dashType: 'sysDot' })
  }
  for (const w of solidWeeks) {
    line(D.chartX + w.x, D.headerTop + 32, D.chartX + w.x, D.bodyBottom, { color: '9A948D', width: 0.6 })
  }
  for (const w of weekLabels) {
    text(w.label, D.chartX + w.x + 5, D.headerTop + 34, 60, 18, { fontSize: PT(12), color: '6B6058' })
  }
  for (const m of ts.months) {
    if (m.boundaryX != null) {
      line(D.chartX + m.boundaryX, D.headerTop + 10, D.chartX + m.boundaryX, D.bodyBottom)
    }
  }

  // Chart frame
  slide.addShape(pptx.ShapeType.rect, {
    x: X(D.chartX), y: Y(D.bodyTop), w: S(D.chartW), h: S(D.bodyBottom - D.bodyTop),
    fill: { type: 'none' }, line: { color: '2B2320', width: 1 },
  })

  // Group breakers + labels
  groups.forEach((g, gi) => {
    if (gi > 0) line(D.groupColX, g.yTop, D.totalWidth - 16, g.yTop)
    if (hasGroups && g.name) {
      text(g.name, D.groupColX, g.labelY - D.rowH / 2, D.groupColW - 16, D.rowH, {
        fontSize: PT(15), bold: true, align: 'right',
      })
    }
  })

  // Rows
  for (const it of items) {
    text(it.row.activity, D.activityColX, it.y, D.activityColW - 10, D.rowH, { fontSize: PT(14) })

    for (const seg of [it.preTentative, it.postTentative]) {
      if (seg && seg.x1 - seg.x0 > 0) {
        slide.addShape(pptx.ShapeType.rect, {
          x: X(D.chartX + seg.x0), y: Y(it.barY), w: S(seg.x1 - seg.x0), h: S(it.barH),
          fill: { type: 'none' }, line: { color: '6B6058', width: 1, dashType: 'dash' },
        })
      }
    }
    if (it.solid && it.solid.x1 - it.solid.x0 > 0) {
      slide.addShape(pptx.ShapeType.rect, {
        x: X(D.chartX + it.solid.x0), y: Y(it.barY), w: S(it.solid.x1 - it.solid.x0), h: S(it.barH),
        fill: { color: '2B2320' }, line: { type: 'none' },
      })
    }
    if (it.milestoneX != null) {
      slide.addShape(pptx.ShapeType.triangle, {
        x: X(D.chartX + it.milestoneX - 7), y: Y(it.cy - 6), w: S(14), h: S(12),
        fill: { color: '2B2320' }, line: { type: 'none' },
      })
      if (it.milestoneLabelLeft) {
        text(it.milestoneLabel, D.chartX + it.milestoneX - 101, it.y, 90, D.rowH, { fontSize: PT(11), color: '6B6058', align: 'right' })
      } else {
        text(it.milestoneLabel, D.chartX + it.milestoneX + 11, it.y, 90, D.rowH, { fontSize: PT(11), color: '6B6058' })
      }
    }
    if (it.row.responsible && it.rightEdgeX != null) {
      const rx = it.rightEdgeX + (it.milestoneX != null ? 78 : 8)
      text(it.row.responsible, D.chartX + rx, it.y, 110, D.rowH, { fontSize: PT(11), color: '9A948D' })
    }
  }

  // Dependency arrows: each elbow segment is its own line shape; the final
  // segment into the successor carries the native arrowhead
  const seg = (x1, y1, x2, y2, opts = {}) =>
    slide.addShape(pptx.ShapeType.line, {
      x: X(Math.min(x1, x2)), y: Y(Math.min(y1, y2)),
      w: S(Math.abs(x2 - x1)), h: S(Math.abs(y2 - y1)),
      flipH: x2 < x1, flipV: y2 < y1,
      line: { color: '6B6058', width: 1, ...opts },
    })
  for (const a of arrows) {
    for (let i = 0; i < a.pts.length - 1; i++) {
      const [x1, y1] = a.pts[i]
      const [x2, y2] = a.pts[i + 1]
      seg(D.chartX + x1, y1, D.chartX + x2, y2)
    }
    const [lx, ly] = a.pts[a.pts.length - 1]
    seg(D.chartX + lx, ly, D.chartX + a.headX, a.headY, { endArrowType: 'triangle' })
  }

  // Today marker
  if (todayX != null) {
    line(D.chartX + todayX, D.headerTop + 10, D.chartX + todayX, D.bodyBottom + 6, { width: 1.2, dashType: 'dash' })
    slide.addShape(pptx.ShapeType.triangle, {
      x: X(D.chartX + todayX - 8), y: Y(D.bodyBottom + 10), w: S(16), h: S(14),
      fill: { color: '2B2320' }, line: { type: 'none' },
    })
    text(todayLabel, D.chartX + todayX - 60, D.bodyBottom + 26, 120, 20, { fontSize: PT(14), align: 'center' })
  }

  await pptx.writeFile({ fileName: filename })
}
