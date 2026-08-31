// Generates public/template.xlsx — the starter file users download from the UI.
import XLSX from 'xlsx'
import { mkdirSync } from 'node:fs'

const header = ['Group', 'Activity', 'Tentative Start', 'Start', 'End', 'Tentative End', 'Milestone', 'Responsible', 'Depends On']
const d = (s) => { const [y, m, dd] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, dd)) }

const rows = [
  ['Quality', 'Overview of marketing spend coverage per brand', null, d('2026-08-03'), d('2026-08-14'), null, null, 'Emil'],
  ['Quality', 'Validation of marketing spend vs financial reports', null, d('2026-08-03'), d('2026-08-14'), null, null, ''],
  ['Quality', 'Map marketing spend initiatives to a product category', null, d('2026-07-27'), d('2026-08-14'), null, null, ''],
  ['Conversion', 'Get ahold of transaction ID and connect it to CRM data', null, d('2026-08-12'), d('2026-09-01'), d('2026-09-14'), null, ''],
  ['Conversion', 'Create models that map transaction ID to customer and ARR', d('2026-08-24'), d('2026-09-01'), d('2026-09-11'), d('2026-09-25'), null, ''],
  ['KPI', 'Average Order Value (AOV)', d('2026-08-31'), d('2026-09-07'), d('2026-09-18'), null, null, ''],
  ['Scorecard', 'Create first draft of the report', null, d('2026-09-16'), d('2026-09-22'), null, null, '', 'Average Order Value (AOV)'],
  ['Scorecard', 'Final version of dashboard', null, null, null, null, d('2026-09-29'), ''],
]

const ws = XLSX.utils.aoa_to_sheet([header, ...rows], { cellDates: true })
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
mkdirSync('public', { recursive: true })
XLSX.writeFile(wb, 'public/template.xlsx')
console.log('Wrote public/template.xlsx')
