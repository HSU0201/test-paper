import type { Box } from './bounds'
import {
  choiceLabel,
  isChoiceType,
  questionNumbers,
  sectionHeading,
  sectionScoreNote,
  type Asset,
  type BlockRef,
  type ExamContent,
  type Question,
  type Section,
} from '../types/exam'
import type { SpacingSettings } from '../types/layout'

export type TextStyle = { fontSize: number; fill: string; bold?: boolean }

export type FlowStyles = {
  heading: TextStyle
  instruction: TextStyle
  body: TextStyle
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
  lineHeight: number
  placeholder?: boolean
}

export type FlowRule = { key: string; x1: number; y1: number; x2: number; y2: number }

export type FlowImage = { key: string; x: number; y: number; w: number; h: number; assetId: string }

export type PlacedBlock = {
  ref: BlockRef
  page: number
  frame: number
  box: Box
  runs: FlowRun[]
  rules: FlowRule[]
  images: FlowImage[]
}

export type FrameRef = { page: number; frame: number }

export type LayoutWarning =
  | { type: 'squeezed'; level: number; lineHeight: number; savedPages: number }
  | { type: 'headMoved'; sectionId: string; from: FrameRef; to: FrameRef }
  | { type: 'oversize'; ref: BlockRef; page: number }

export type FlowResult = {
  blocks: PlacedBlock[]
  pageCount: number
  /** 實際採用的壓縮程度（0 = 未壓縮，1 = 壓到下限） */
  squeeze: number
  lineHeight: number
  warnings: LayoutWarning[]
}

/** 每次壓縮的級距；分級可讓結果穩定、量測可快取 */
const SQUEEZE_LEVELS = [0, 0.25, 0.5, 0.75, 1]
const MAX_PAGES = 60
const EMPTY_STEM = '（請輸入題目）'

type Metrics = { lineHeight: number; questionGap: number; sectionGap: number }

function metricsAt(sp: SpacingSettings, t: number): Metrics {
  const lerp = (r: { nominal: number; min: number }) => r.nominal - (r.nominal - r.min) * t
  return {
    lineHeight: Math.round(lerp(sp.lineHeight) * 100) / 100,
    questionGap: lerp(sp.questionGap),
    sectionGap: lerp(sp.sectionGap),
  }
}

type Built = { height: number; runs: FlowRun[]; rules: FlowRule[]; images: FlowImage[] }

type Ctx = { st: FlowStyles; m: MeasureFn; mt: Metrics; assets: Record<string, Asset> }

function buildSectionHead(s: Section, index: number, w: number, c: Ctx): Built {
  const { st, m, mt } = c
  const runs: FlowRun[] = []
  const title = `${sectionHeading(s, index)}${sectionScoreNote(s)}`
  runs.push({ key: 'title', x: 0, y: 0, width: w, text: title, style: st.heading, lineHeight: mt.lineHeight })
  let h = m(title, w, st.heading, mt.lineHeight).height
  if (s.instruction.trim()) {
    h += 2
    runs.push({ key: 'inst', x: 0, y: h, width: w, text: s.instruction, style: st.instruction, lineHeight: mt.lineHeight })
    h += m(s.instruction, w, st.instruction, mt.lineHeight).height
  }
  return { height: h + 4, runs, rules: [], images: [] }
}

function figureSize(c: Ctx, assetId: string, maxW: number, ratio: number) {
  const a = c.assets[assetId]
  if (!a) return null
  const w = Math.max(24, Math.min(maxW, maxW * ratio))
  return { w, h: (w * a.height) / Math.max(1, a.width) }
}

