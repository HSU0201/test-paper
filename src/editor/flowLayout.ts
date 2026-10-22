import type { Box } from './bounds'
import {
  choiceLabel,
  isChoiceType,
  questionNumbers,
  sectionHeading,
  sectionScoreNote,
  type BlockRef,
  type ExamContent,
  type Question,
  type Section,
} from '../types/exam'

export type TextStyle = { fontSize: number; fill: string; bold?: boolean }

export type FlowStyles = {
  heading: TextStyle
  instruction: TextStyle
  body: TextStyle
  lineHeight: number
  questionGap: number
  sectionGap: number
}

/** 回傳文字在指定寬度下的高度，以及不換行時的寬度 */
export type MeasureFn = (text: string, width: number, style: TextStyle, lineHeight: number) => {
  height: number
  naturalWidth: number
}

export type FlowRun = {
  key: string
  x: number
  y: number
  width: number
  text: string
  style: TextStyle
}

export type FlowRule = { key: string; x1: number; y1: number; x2: number; y2: number }

export type PlacedBlock = {
  ref: BlockRef
  box: Box
  runs: FlowRun[]
  rules: FlowRule[]
}

export type FlowResult = {
  blocks: PlacedBlock[]
  /** 欄位放不下、尚未排入的區塊（第二階段改為自動分頁） */
  overflow: BlockRef[]
}

type Built = { height: number; runs: FlowRun[]; rules: FlowRule[] }

const EMPTY_STEM = '（請輸入題目）'

function buildSectionHead(s: Section, index: number, w: number, st: FlowStyles, m: MeasureFn): Built {
  const runs: FlowRun[] = []
  const title = `${sectionHeading(s, index)}${sectionScoreNote(s)}`
  const th = m(title, w, st.heading, st.lineHeight).height
  runs.push({ key: 'title', x: 0, y: 0, width: w, text: title, style: st.heading })
  let h = th
  if (s.instruction.trim()) {
    h += 2
    runs.push({ key: 'inst', x: 0, y: h, width: w, text: s.instruction, style: st.instruction })
    h += m(s.instruction, w, st.instruction, st.lineHeight).height
  }
  return { height: h + 6, runs, rules: [] }
}

function buildQuestion(q: Question, num: number, w: number, st: FlowStyles, m: MeasureFn): Built {
  const runs: FlowRun[] = []
  const rules: FlowRule[] = []
  const lh = st.body.fontSize * st.lineHeight
  const indent = Math.ceil(st.body.fontSize * 2)
  const innerW = Math.max(40, w - indent)
  const stem = q.stem.trim() || EMPTY_STEM

  runs.push({ key: 'num', x: 0, y: 0, width: indent, text: `${num}.`, style: st.body })
  runs.push({ key: 'stem', x: indent, y: 0, width: innerW, text: stem, style: st.body })
  let h = m(stem, innerW, st.body, st.lineHeight).height

  if (isChoiceType(q.type) && q.choices.length) {
    h += 4
    const labels = q.choices.map((c, i) => `${choiceLabel(i)} ${c.text.trim() || '　'}`)
    const widest = Math.max(...labels.map((t) => m(t, 10000, st.body, st.lineHeight).naturalWidth))
    let cols: number = q.choiceLayout === 'auto' ? 1 : q.choiceLayout
    if (q.choiceLayout === 'auto') {
      if (labels.length <= 4 && widest <= innerW / 4 - 8) cols = 4
      else if (widest <= innerW / 2 - 8) cols = 2
    }
    cols = Math.min(cols, labels.length)
    const cellW = innerW / cols
    for (let row = 0; row * cols < labels.length; row++) {
      let rowH = lh
      for (let c = 0; c < cols; c++) {
        const i = row * cols + c
        if (i >= labels.length) break
        runs.push({ key: `ch-${i}`, x: indent + c * cellW, y: h, width: cellW - 6, text: labels[i], style: st.body })
        rowH = Math.max(rowH, m(labels[i], cellW - 6, st.body, st.lineHeight).height)
      }
      h += rowH
    }
  }

  if (q.type === 'short_answer' && q.answerLines > 0) {
    h += 4
    for (let i = 0; i < q.answerLines; i++) {
      h += lh * 1.3
      rules.push({ key: `ans-${i}`, x1: indent, y1: h, x2: indent + innerW, y2: h })
    }
    h += 4
  }

  return { height: h, runs, rules }
}

type Item =
  | { kind: 'section'; section: Section; index: number }
  | { kind: 'question'; question: Question; num: number; firstOfSection: boolean }

/** 依閱讀順序把大題、小題放進欄位；大題標題至少與第一題同欄 */
export function layoutExam(exam: ExamContent, frames: Box[], st: FlowStyles, m: MeasureFn): FlowResult {
  const nums = questionNumbers(exam)
  const items: Item[] = []
  exam.sections.forEach((section, index) => {
    items.push({ kind: 'section', section, index })
    section.questions.forEach((question, qi) =>
      items.push({ kind: 'question', question, num: nums.get(question.id) ?? 0, firstOfSection: qi === 0 }),
    )
  })

  const build = (it: Item, w: number): Built =>
    it.kind === 'section'
      ? buildSectionHead(it.section, it.index, w, st, m)
      : buildQuestion(it.question, it.num, w, st, m)
  const gapBefore = (it: Item) =>
    it.kind === 'section' ? st.sectionGap : it.firstOfSection ? 0 : st.questionGap

  /** 大題標題後必須同欄的高度：整個大題（放得進空欄時）或第一題 */
  const keepHeight = (headIndex: number, frame: Box): number => {
    const head = items[headIndex]
    if (head.kind !== 'section') return 0
    const followers: Item[] = []
    for (let j = headIndex + 1; j < items.length && items[j].kind === 'question'; j++) followers.push(items[j])
    if (!followers.length) return 0
    const first = build(followers[0], frame.w).height
    if (head.section.keepTogether !== 'whole') return first
    const headH = build(head, frame.w).height
    const whole = followers.reduce((sum, f, k) => sum + build(f, frame.w).height + (k ? st.questionGap : 0), 0)
    return headH + whole <= frame.h ? whole : first
  }

  const blocks: PlacedBlock[] = []
  const overflow: BlockRef[] = []
  let fi = 0
  let y = frames[0]?.y ?? 0

  for (let i = 0; i < items.length; i++) {
    const it = items[i]
    const ref: BlockRef =
      it.kind === 'section' ? { kind: 'section', id: it.section.id } : { kind: 'question', id: it.question.id }
    const frame = frames[fi]
    if (!frame) {
      overflow.push(ref)
      continue
    }

    const atTop = y === frame.y
    let gap = atTop ? 0 : gapBefore(it)
    let built = build(it, frame.w)
    let need = gap + built.height
    if (it.kind === 'section') need += keepHeight(i, frame)

    if (!atTop && y + need > frame.y + frame.h) {
      fi += 1
      const nf = frames[fi]
      if (!nf) {
        overflow.push(ref)
        continue
      }
      y = nf.y
      gap = 0
      built = build(it, nf.w)
    }
    const f = frames[fi]
    y += gap
    blocks.push({
      ref,
      box: { x: f.x, y, w: f.w, h: built.height },
      runs: built.runs.map((r) => ({ ...r, x: r.x + f.x, y: r.y + y })),
      rules: built.rules.map((r) => ({ ...r, x1: r.x1 + f.x, x2: r.x2 + f.x, y1: r.y1 + y, y2: r.y2 + y })),
    })
    y += built.height
  }

  return { blocks, overflow }
}
