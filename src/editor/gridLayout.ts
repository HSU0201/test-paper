/**
 * 國字注音格：每一題是一個語詞，每個字一格（左邊國字方格、右邊注音欄），由上往下排成一直行。
 * 題目文字的右側注音標記決定這格要學生寫什麼：
 *   y（加上注音）：國字與注音都印出來
 *   yb（改成方格）：國字留白給學生寫，注音印出來
 *   yn（注音留白）：國字印出來，注音留白給學生寫
 *   沒有標記的國字：國字印出來，注音留白
 * 留白的內容會畫在答案圖層，只在匯出答案時出現。
 */
import { FIGURE_MARK } from '../types/exam'
import type { FlowRule, FlowRun, TextStyle } from './flowLayout'
import { inkAtoms, type RubyFace } from './richText'
import { splitRubyReading } from './rubyLayout'

export type GridCell = { han: string; reading: string; face: RubyFace }

export type GridMetrics = {
  /** 國字方格的邊長 */
  han: number
  /** 注音欄寬 */
  zcol: number
  cellW: number
  cellH: number
  /** 題號列高 */
  numH: number
  /** 語詞與語詞之間的空隙 */
  gap: number
}

export function gridMetrics(fontSize: number): GridMetrics {
  const han = Math.round(fontSize * 2.5)
  const zcol = Math.round(fontSize * 1.45)
  return {
    han,
    zcol,
    cellW: han + zcol,
    cellH: han,
    numH: Math.round(fontSize * 1.6),
    gap: Math.round(fontSize * 0.8),
  }
}

const SKIP = /[\s　，。、；：？！,.;:?!「」『』（）()]/

/** 題目文字 → 一格一格 */
export function gridCells(stem: string): GridCell[] {
  const cells: GridCell[] = []
  for (const atom of inkAtoms(stem.split(FIGURE_MARK).join(''))) {
    if (atom.kind === 'ruby') {
      cells.push({ han: atom.han, reading: atom.reading, face: atom.face })
      continue
    }
    for (const ch of atom.text) {
      if (!SKIP.test(ch)) cells.push({ han: ch, reading: '', face: 'blank' })
    }
  }
  return cells
}

export type GridBuilt = { width: number; height: number; runs: FlowRun[]; rules: FlowRule[] }

const LINE = '#111111'
const GUIDE = '#9ca3af'

/** 一個語詞的格子。座標從 (0, 0) 起算，題號在最上面 */
export function buildGridWord(stem: string, label: string, body: TextStyle, guide: boolean): GridBuilt {
  const g = gridMetrics(body.fontSize)
  const cells = gridCells(stem)
  const count = Math.max(1, cells.length)
  const top = g.numH
  const bottom = top + count * g.cellH
  const runs: FlowRun[] = []
  const rules: FlowRule[] = []
  const line = (key: string, x1: number, y1: number, x2: number, y2: number) =>
    rules.push({ key, x1, y1, x2, y2, stroke: LINE, strokeWidth: 1.2 })

  runs.push({
    key: 'num',
    x: 0,
    y: 0,
    width: g.cellW,
    text: label,
    style: { ...body, bold: false },
    lineHeight: g.numH / body.fontSize,
    align: 'center',
  })

  // 外框、國字與注音的分隔線、格與格之間的橫線
  line('grid-l', 0, top, 0, bottom)
  line('grid-r', g.cellW, top, g.cellW, bottom)
  line('grid-t', 0, top, g.cellW, top)
  line('grid-b', 0, bottom, g.cellW, bottom)
  line('grid-m', g.han, top, g.han, bottom)

  const hanSize = Math.round(g.han * 0.7)
  const zySize = Math.round(body.fontSize * 0.72)
  const pitch = zySize * 1.05

  cells.forEach((cell, i) => {
    const y = top + i * g.cellH
    if (i > 0) line(`grid-row-${i}`, 0, y, g.cellW, y)
    if (guide) {
      rules.push({ key: `guide-h-${i}`, x1: 2, y1: y + g.cellH / 2, x2: g.han - 2, y2: y + g.cellH / 2, stroke: GUIDE, strokeWidth: 0.8, dash: [3, 3] })
      rules.push({ key: `guide-v-${i}`, x1: g.han / 2, y1: y + 2, x2: g.han / 2, y2: y + g.cellH - 2, stroke: GUIDE, strokeWidth: 0.8, dash: [3, 3] })
    }

    const hideHan = cell.face === 'box' || cell.face === 'reading'
    const hideReading = cell.face === 'blank'
    runs.push({
      key: `han-${i}`,
      x: 0,
      y,
      width: g.han,
      text: cell.han,
      style: { ...body, fontSize: hanSize, bold: false },
      lineHeight: g.cellH / hanSize,
      align: 'center',
      answer: hideHan || undefined,
    })

    if (!cell.reading) return
    const { letters, tone } = splitRubyReading(cell.reading)
    // 輕聲寫在第一個注音上面，其他聲調寫在右邊
    const neutral = tone === '˙'
    const column = neutral ? [tone, ...letters] : letters
    const toneW = tone && !neutral ? zySize * 0.7 : 0
    const lettersW = zySize * 1.1
    const colX = g.han + (g.zcol - lettersW - toneW) / 2
    const stackH = column.length * pitch
    const colY = y + (g.cellH - stackH) / 2
    runs.push({
      key: `zy-${i}`,
      x: colX,
      y: colY,
      width: lettersW,
      text: column.join('\n'),
      style: { ...body, fontSize: zySize, bold: false },
      lineHeight: 1.05,
      align: 'center',
      answer: hideReading || undefined,
    })
    if (toneW) {
      // 聲調在最後一個注音的右上方
      runs.push({
        key: `tone-${i}`,
        x: colX + lettersW - zySize * 0.15,
        y: colY + stackH - pitch * (letters.length > 1 ? 1.45 : 1.2),
        width: toneW + zySize * 0.2,
        text: tone,
        style: { ...body, fontSize: zySize, bold: false },
        lineHeight: 1.05,
        align: 'left',
        answer: hideReading || undefined,
      })
    }
  })

  return { width: g.cellW, height: bottom + 2, runs, rules }
}