function buildQuestion(q: Question, num: number, w: number, c: Ctx): Built {
  const { st, m, mt } = c
  const runs: FlowRun[] = []
  const rules: FlowRule[] = []
  const images: FlowImage[] = []
  const lh = st.body.fontSize * mt.lineHeight
  const indent = Math.ceil(st.body.fontSize * 2)
  const innerW = Math.max(40, w - indent)
  const stem = q.stem.trim() || EMPTY_STEM

  const right = q.figures.find((f) => f.placement === 'right')
  const below = q.figures.filter((f) => f !== right && f.placement !== 'afterChoices')
  const after = q.figures.filter((f) => f !== right && f.placement === 'afterChoices')

  runs.push({ key: 'num', x: 0, y: 0, width: indent, text: `${num}.`, style: st.body, lineHeight: mt.lineHeight })

  let stemW = innerW
  let rightBox: { w: number; h: number } | null = null
  if (right) {
    rightBox = figureSize(c, right.assetId, innerW * 0.6, right.widthRatio)
    if (rightBox) {
      stemW = Math.max(60, innerW - rightBox.w - 10)
      images.push({ key: right.id, x: indent + innerW - rightBox.w, y: 2, w: rightBox.w, h: rightBox.h, assetId: right.assetId })
    }
  }
  runs.push({
    key: 'stem',
    x: indent,
    y: 0,
    width: stemW,
    text: stem,
    style: st.body,
    lineHeight: mt.lineHeight,
    placeholder: !q.stem.trim(),
  })
  let h = m(stem, stemW, st.body, mt.lineHeight).height
  if (rightBox) h = Math.max(h, rightBox.h + 4)

  const pushFigures = (list: typeof below) => {
    for (const f of list) {
      const size = figureSize(c, f.assetId, innerW, f.widthRatio)
      if (!size) continue
      h += 6
      images.push({ key: f.id, x: indent + (innerW - size.w) / 2, y: h, w: size.w, h: size.h, assetId: f.assetId })
      h += size.h
    }
    if (list.length) h += 2
  }
  pushFigures(below)

  if (isChoiceType(q.type) && q.choices.length) {
    h += 4
    const labels = q.choices.map((ch, i) => `${choiceLabel(i)} ${ch.text.trim() || '　'}`)
    const widest = Math.max(...labels.map((t) => m(t, 10000, st.body, mt.lineHeight).naturalWidth))
    let cols: number = q.choiceLayout === 'auto' ? 1 : q.choiceLayout
    if (q.choiceLayout === 'auto') {
      if (labels.length <= 4 && widest <= innerW / 4 - 8) cols = 4
      else if (widest <= innerW / 2 - 8) cols = 2
    }
    cols = Math.min(cols, labels.length)
    const cellW = innerW / cols
    for (let row = 0; row * cols < labels.length; row++) {
      let rowH = lh
      for (let k = 0; k < cols; k++) {
        const i = row * cols + k
        if (i >= labels.length) break
        runs.push({
          key: `ch-${i}`,
          x: indent + k * cellW,
          y: h,
          width: cellW - 6,
          text: labels[i],
          style: st.body,
          lineHeight: mt.lineHeight,
        })
        rowH = Math.max(rowH, m(labels[i], cellW - 6, st.body, mt.lineHeight).height)
      }
      h += rowH
    }
  }
  pushFigures(after)

  if (q.type === 'short_answer' && q.answerLines > 0) {
    h += 4
    for (let i = 0; i < q.answerLines; i++) {
      h += lh * 1.25
      rules.push({ key: `ans-${i}`, x1: indent, y1: h, x2: indent + innerW, y2: h })
    }
    h += 4
  }

  return { height: h, runs, rules, images }
}

type Item =
  | { kind: 'section'; section: Section; index: number }
  | { kind: 'question'; question: Question; num: number; firstOfSection: boolean }

function itemRef(it: Item): BlockRef {
  return it.kind === 'section' ? { kind: 'section', id: it.section.id } : { kind: 'question', id: it.question.id }
}

type PaginateResult = Omit<FlowResult, 'squeeze' | 'lineHeight'> & { headMoves: number }

