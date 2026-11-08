/**
 * 答案表、雙向細目表這類文件：用 canvas 以卷面字型畫成一頁一頁的圖，再存成 PDF。
 * 不必另外把中文字型塞進 PDF。
 */

export type DocBlock =
  | { kind: 'title'; text: string }
  | { kind: 'heading'; text: string }
  | { kind: 'text'; text: string }
  /** 題號＋答案的小格子，一列放好幾格 */
  | { kind: 'answers'; cells: { num: string; answer: string }[] }
  | { kind: 'table'; columns: { label: string; width: number; align?: 'left' | 'center' }[]; rows: string[][]; boldLast?: boolean }

const SCALE = 2
const INK = '#111111'
const MUTED = '#555555'
const RULE = '#9aa3ad'

type Pen = { ctx: CanvasRenderingContext2D; family: string }

function font(pen: Pen, size: number, bold = false) {
  pen.ctx.font = `${bold ? 'bold ' : ''}${size}px ${pen.family}`
}

/** 依寬度斷行；英數字不拆開 */
function wrap(pen: Pen, text: string, width: number): string[] {
  const out: string[] = []
  for (const para of text.split('\n')) {
    const tokens = para.match(/[A-Za-z0-9.,'’()-]+|./gu) ?? ['']
    let line = ''
    for (const tok of tokens) {
      if (line && pen.ctx.measureText(line + tok).width > width) {
        out.push(line)
        line = tok.trimStart()
      } else line += tok
    }
    out.push(line)
  }
  return out
}

export function renderDocPages(blocks: DocBlock[], pageW: number, pageH: number, family: string, footer: string): HTMLCanvasElement[] {
  const pages: HTMLCanvasElement[] = []
  const margin = Math.round(pageW * 0.07)
  const contentW = pageW - margin * 2
  const bottom = pageH - margin
  let pen: Pen = null as unknown as Pen
  let y = 0

  const newPage = () => {
    const canvas = document.createElement('canvas')
    canvas.width = pageW * SCALE
    canvas.height = pageH * SCALE
    const ctx = canvas.getContext('2d')!
    ctx.scale(SCALE, SCALE)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, pageW, pageH)
    ctx.textBaseline = 'top'
    pen = { ctx, family }
    pages.push(canvas)
    y = margin
  }
  const ensure = (h: number) => {
    if (y + h > bottom && y > margin + 1) newPage()
  }
  newPage()

  for (const block of blocks) {
    const { ctx } = pen
    if (block.kind === 'title' || block.kind === 'heading' || block.kind === 'text') {
      const size = block.kind === 'title' ? 20 : block.kind === 'heading' ? 15 : 12
      const lh = size * 1.5
      font(pen, size, block.kind !== 'text')
      const lines = wrap(pen, block.text, contentW)
      ensure(lh * Math.min(lines.length, 2) + (block.kind === 'heading' ? 6 : 0))
      if (block.kind === 'heading') y += 6
      for (const line of lines) {
        ensure(lh)
        font(pen, size, block.kind !== 'text')
        pen.ctx.fillStyle = block.kind === 'text' ? MUTED : INK
        pen.ctx.textAlign = block.kind === 'title' ? 'center' : 'left'
        pen.ctx.fillText(line, block.kind === 'title' ? pageW / 2 : margin, y + (lh - size) / 2)
        y += lh
      }
      pen.ctx.textAlign = 'left'
      y += block.kind === 'title' ? 8 : 2
      continue
    }
    if (block.kind === 'answers') {
      const size = 13
      const lh = size * 1.45
      font(pen, size)
      const longest = Math.max(1, ...block.cells.map((c) => ctx.measureText(c.answer).width))
      const numW = Math.max(...block.cells.map((c) => ctx.measureText(c.num).width), size * 2) + 10
      const cols = Math.max(1, Math.min(5, Math.floor(contentW / (numW + Math.min(longest, contentW) + 16))))
      const cellW = contentW / cols
      for (let i = 0; i < block.cells.length; i += cols) {
        const row = block.cells.slice(i, i + cols)
        font(pen, size)
        const wrapped = row.map((c) => wrap(pen, c.answer || '—', cellW - numW - 10))
        const h = Math.max(...wrapped.map((w) => w.length)) * lh + 8
        ensure(h)
        row.forEach((c, k) => {
          const x = margin + k * cellW
          const p = pen.ctx
          p.strokeStyle = RULE
          p.lineWidth = 0.75
          p.strokeRect(x, y, cellW, h)
          p.fillStyle = '#f1f3f5'
          p.fillRect(x + 0.5, y + 0.5, numW - 1, h - 1)
          p.beginPath()
          p.moveTo(x + numW, y)
          p.lineTo(x + numW, y + h)
          p.stroke()
          font(pen, size, true)
          p.fillStyle = INK
          p.textAlign = 'center'
          p.fillText(c.num, x + numW / 2, y + 4 + (lh - size) / 2)
          p.textAlign = 'left'
          font(pen, size)
          p.fillStyle = '#b42318'
          wrapped[k].forEach((line, li) => p.fillText(line, x + numW + 6, y + 4 + li * lh + (lh - size) / 2))
        })
        y += h
      }
      y += 6
      continue
    }
    // table
    const size = 11.5
    const lh = size * 1.4
    const totalW = block.columns.reduce((s, c) => s + c.width, 0)
    const widths = block.columns.map((c) => (c.width / totalW) * contentW)
    const drawRow = (cells: string[], head: boolean, bold: boolean) => {
      font(pen, size, head || bold)
      const wrapped = cells.map((cell, k) => wrap(pen, cell, widths[k] - 8))
      const h = Math.max(...wrapped.map((w) => w.length)) * lh + 6
      ensure(h)
      const p = pen.ctx
      let x = margin
      wrapped.forEach((lines, k) => {
        if (head) {
          p.fillStyle = '#eef1f4'
          p.fillRect(x, y, widths[k], h)
        }
        p.strokeStyle = RULE
        p.lineWidth = 0.75
        p.strokeRect(x, y, widths[k], h)
        font(pen, size, head || bold)
        p.fillStyle = INK
        const align = block.columns[k].align ?? (head ? 'center' : 'left')
        p.textAlign = align
        const tx = align === 'center' ? x + widths[k] / 2 : x + 4
        lines.forEach((line, li) => p.fillText(line, tx, y + 3 + li * lh + (lh - size) / 2))
        p.textAlign = 'left'
        x += widths[k]
      })
      y += h
    }
    drawRow(
      block.columns.map((c) => c.label),
      true,
      false,
    )
    block.rows.forEach((row, i) => {
      if (y + lh + 6 > bottom) {
        newPage()
        drawRow(
          block.columns.map((c) => c.label),
          true,
          false,
        )
      }
      drawRow(row, false, !!block.boldLast && i === block.rows.length - 1)
    })
    y += 10
  }

  pages.forEach((canvas, i) => {
    const ctx = canvas.getContext('2d')!
    ctx.font = `10px ${family}`
    ctx.fillStyle = MUTED
    ctx.textAlign = 'center'
    ctx.fillText(`${footer}　第 ${i + 1} 頁／共 ${pages.length} 頁`, pageW / 2, pageH - margin / 2)
  })
  return pages
}

export async function saveCanvasPdf(pages: HTMLCanvasElement[], pageW: number, pageH: number, filename: string): Promise<void> {
  if (!pages.length) return
  const { jsPDF } = await import('jspdf')
  const orientation = pageH >= pageW ? 'portrait' : 'landscape'
  const pdf = new jsPDF({ orientation, unit: 'px', format: [pageW, pageH] })
  pages.forEach((canvas, i) => {
    if (i > 0) pdf.addPage([pageW, pageH], orientation)
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, pageW, pageH, undefined, 'FAST')
  })
  pdf.save(filename)
}
