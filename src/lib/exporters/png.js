import { downloadBlob, serializeSvg } from './download.js'

const SCALE = 3

export function exportPng(svgEl, filename = 'ganttalf.png') {
  return new Promise((resolve, reject) => {
    const w = svgEl.width.baseVal.value
    const h = svgEl.height.baseVal.value
    const blob = new Blob([serializeSvg(svgEl)], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = w * SCALE
      canvas.height = h * SCALE
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.scale(SCALE, SCALE)
      ctx.drawImage(img, 0, 0)
      URL.revokeObjectURL(url)
      canvas.toBlob((png) => {
        downloadBlob(png, filename)
        resolve()
      }, 'image/png')
    }
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e) }
    img.src = url
  })
}