function paginate(items: Item[], getFrames: (page: number) => Box[], c: Ctx): PaginateResult {
  const build = (it: Item, w: number): Built =>
    it.kind === 'section' ? buildSectionHead(it.section, it.index, w, c) : buildQuestion(it.question, it.num, w, c)
  const gapBefore = (it: Item) =>
    it.kind === 'section' ? c.mt.sectionGap : it.firstOfSection ? 0 : c.mt.questionGap

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
    const whole = followers.reduce((sum, f, k) => sum + build(f, frame.w).height + (k ? c.mt.questionGap : 0), 0)
    return headH + whole <= frame.h ? whole : first
  }

  const blocks: PlacedBlock[] = []
  const warnings: LayoutWarning[] = []
  let headMoves = 0
  let page = 0
  let frames = getFrames(0)
  let fi = 0
  let y = frames[0].y

  const nextFrame = () => {
    fi += 1
    if (fi >= frames.length && page < MAX_PAGES - 1) {
      page += 1
      frames = getFrames(page)
      fi = 0
    }
    fi = Math.min(fi, frames.length - 1)
    y = frames[fi].y
  }

  for (let i = 0; i < items.length; i++) {
    const it = items[i]
    const ref = itemRef(it)
    let frame = frames[fi]
    let atTop = y === frame.y
    let gap = atTop ? 0 : gapBefore(it)
    let built = build(it, frame.w)
    const bottom = frame.y + frame.h

    if (!atTop) {
      const keep = it.kind === 'section' ? keepHeight(i, frame) : 0
      const fitsAlone = y + gap + built.height <= bottom
      if (y + gap + built.height + keep > bottom) {
        const from = { page, frame: fi }
        nextFrame()
        if (it.kind === 'section' && fitsAlone) {
          headMoves += 1
          warnings.push({ type: 'headMoved', sectionId: it.section.id, from, to: { page, frame: fi } })
        }
        frame = frames[fi]
        atTop = true
        gap = 0
        built = build(it, frame.w)
      }
    }
    if (atTop && built.height > frame.h) warnings.push({ type: 'oversize', ref, page })

    y += gap
    blocks.push({
      ref,
      page,
      frame: fi,
      box: { x: frame.x, y, w: frame.w, h: built.height },
      runs: built.runs.map((r) => ({ ...r, x: r.x + frame.x, y: r.y + y })),
      rules: built.rules.map((r) => ({ ...r, x1: r.x1 + frame.x, x2: r.x2 + frame.x, y1: r.y1 + y, y2: r.y2 + y })),
      images: built.images.map((im) => ({ ...im, x: im.x + frame.x, y: im.y + y })),
    })
    y += built.height
  }

  return { blocks, pageCount: page + 1, warnings, headMoves }
}

/**
 * 排版流程：
 * 1. 以原始行距、間距排一次。
 * 2. 允許壓縮時，依級距逐步縮小行距與間距再排，若能減少頁數或減少「標題被推到下一欄」的次數，
 *    就採用能達到最佳結果的最小壓縮程度（第一優先：擠進目前頁面）。
 * 3. 仍放不下時，大題標題連同第一題（或整個大題）移到下一欄／下一頁（第二優先：防孤立標題）。
 */
export function layoutExam(
  exam: ExamContent,
  getFrames: (page: number) => Box[],
  st: FlowStyles,
  spacing: SpacingSettings,
  m: MeasureFn,
): FlowResult {
  const nums = questionNumbers(exam)
  const items: Item[] = []
  exam.sections.forEach((section, index) => {
    items.push({ kind: 'section', section, index })
    section.questions.forEach((question, qi) =>
      items.push({ kind: 'question', question, num: nums.get(question.id) ?? 0, firstOfSection: qi === 0 }),
    )
  })

  const run = (t: number) => {
    const mt = metricsAt(spacing, t)
    return { t, mt, r: paginate(items, getFrames, { st, m, mt, assets: exam.assets }) }
  }
  const score = (r: PaginateResult) => r.pageCount * 1000 + r.headMoves

  const base = run(0)
  let best = base
  if (spacing.allowSqueeze && items.length) {
    for (const t of SQUEEZE_LEVELS.slice(1)) {
      const cand = run(t)
      if (score(cand.r) < score(best.r)) best = cand
    }
  }

  const warnings = [...best.r.warnings]
  if (best.t > 0) {
    warnings.unshift({
      type: 'squeezed',
      level: best.t,
      lineHeight: best.mt.lineHeight,
      savedPages: base.r.pageCount - best.r.pageCount,
    })
  }
  return {
    blocks: best.r.blocks,
    pageCount: best.r.pageCount,
    squeeze: best.t,
    lineHeight: best.mt.lineHeight,
    warnings,
  }
}
