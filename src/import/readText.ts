/**
 * 從 PDF 或圖片讀出文字行，交給 textParagraphs 接成段落。
 *   - PDF 有文字層：直接讀文字，最準
 *   - 掃描的 PDF（沒有文字層）與圖片：在瀏覽器裡做文字辨識（Tesseract.js），檔案不會上傳
 * 只在按下匯入時載入（pdf.js 與文字辨識都不小）。
 */
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'
import type { TextItem } from 'pdfjs-dist/types/src/display/api'
import type { Worker as OcrWorker } from 'tesseract.js'

/** 一頁少於這麼多字，就當成掃描頁改用文字辨識 */
const MIN_TEXT_CHARS = 20
/** 掃描頁轉成圖片時的放大倍率，太小辨識不準 */
const SCAN_SCALE = 2.5

export type PageProgress = { done: number; total: number; ocr: boolean }

export type TextSource = { lines: string[]; ocrPages: number }

export function isPdf(file: File) {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
}

export function isImage(file: File) {
  return file.type.startsWith('image/') || /\.(png|jpe?g|webp|bmp|gif)$/i.test(file.name)
}

async function loadPdf(file: File): Promise<PDFDocumentProxy> {
  const pdfjs = await import('pdfjs-dist')
  const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
  try {
    return await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  } catch {
    throw new Error(`「${file.name}」打不開，可能不是 PDF 或檔案已損壞。有密碼保護的 PDF 請先解除密碼。`)
  }
}

type Placed = { text: string; x: number; y: number; w: number; h: number }

/** 文字片段依位置排成一行一行；同一行內依 x 由左到右，字距大時補一個空白 */
function toLines(items: Placed[]): string[] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x)
  const rows: Placed[][] = []
  for (const it of sorted) {
    const row = rows[rows.length - 1]
    if (row && Math.abs(row[0].y - it.y) <= Math.max(row[0].h, it.h) * 0.5) row.push(it)
    else rows.push([it])
  }
  return rows.map((row) => {
    row.sort((a, b) => a.x - b.x)
    let line = ''
    let end = -Infinity
    for (const it of row) {
      if (line && it.x - end > it.h * 0.3) line += ' '
      line += it.text
      end = it.x + it.w
    }
    return line
  })
}

/** 左右雙欄的考卷：中線上幾乎沒有字橫跨，且兩邊都有不少字，就先讀左欄再讀右欄 */
function splitColumns(items: Placed[], pageWidth: number): Placed[][] {
  const mid = pageWidth / 2
  const crossing = items.filter((it) => it.x < mid - 4 && it.x + it.w > mid + 4).length
  const left = items.filter((it) => it.x + it.w / 2 < mid)
  const right = items.filter((it) => it.x + it.w / 2 >= mid)
  const twoColumns = crossing <= items.length * 0.03 && left.length > items.length * 0.2 && right.length > items.length * 0.2
  return twoColumns ? [left, right] : [items]
}

async function pdfPageText(page: PDFPageProxy): Promise<string[]> {
  const content = await page.getTextContent()
  const items: Placed[] = (content.items as TextItem[])
    .filter((it) => typeof it.str === 'string' && it.str.trim())
    .map((it) => ({
      text: it.str,
      x: it.transform[4],
      y: it.transform[5],
      w: it.width,
      h: it.height || Math.abs(it.transform[3]) || 10,
    }))
  const width = page.getViewport({ scale: 1 }).width
  return splitColumns(items, width).flatMap(toLines)
}

async function renderPage(page: PDFPageProxy): Promise<HTMLCanvasElement> {
  const viewport = page.getViewport({ scale: SCAN_SCALE })
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvasContext: ctx, viewport }).promise
  return canvas
}

/** 讀檔案裡所有頁面的文字行。onPage 每讀完一頁回報一次 */
export async function readTextFiles(files: File[], onPage?: (p: PageProgress) => void): Promise<TextSource> {
  // 先開好所有 PDF，才知道總頁數
  const docs = new Map<File, PDFDocumentProxy>()
  for (const f of files) if (isPdf(f)) docs.set(f, await loadPdf(f))
  const total = files.reduce((n, f) => n + (docs.get(f)?.numPages ?? 1), 0)

  let worker: OcrWorker | null = null
  const ocr = async (image: HTMLCanvasElement | File): Promise<string[]> => {
    if (!worker) {
      const { createWorker } = await import('tesseract.js')
      try {
        worker = await createWorker(['chi_tra', 'eng'])
      } catch {
        throw new Error('文字辨識需要先下載辨識資料（約 20 MB，只需下載一次），請確認網路連線後再試一次。')
      }
    }
    const { data } = await worker.recognize(image)
    return data.text.split('\n')
  }

  const lines: string[] = []
  let done = 0
  let ocrPages = 0
  try {
    for (const f of files) {
      const doc = docs.get(f)
      if (doc) {
        for (let n = 1; n <= doc.numPages; n++) {
          const page = await doc.getPage(n)
          let pageLines = await pdfPageText(page)
          const scanned = pageLines.join('').replace(/\s/g, '').length < MIN_TEXT_CHARS
          onPage?.({ done, total, ocr: scanned })
          if (scanned) {
            pageLines = await ocr(await renderPage(page))
            ocrPages += 1
          }
          lines.push(...pageLines)
          done += 1
        }
        await doc.destroy()
      } else if (isImage(f)) {
        onPage?.({ done, total, ocr: true })
        lines.push(...(await ocr(f)))
        ocrPages += 1
        done += 1
      } else {
        throw new Error(`「${f.name}」不是 Word、PDF 或圖片檔。`)
      }
    }
  } finally {
    await (worker as OcrWorker | null)?.terminate()
  }
  onPage?.({ done, total, ocr: false })
  return { lines, ocrPages }
}
