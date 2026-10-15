import { newId } from './excel.js'
import { todayIso } from './dates.js'

export const store = $state({
  rows: [],
  fileName: null,
  scale: 'month', // 'month' | 'week'
  chartId: null, // server id when working on a saved chart (/c/<id>)
  chartName: null,
  shareToken: null, // live-share token of the open chart, if any
  readonly: false, // viewing someone else's chart via /s/<token>
})

export function loadRows(rows, fileName = null) {
  store.rows = rows
  store.fileName = fileName
  // loading an xlsx / sample / share link detaches from any saved chart
  store.chartId = null
  store.chartName = null
  store.shareToken = null
  store.readonly = false
}

export function loadChart(id, name, data, shareToken = null) {
  store.rows = data.rows.map((r) => ({ ...r, id: newId() }))
  store.scale = data.scale === 'week' ? 'week' : 'month'
  store.fileName = name
  store.chartId = id
  store.chartName = name
  store.shareToken = shareToken
  store.readonly = false
}

export function loadSharedChart(name, data) {
  store.rows = data.rows.map((r) => ({ ...r, id: newId() }))
  store.scale = data.scale === 'week' ? 'week' : 'month'
  store.fileName = name
  store.chartId = null // never attaches to save/autosave
  store.chartName = name
  store.shareToken = null
  store.readonly = true
}

// Payload for server save and local autosave; the session-only row id is
// stripped (regenerated on load, same as share.js does)
export function serializeChart() {
  return {
    rows: $state.snapshot(store.rows).map(({ id, ...r }) => r),
    scale: store.scale,
  }
}

export function addRow(afterIndex = store.rows.length - 1, kind = 'task') {
  const prev = store.rows[afterIndex]
  store.rows.splice(afterIndex + 1, 0, {
    id: newId(),
    group: prev?.group ?? '',
    activity: kind === 'milestone' ? 'New milestone' : 'New activity',
    tentativeStart: null,
    start: kind === 'milestone' ? null : prev?.start ?? null,
    end: kind === 'milestone' ? null : prev?.end ?? null,
    tentativeEnd: null,
    milestone: kind === 'milestone' ? prev?.milestone ?? prev?.start ?? todayIso() : null,
    responsible: '',
    dependsOn: '',
  })
}

export const hasTaskDates = (row) =>
  Boolean(row.tentativeStart || row.start || row.end || row.tentativeEnd)

export const isMilestoneOnly = (row) => Boolean(row.milestone) && !hasTaskDates(row)

export function convertToMilestone(index) {
  const row = store.rows[index]
  row.milestone = row.milestone ?? row.start ?? row.tentativeStart ?? row.end ?? row.tentativeEnd ?? todayIso()
  row.tentativeStart = row.start = row.end = row.tentativeEnd = null
}

export function deleteRow(index) {
  store.rows.splice(index, 1)
}

export function moveRow(index, delta) {
  const j = index + delta
  if (j < 0 || j >= store.rows.length) return
  const [r] = store.rows.splice(index, 1)
  store.rows.splice(j, 0, r)
}

// Drag-reorder: pull the row out, optionally re-home it into a group, and drop
// it back at an absolute index (measured in the post-removal array).
export function reorderRow(from, to, group) {
  const [r] = store.rows.splice(from, 1)
  if (group !== undefined) r.group = group
  store.rows.splice(Math.max(0, Math.min(store.rows.length, to)), 0, r)
}
