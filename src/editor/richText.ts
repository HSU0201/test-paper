/** 考卷內文的局部上色。標記只存在資料裡，畫面與排版都用拆開後的字。 */
const OPEN = /^\{\{#([0-9a-fA-F]{6})\}\}/
const CLOSE = '{{/}}'

export type RichChar = { ch: string; color?: string }

export type RichPiece = { text: string; color: string; x: number; line: number }

export const INK_PALETTE: { hex: string; label: string }[] = [
  { hex: '#000000', label: '黑' },
  { hex: '#d92d20', label: '紅' },
  { hex: '#e06a00', label: '橙' },
  { hex: '#a67c00', label: '黃' },
  { hex: '#1f7a45', label: '綠' },
  { hex: '#1d4ed8', label: '藍' },
  { hex: '#7c3aed', label: '紫' },
]

/** 拆成一個字一個顏色。#000000 視為預設黑，不另外記錄。 */
export function richChars(input: string): RichChar[] {
  const out: RichChar[] = []
  let color: string | undefined
  let i = 0
  while (i < input.length) {
    if (input.startsWith(CLOSE, i)) {
      color = undefined
      i += CLOSE.length
      continue
    }
    const open = OPEN.exec(input.slice(i))
    if (open) {
      const hex = `#${open[1].toLowerCase()}`
      color = hex === '#000000' ? undefined : hex
      i += open[0].length
      continue
    }
    const cp = input.codePointAt(i)!
    const ch = String.fromCodePoint(cp)
    out.push(color ? { ch, color } : { ch })
    i += ch.length
  }
  return out
}

export function plainText(input: string): string {
  return richChars(input)
    .map((c) => c.ch)
    .join('')
}

export function paintText(input: string): { text: string; colors?: string[] } {
  const chars = richChars(input)
  const text = chars.map((c) => c.ch).join('')
  const colors = chars.some((c) => c.color) ? chars.map((c) => c.color ?? '') : undefined
  return { text, colors }
}

/** 橫排換行：同一行、同一色的字合成一段，x 是該段在行內的起點 */
export function layoutRichLines(
  text: string,
  colors: string[] | undefined,
  width: number,
  measure: (sample: string) => number,
): RichPiece[] {
  const chars = [...text]
  const pieces: RichPiece[] = []
  let line = 0
  let lineText = ''
  let buf = ''
  let bufColor = ''
  const flush = () => {
    if (!buf) return
    pieces.push({ text: buf, color: bufColor, x: measure(lineText), line })
    lineText += buf
    buf = ''
  }
  chars.forEach((ch, i) => {
    if (ch === '\n') {
      flush()
      line += 1
      lineText = ''
      return
    }
    const color = colors?.[i] || ''
    if (lineText + buf && measure(lineText + buf + ch) > width + 0.5) {
      flush()
      line += 1
      lineText = ''
    }
    if (buf && color !== bufColor) flush()
    bufColor = color
    buf += ch
  })
  flush()
  return pieces
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function markupToHtml(input: string): string {
  const chars = richChars(input)
  let html = ''
  let buf = ''
  let color = ''
  const flush = () => {
    if (!buf) return
    const body = escapeHtml(buf).replace(/\n/g, '<br>')
    html += color ? `<span style="color:${color}">${body}</span>` : body
    buf = ''
  }
  for (const c of chars) {
    const next = c.color ?? ''
    if (next !== color) flush()
    color = next
    buf += c.ch
  }
  flush()
  return html
}

function readColor(el: HTMLElement): string | null {
  const raw = el.style.color || el.getAttribute('color') || ''
  if (!raw) return null
  const rgb = raw.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i)
  const hex = rgb
    ? [rgb[1], rgb[2], rgb[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('')
    : raw.replace('#', '').trim()
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null
  return hex.toLowerCase() === '000000' ? null : `#${hex.toLowerCase()}`
}

/** 把色盤編輯器的 HTML 存回標記。黑色不寫進標記。 */
export function htmlToMarkup(root: HTMLElement): string {
  const parts: string[] = []
  const walk = (node: Node, color: string | null) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = (node.textContent ?? '').replace(/\u00a0/g, ' ')
      if (!t) return
      parts.push(color ? `{{#${color.slice(1)}}}${t}{{/}}` : t)
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return
    const el = node as HTMLElement
    if (el.tagName === 'BR') {
      parts.push('\n')
      return
    }
    const next = readColor(el) ?? color
    const block = el.tagName === 'DIV' || el.tagName === 'P'
    if (block && parts.length > 0 && !parts[parts.length - 1].endsWith('\n')) parts.push('\n')
    el.childNodes.forEach((child) => walk(child, next))
  }
  root.childNodes.forEach((child) => walk(child, null))
  return parts.join('')
}
