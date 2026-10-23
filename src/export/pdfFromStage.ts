import { jsPDF } from 'jspdf'
import type Konva from 'konva'

function stageToPng(stage: Konva.Stage, hideName: string): string {
  const hidden = stage.find(`.${hideName}`).filter((n) => n.visible())
  hidden.forEach((n) => n.hide())
  try {
    return stage.toDataURL({ pixelRatio: 2, mimeType: 'image/png', quality: 1 })
  } finally {
    hidden.forEach((n) => n.show())
  }
}

/** 每個 Stage 輸出為一頁 PDF；名為 hideName 的節點（輔助線、選取框、提示文字）不輸出 */
export function exportStagesToPdf(stages: Konva.Stage[], filename = '試卷.pdf', hideName = 'editor-only'): void {
  if (!stages.length) return
  const w = stages[0].width()
  const h = stages[0].height()
  const orientation = h >= w ? 'portrait' : 'landscape'
  const pdf = new jsPDF({ orientation, unit: 'px', format: [w, h] })
  stages.forEach((stage, i) => {
    if (i > 0) pdf.addPage([w, h], orientation)
    pdf.addImage(stageToPng(stage, hideName), 'PNG', 0, 0, w, h, undefined, 'FAST')
  })
  pdf.save(filename)
}
