import { jsPDF } from 'jspdf'
import type Konva from 'konva'

/** 答案圖層。編輯時隱藏，只有「匯出答案」會把它畫進 PDF。 */
export const ANSWER_KEY_NAME = 'answer-key'
const EDITOR_ONLY_NAME = 'editor-only'

function stageToPng(stage: Konva.Stage, includeAnswers: boolean): string {
  const touched: { node: Konva.Node; visible: boolean }[] = []
  const setVisible = (selector: string, visible: boolean) => {
    stage.find(selector).forEach((node) => {
      if (node.visible() === visible) return
      touched.push({ node, visible: node.visible() })
      node.visible(visible)
    })
  }
  setVisible(`.${EDITOR_ONLY_NAME}`, false)
  setVisible(`.${ANSWER_KEY_NAME}`, includeAnswers)
  try {
    return stage.toDataURL({ pixelRatio: 2, mimeType: 'image/png', quality: 1 })
  } finally {
    for (let i = touched.length - 1; i >= 0; i--) touched[i].node.visible(touched[i].visible)
  }
}

/** 每個 Stage 輸出為一頁 PDF。輔助線、選取框不輸出；includeAnswers 才印上答案。 */
export function exportStagesToPdf(stages: Konva.Stage[], filename = '試卷.pdf', includeAnswers = false): void {
  if (!stages.length) return
  const w = stages[0].width()
  const h = stages[0].height()
  const orientation = h >= w ? 'portrait' : 'landscape'
  const pdf = new jsPDF({ orientation, unit: 'px', format: [w, h] })
  stages.forEach((stage, i) => {
    if (i > 0) pdf.addPage([w, h], orientation)
    pdf.addImage(stageToPng(stage, includeAnswers), 'PNG', 0, 0, w, h, undefined, 'FAST')
  })
  pdf.save(filename)
}
