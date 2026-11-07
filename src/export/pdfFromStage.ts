import type Konva from 'konva'

/** 答案圖層。編輯時隱藏，只有「匯出答案」會把它畫進 PDF。 */
export const ANSWER_KEY_NAME = 'answer-key'
const EDITOR_ONLY_NAME = 'editor-only'

/** 頁面座標是 96 dpi 的 px；乘 3 約 288 dpi，印出來的小字才不會糊 */
const EXPORT_PIXEL_RATIO = 3

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
    return stage.toDataURL({ pixelRatio: EXPORT_PIXEL_RATIO, mimeType: 'image/png', quality: 1 })
  } finally {
    for (let i = touched.length - 1; i >= 0; i--) touched[i].node.visible(touched[i].visible)
  }
}

/** 讓瀏覽器先畫一格畫面，頁數多時匯出中途不會整個卡住 */
const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

/**
 * 每個 Stage 輸出為一頁 PDF。輔助線、選取框不輸出；includeAnswers 才印上答案。
 * jsPDF 很大，按下匯出才載入。onProgress 回報已完成的頁數。
 */
export async function exportStagesToPdf(
  stages: Konva.Stage[],
  filename = '試卷.pdf',
  includeAnswers = false,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  if (!stages.length) return
  const { jsPDF } = await import('jspdf')
  const w = stages[0].width()
  const h = stages[0].height()
  const orientation = h >= w ? 'portrait' : 'landscape'
  const pdf = new jsPDF({ orientation, unit: 'px', format: [w, h] })
  for (let i = 0; i < stages.length; i++) {
    await nextFrame()
    if (i > 0) pdf.addPage([w, h], orientation)
    pdf.addImage(stageToPng(stages[i], includeAnswers), 'PNG', 0, 0, w, h, undefined, 'FAST')
    onProgress?.(i + 1, stages.length)
  }
  pdf.save(filename)
}
