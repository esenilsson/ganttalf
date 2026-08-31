import * as XLSX from 'xlsx'
import { parseDateValue, isoToDate } from './dates.js'

const COLUMNS = [
  ['group', 'Group'],
  ['activity', 'Activity'],
  ['tentativeStart', 'Tentative Start'],
  ['start', 'Start'],
  ['end', 'End'],
  ['tentativeEnd', 'Tentative End'],
  ['milestone', 'Milestone'],
  ['responsible', 'Responsible'],
  ['dependsOn', 'Depends On'],
]

const HEADER_ALIASES = { dependson: 'dependsOn', dependency: 'dependsOn', dependencies: 'dependsOn' }

const DATE_FIELDS = ['tentativeStart', 'start', 'end', 'tentativeEnd', 'milestone']

const norm = (s) => String(s ?? '').toLowerCase().replace(/[\s_-]/g, '')

let nextId = 1
export const newId = () => nextId++

export async function parseWorkbook(file) {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { cellDates: true })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null })

  // Find the header row: first row containing an "Activity" cell
  const headerIdx = grid.findIndex((row) => row?.some((c) => norm(c) === 'activity'))
  if (headerIdx === -1) throw new Error('No "Activity" column found in the first sheet.')
  const header = grid[headerIdx].map(norm)
  const colOf = {}
  for (const [key, label] of COLUMNS) colOf[key] = header.indexOf(norm(label))
  if (colOf.dependsOn === -1) {
    colOf.dependsOn = header.findIndex((h) => HEADER_ALIASES[h] === 'dependsOn')
  }

  const rows = []
  for (const raw of grid.slice(headerIdx + 1)) {
    if (!raw) continue
    const activity = colOf.activity >= 0 ? raw[colOf.activity] : null
    if (activity == null || String(activity).trim() === '') continue
    const row = { id: newId(), activity: String(activity).trim() }
    row.group = colOf.group >= 0 && raw[colOf.group] != null ? String(raw[colOf.group]).trim() : ''
    row.responsible = colOf.responsible >= 0 && raw[colOf.responsible] != null ? String(raw[colOf.responsible]).trim() : ''
    row.dependsOn = colOf.dependsOn >= 0 && raw[colOf.dependsOn] != null ? String(raw[colOf.dependsOn]).trim() : ''
    for (const f of DATE_FIELDS) row[f] = colOf[f] >= 0 ? parseDateValue(raw[colOf[f]]) : null
    rows.push(row)
  }
  if (!rows.length) throw new Error('No activity rows found under the header.')
  return rows
}

export function buildWorkbook(rows) {
  const header = COLUMNS.map(([, label]) => label)
  const aoa = [header]
  for (const r of rows) {
    aoa.push(COLUMNS.map(([key]) => {
      if (DATE_FIELDS.includes(key)) return isoToDate(r[key])
      return r[key] || null
    }))
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true })
  // Format date cells as dd/mm/yyyy
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
  return wb
}

export function exportWorkbook(rows, filename = 'ganttalf.xlsx') {
  XLSX.writeFile(buildWorkbook(rows), filename)
}
