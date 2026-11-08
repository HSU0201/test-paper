/**
 * 數學題常用的圖：時鐘、數線、方格。先畫成 SVG，再轉成 PNG 當題目附圖，
 * 匯出 PDF 和換電腦開檔都不會跑掉。
 */
import type { Asset } from '../types/exam'

const INK = '#111111'
const FONT = '"Microsoft JhengHei", "PingFang TC", "Noto Sans TC", sans-serif'

export type ClockOptions = {
  hour: number
  minute: number
  /** false：只畫鐘面，讓學生自己畫指針 */
  hands: boolean
  numbers: boolean
}

export function clockSvg(o: ClockOptions): { svg: string; width: number; height: number } {
  const size = 220
  const c = size / 2
  const r = c - 8
  const parts: string[] = [`<circle cx="${c}" cy="${c}" r="${r}" fill="#fff" stroke="${INK}" stroke-width="4"/>`]
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2
    const major = i % 5 === 0
    const r1 = r - (major ? 14 : 7)
    const x1 = c + Math.sin(a) * r1
    const y1 = c - Math.cos(a) * r1
    const x2 = c + Math.sin(a) * (r - 2)
    const y2 = c - Math.cos(a) * (r - 2)
    parts.push(
      `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${INK}" stroke-width="${major ? 3 : 1.4}" stroke-linecap="round"/>`,
    )
  }
  if (o.numbers) {
    for (let n = 1; n <= 12; n++) {
      const a = (n / 12) * Math.PI * 2
      const rr = r - 32
      parts.push(
        `<text x="${(c + Math.sin(a) * rr).toFixed(2)}" y="${(c - Math.cos(a) * rr).toFixed(2)}" font-size="22" font-family='${FONT}' text-anchor="middle" dominant-baseline="central" fill="${INK}">${n}</text>`,
      )
    }
  }
  if (o.hands) {
    const minute = ((o.minute % 60) + 60) % 60
    const hour = ((o.hour % 12) + 12) % 12
    const ma = (minute / 60) * Math.PI * 2
    const ha = ((hour + minute / 60) / 12) * Math.PI * 2
    const hand = (a: number, len: number, w: number) =>
      `<line x1="${c}" y1="${c}" x2="${(c + Math.sin(a) * len).toFixed(2)}" y2="${(c - Math.cos(a) * len).toFixed(2)}" stroke="${INK}" stroke-width="${w}" stroke-linecap="round"/>`
    parts.push(hand(ha, r * 0.5, 7), hand(ma, r * 0.78, 4))
  }
  parts.push(`<circle cx="${c}" cy="${c}" r="6" fill="${INK}"/>`)
  return { svg: wrapSvg(size, size, parts), width: size, height: size }
}

export type NumberLineOptions = {
  start: number
  end: number
  step: number
  /** 每幾個刻度寫一個數字。1 表示每個都寫 */
  labelEvery: number
  /** 這些刻度不寫數字，改畫（　）讓學生填 */
  blanks: number[]
}

function fmt(n: number): string {
  return String(Math.round(n * 1000) / 1000)
}

export function numberLineSvg(o: NumberLineOptions): { svg: string; width: number; height: number } | null {
  const step = Math.abs(o.step)
  if (!step || !Number.isFinite(o.start) || !Number.isFinite(o.end) || o.end <= o.start) return null
  const count = Math.round((o.end - o.start) / step)
  if (count < 1 || count > 60) return null
  const width = 640
  const height = 92
  const left = 28
  const right = width - 40
  const y = 34
  const unit = (right - left) / count
  const parts: string[] = [
    `<line x1="${left - 12}" y1="${y}" x2="${right + 22}" y2="${y}" stroke="${INK}" stroke-width="2.5"/>`,
    `<path d="M${right + 30} ${y} l-12 -7 v14 z" fill="${INK}"/>`,
  ]
  const blanks = new Set(o.blanks.map(fmt))
  const every = Math.max(1, Math.round(o.labelEvery))
  for (let i = 0; i <= count; i++) {
    const v = o.start + i * step
    const x = left + i * unit
    const major = i % every === 0
    parts.push(`<line x1="${x.toFixed(2)}" y1="${y - (major ? 11 : 7)}" x2="${x.toFixed(2)}" y2="${y + (major ? 11 : 7)}" stroke="${INK}" stroke-width="2"/>`)
    if (blanks.has(fmt(v))) {
      parts.push(`<text x="${x.toFixed(2)}" y="${y + 32}" font-size="20" font-family='${FONT}' text-anchor="middle" fill="${INK}">（　）</text>`)
    } else if (major) {
      parts.push(`<text x="${x.toFixed(2)}" y="${y + 32}" font-size="18" font-family='${FONT}' text-anchor="middle" fill="${INK}">${fmt(v)}</text>`)
    }
  }
  return { svg: wrapSvg(width, height, parts), width, height }
}

export type GridOptions = { rows: number; cols: number }

/** 直式計算用的方格 */
export function gridSvg(o: GridOptions): { svg: string; width: number; height: number } {
  const rows = Math.min(20, Math.max(1, Math.round(o.rows)))
  const cols = Math.min(20, Math.max(1, Math.round(o.cols)))
  const cell = 36
  const width = cols * cell + 4
  const height = rows * cell + 4
  const parts: string[] = []
  for (let r = 0; r <= rows; r++) {
    const edge = r === 0 || r === rows
    parts.push(`<line x1="2" y1="${2 + r * cell}" x2="${width - 2}" y2="${2 + r * cell}" stroke="${edge ? INK : '#555'}" stroke-width="${edge ? 2 : 1}"/>`)
  }
  for (let c = 0; c <= cols; c++) {
    const edge = c === 0 || c === cols
    parts.push(`<line x1="${2 + c * cell}" y1="2" x2="${2 + c * cell}" y2="${height - 2}" stroke="${edge ? INK : '#555'}" stroke-width="${edge ? 2 : 1}"/>`)
  }
  return { svg: wrapSvg(width, height, parts), width, height }
}

function wrapSvg(w: number, h: number, parts: string[]): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#fff"/>${parts.join('')}</svg>`
}

/** SVG 轉成 3 倍解析度的 PNG，印出來線條才清楚 */
export function svgToAsset(fig: { svg: string; width: number; height: number }, scale = 3): Promise<Asset> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(fig.width * scale)
      canvas.height = Math.round(fig.height * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('canvas'))
        return
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve({ src: canvas.toDataURL('image/png'), width: fig.width, height: fig.height })
    }
    img.onerror = () => reject(new Error('svg'))
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(fig.svg)}`
  })
}
