import { jsPDF } from 'jspdf'
import type Konva from 'konva'

/** 將 Konva Stage 輸出為單頁 PDF（像素對齊畫布） */
export function exportStageToPdf(stage: Konva.Stage, filename = '試卷.pdf'): void {
  const w = stage.width()
  const h = stage.height()
  const dataUrl = stage.toDataURL({ pixelRatio: 2, mimeType: 'image/png', quality: 1 })
  const orientation = h >= w ? 'portrait' : 'landscape'
  const pdf = new jsPDF({
    orientation,
    unit: 'px',
    format: [w, h],
  })
  pdf.addImage(dataUrl, 'PNG', 0, 0, w, h, undefined, 'FAST')
  pdf.save(filename)
}
