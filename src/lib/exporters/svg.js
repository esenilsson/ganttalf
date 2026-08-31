import { downloadBlob, serializeSvg } from './download.js'

export function exportSvg(svgEl, filename = 'ganttalf.svg') {
  const blob = new Blob([serializeSvg(svgEl)], { type: 'image/svg+xml' })
  downloadBlob(blob, filename)
}
