import type Konva from 'konva'

/** 答案圖層。編輯時隱藏，只有「匯出答案」會把它畫進 PDF。 */
export const ANSWER_KEY_NAME = 'answer-key'
const EDITOR_ONLY_NAME = 'editor-only'

/** 頁面座標是 96 dpi 的 px；乘 3 約 288 dpi，印出來的小字才不會糊 */
const EXPORT_PIXEL_RATIO = 3

function stageToCanvas(stage: Konva.Stage, includeAnswers: boolean): HTMLCanvasElement {
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
    return stage.toCanvas({ pixelRatio: EXPORT_PIXEL_RATIO })
  } finally {
    for (let i = touched.length - 1; i >= 0; i--) touched[i].node.visible(touched[i].visible)
  }
}

/** 轉成灰階。黑白印表機遇到淡色字常印得太淡，灰階後至少看得出深淺 */
export function toGrayscale(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const y = Math.round(d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114)
    d[i] = d[i + 1] = d[i + 2] = y
  }
  ctx.putImageData(img, 0, 0)
  return canvas
}

/** 讓瀏覽器先畫一格畫面，頁數多時匯出中途不會整個卡住 */
const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

export type ExportOptions = {
  includeAnswers?: boolean
  /** 轉成灰階 */
  mono?: boolean
  /** 一張紙放幾頁。2：兩頁左右並排在兩倍寬的紙上 */
  perSheet?: 1 | 2
  onProgress?: (done: number, total: number) => void
}

/**
 * 每個 Stage 輸出為一頁 PDF。輔助線、選取框不輸出；includeAnswers 才印上答案。
 * jsPDF 很大，按下匯出才載入。onProgress 回報已完成的頁數。
 */
export async function exportStagesToPdf(stages: Konva.Stage[], filename = '試卷.pdf', opts: ExportOptions = {}): Promise<void> {
  if (!stages.length) return
  const { jsPDF } = await import('jspdf')
  const w = stages[0].width()
  const h = stages[0].height()
  const per = opts.perSheet === 2 ? 2 : 1
  const sheetW = w * per
  const orientation = h >= sheetW ? 'portrait' : 'landscape'
  const pdf = new jsPDF({ orientation, unit: 'px', format: [sheetW, h] })
  for (let i = 0; i < stages.length; i++) {
    await nextFrame()
    const slot = i % per
    if (i > 0 && slot === 0) pdf.addPage([sheetW, h], orientation)
    let canvas = stageToCanvas(stages[i], opts.includeAnswers === true)
    if (opts.mono) canvas = toGrayscale(canvas)
    pdf.addImage(canvas, 'PNG', slot * w, 0, w, h, undefined, 'FAST')
    opts.onProgress?.(i + 1, stages.length)
  }
  pdf.save(filename)
}
