import { newId } from './excel.js'

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

export function addRow(afterIndex = store.rows.length - 1) {
  const prev = store.rows[afterIndex]
  store.rows.splice(afterIndex + 1, 0, {
    id: newId(),
    group: prev?.group ?? '',
    activity: 'New activity',
    tentativeStart: null,
    start: prev?.start ?? null,
    end: prev?.end ?? null,
    tentativeEnd: null,
    milestone: null,
    responsible: '',
    dependsOn: '',
  })
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
