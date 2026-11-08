/** 答案表與雙向細目表的資料：每一題一列，再依單元 × 能力統計題數與配分 */
import {
  type ExamContent,
  QUESTION_LEVEL_LABEL,
  QUESTION_TYPE_LABEL,
  questionAnswerText,
  questionNumbers,
  questionPoints,
  sectionHeading,
} from '../types/exam'

export type QuestionRow = {
  id: string
  num: number
  sectionIndex: number
  section: string
  type: string
  points: number
  answer: string
  unit: string
  skill: string
  level: string
}

export const UNSET = '未填'

export function questionRows(exam: ExamContent): QuestionRow[] {
  const nums = questionNumbers(exam)
  return exam.sections.flatMap((s, si) =>
    s.questions.map((q) => ({
      id: q.id,
      num: nums.get(q.id) ?? 0,
      sectionIndex: si,
      section: sectionHeading(s, si),
      type: QUESTION_TYPE_LABEL[q.type],
      points: questionPoints(s, q),
      answer: questionAnswerText(q),
      unit: q.unit?.trim() || UNSET,
      skill: q.skill?.trim() || UNSET,
      level: q.level ? QUESTION_LEVEL_LABEL[q.level] : UNSET,
    })),
  )
}

export type Tally = { count: number; points: number }

export type CrossTable = {
  rows: string[]
  cols: string[]
  cell: (row: string, col: string) => Tally
  rowTotal: (row: string) => Tally
  colTotal: (col: string) => Tally
  total: Tally
}

const SKILL_ORDER = ['記憶', '理解', '應用', '分析', '評鑑', '創造']
const LEVEL_ORDER = ['易', '中', '難']

function ordered(values: string[], prefer: string[]): string[] {
  const set = [...new Set(values)]
  const rank = (v: string) => (v === UNSET ? 1e9 : prefer.includes(v) ? prefer.indexOf(v) : 1e6)
  return set.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b, 'zh-Hant'))
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000
}

/** 依兩個欄位交叉統計，例如單元 × 能力 */
export function crossTable(rows: QuestionRow[], rowKey: 'unit' | 'skill' | 'level', colKey: 'unit' | 'skill' | 'level'): CrossTable {
  const order = (key: 'unit' | 'skill' | 'level') => (key === 'skill' ? SKILL_ORDER : key === 'level' ? LEVEL_ORDER : [])
  const r = rowKey === 'unit' ? [...new Set(rows.map((x) => x.unit))] : ordered(rows.map((x) => x[rowKey]), order(rowKey))
  const c = ordered(
    rows.map((x) => x[colKey]),
    order(colKey),
  )
  const sum = (pick: (x: QuestionRow) => boolean): Tally => {
    const hit = rows.filter(pick)
    return { count: hit.length, points: round(hit.reduce((s, x) => s + x.points, 0)) }
  }
  return {
    rows: r,
    cols: c,
    cell: (row, col) => sum((x) => x[rowKey] === row && x[colKey] === col),
    rowTotal: (row) => sum((x) => x[rowKey] === row),
    colTotal: (col) => sum((x) => x[colKey] === col),
    total: sum(() => true),
  }
}

export function percent(part: number, whole: number): string {
  if (!whole) return '0%'
  return `${Math.round((part / whole) * 1000) / 10}%`
}

/** 有沒有填過任何細目。都沒填時提示老師先到各題填 */
export function hasBlueprintData(rows: QuestionRow[]): boolean {
  return rows.some((x) => x.unit !== UNSET || x.skill !== UNSET || x.level !== UNSET)
}

function csvCell(v: string | number): string {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Excel 可以直接開的 CSV（含 BOM，中文才不會亂碼） */
export function blueprintCsv(rows: QuestionRow[]): string {
  const lines: (string | number)[][] = [['題號', '大題', '題型', '配分', '單元／目標', '能力', '難易度', '答案']]
  for (const x of rows) lines.push([x.num, x.section, x.type, x.points, x.unit, x.skill, x.level, x.answer])
  lines.push([])
  const table = crossTable(rows, 'unit', 'skill')
  lines.push(['單元 \\ 能力', ...table.cols, '合計題數', '合計配分', '配分比例'])
  for (const row of table.rows) {
    const t = table.rowTotal(row)
    lines.push([
      row,
      ...table.cols.map((col) => {
        const c = table.cell(row, col)
        return c.count ? `${c.count}題／${c.points}分` : ''
      }),
      t.count,
      t.points,
      percent(t.points, table.total.points),
    ])
  }
  lines.push([])
  const levels = crossTable(rows, 'level', 'level')
  lines.push(['難易度', '題數', '配分', '配分比例'])
  for (const lv of levels.rows) {
    const t = levels.rowTotal(lv)
    lines.push([lv, t.count, t.points, percent(t.points, levels.total.points)])
  }
  return `﻿${lines.map((l) => l.map(csvCell).join(',')).join('\r\n')}`
}
