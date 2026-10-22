import { jsPDF } from 'jspdf'
import type Konva from 'konva'

/** 將 Konva Stage 輸出為單頁 PDF（像素對齊畫布）；名為 hideName 的節點（輔助線、選取框）不輸出 */
export function exportStageToPdf(
  stage: Konva.Stage,
  filename = '試卷.pdf',
  hideName = 'editor-only',
): void {
  const w = stage.width()
  const h = stage.height()
  const hidden = stage.find(`.${hideName}`).filter((n) => n.visible())
  hidden.forEach((n) => n.hide())
  let dataUrl: string
  try {
    dataUrl = stage.toDataURL({ pixelRatio: 2, mimeType: 'image/png', quality: 1 })
  } finally {
    hidden.forEach((n) => n.show())
  }
  const orientation = h >= w ? 'portrait' : 'landscape'
  const pdf = new jsPDF({
    orientation,
    unit: 'px',
    format: [w, h],
  })
  pdf.addImage(dataUrl, 'PNG', 0, 0, w, h, undefined, 'FAST')
  pdf.save(filename)
}
