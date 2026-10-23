import type { Box } from './bounds'
import {
  choiceLabel,
  hasFigureMark,
  isChoiceType,
  planStemFigures,
  questionNumbers,
  asideLeftEdge,
  questionAsideWidth,
  questionRowLines,
  questionScoreMark,
  sectionRowSize,
  sectionHeading,
  sectionScoreNote,
  toChineseNumeral,
  type Asset,
  type BlockRef,
  FOOTER_CONTINUE_ID,
  FOOTER_END_ID,
  footerOf,
  type ExamContent,
  type Figure,
  type FontOverride,
  type NumberStyle,
  type Question,
  type Section,
} from '../types/exam'
import { toVerticalGlyph, type SpacingSettings } from '../types/layout'
import { layoutRubyRun, type InkPiece } from './rubyLayout'
import { hasRubyMarkup, paintText, plainText, richChars } from './richText'
import { clusterUnits, needsManualWrap, textAtoms } from './zhuyin'

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
  /** 直排：每個字一行，由上往下，下一欄在左側 */
  vertical?: boolean
  /** 與 text 的每個字對應；空字串表示用 style.fill（黑色）。直排時不含換行。 */
  colors?: string[]
  height?: number
  /** 直排題號佔用的前幾個字，不計入文中插入位置 */
  stemFrom?: number
  /** 已依欄寬切成單行時為 1，拖曳用這個行數，不再用高度反推 */
  lineCount?: number
  align?: 'left' | 'center' | 'right'
  /** 國字右側注音。有這欄時不再把 text 交給一般文字框 */
  ink?: InkPiece[]
  inkStep?: number
}

export type FlowRule = {
  key: string
  x1: number
  y1: number
  x2: number
  y2: number
  stroke?: string
  strokeWidth?: number
}

/** 跨過好幾個題塊的外框，例如整題框線、直式表格 */
export type FlowFrame = {
  key: string
  page: number
  x: number
  y: number
  w: number
  h: number
  rules: FlowRule[]
}

export type FlowImage = {
  key: string
  x: number
  y: number
  w: number
  h: number
  assetId: string
  /** 卷面上可拖曳，用來改插在題幹的哪一行後面 */
  movable?: boolean
  /** middle 用 afterLine；below / after 拖到題幹中間才改成文中 */
  anchor?: 'middle' | 'below' | 'after'
  afterLine?: number
}

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
  frames: FlowFrame[]
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
const FRAME_PAD = 10
const BOX_STROKE = '#111111'

function resolveStyle(base: TextStyle, over?: FontOverride): TextStyle {
  if (!over || (over.fontSize == null && over.bold == null)) return base
  const fontSize = over.fontSize == null ? base.fontSize : Math.min(72, Math.max(8, Math.round(over.fontSize)))
  const bold = over.bold ?? !!base.bold
  if (fontSize === base.fontSize && bold === !!base.bold) return base
  return { fontSize, fill: base.fill, bold }
}

function sameStyle(a: TextStyle, b: TextStyle) {
  return a.fontSize === b.fontSize && a.fill === b.fill && !!a.bold === !!b.bold
}

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

function insetBuilt(built: Built, pad: number): Built {
  if (pad <= 0) return built
  return {
    height: built.height + pad * 2,
    runs: built.runs.map((r) => ({ ...r, x: r.x + pad, y: r.y + pad })),
    rules: built.rules.map((r) => ({ ...r, x1: r.x1 + pad, y1: r.y1 + pad, x2: r.x2 + pad, y2: r.y2 + pad })),
    images: built.images.map((im) => ({ ...im, x: im.x + pad, y: im.y + pad })),
  }
}

function boxRules(w: number, h: number): FlowRule[] {
  return [
    { key: 'box-t', x1: 0, y1: 0.5, x2: w, y2: 0.5, stroke: BOX_STROKE, strokeWidth: 1.25 },
    { key: 'box-b', x1: 0, y1: h - 0.5, x2: w, y2: h - 0.5, stroke: BOX_STROKE, strokeWidth: 1.25 },
    { key: 'box-l', x1: 0.5, y1: 0, x2: 0.5, y2: h, stroke: BOX_STROKE, strokeWidth: 1.25 },
    { key: 'box-r', x1: w - 0.5, y1: 0, x2: w - 0.5, y2: h, stroke: BOX_STROKE, strokeWidth: 1.25 },
  ]
}

function buildNotice(text: string, w: number, c: Ctx): Built {
  const body = { ...c.st.body, bold: true }
  const raw = text.trim()
  const painted = paintText(raw || '（請輸入提示）')
  const padX = 12
  const inner = Math.max(40, w - padX * 2)
  const textH = runHeight(painted.text, inner, body, c.mt.lineHeight, c.m)
  const height = Math.max(textH + 28, Math.round(body.fontSize * c.mt.lineHeight * 2.4))
  return {
    height,
    runs: [
      {
        key: 'text',
        x: padX,
        y: (height - textH) / 2,
        width: inner,
        height: textH,
        text: painted.text,
        colors: raw ? painted.colors : undefined,
        style: body,
        lineHeight: c.mt.lineHeight,
        align: 'center',
        placeholder: raw ? undefined : true,
      },
    ],
    rules: boxRules(w, height),
    images: [],
  }
}

function buildSectionHead(s: Section, index: number, w: number, c: Ctx): Built {
  const { st, m, mt } = c
  const heading = resolveStyle(st.heading, s.headingStyle)
  const instruction = resolveStyle(st.instruction, s.instructionStyle)
  const runs: FlowRun[] = []
  const title = paintText(`${toChineseNumeral(index + 1)}、${s.title}${sectionScoreNote(s)}`)
  runs.push({ key: 'title', x: 0, y: 0, width: w, text: title.text, colors: title.colors, style: heading, lineHeight: mt.lineHeight })
  let h = runHeight(title.text, w, heading, mt.lineHeight, m)
  if (plainText(s.instruction).trim()) {
    h += 2
    const inst = paintText(s.instruction)
    runs.push({ key: 'inst', x: 0, y: h, width: w, text: inst.text, colors: inst.colors, style: instruction, lineHeight: mt.lineHeight })
    h += runHeight(inst.text, w, instruction, mt.lineHeight, m)
  }
  return { height: h + 4, runs, rules: [], images: [] }
}

function figureSize(c: Ctx, assetId: string, maxW: number, ratio: number) {
  const a = c.assets[assetId]
  if (!a) return null
  const w = Math.max(24, Math.min(maxW, maxW * ratio))
  return { w, h: (w * a.height) / Math.max(1, a.width) }
}

/** 0 靠左、1 靠右。文字中間預設靠左，其餘預設置中 */
function figureAlignRatio(f: Figure): number {
  if (typeof f.align === 'number' && Number.isFinite(f.align)) return Math.min(1, Math.max(0, f.align))
  return f.placement === 'middle' ? 0 : 0.5
}

function figureX(indent: number, innerW: number, w: number, align: number) {
  return indent + Math.max(0, innerW - w) * align
}

/** 依字元寬度切開，換行結果用來決定圖片可以接在第幾行後面。有注音時以音節為單位。 */
function wrapLines(text: string, width: number, style: TextStyle, lineHeight: number, m: MeasureFn): string[] {
  if (!text) return []
  const widthOf = (sample: string) => (sample ? m(sample, 10000, style, lineHeight).naturalWidth : 0)
  const lines: string[] = []
  let buf = ''
  for (const atom of textAtoms(text)) {
    if (atom === '\n') {
      lines.push(buf)
      buf = ''
      continue
    }
    if (buf && widthOf(buf + atom) > width + 0.5) {
      lines.push(buf)
      buf = atom
    } else buf += atom
  }
  if (buf || lines.length === 0) lines.push(buf)
  return lines
}

/** 沒有注音、也沒有作答空格時，沿用 Konva 量高，避免既有試卷行高變動。 */
function runHeight(text: string, width: number, style: TextStyle, lineHeight: number, m: MeasureFn): number {
  if (!needsManualWrap(text)) return m(text, width, style, lineHeight).height
  const lines = wrapLines(text, width, style, lineHeight, m)
  return Math.max(1, lines.length) * style.fontSize * lineHeight
}

function stripMarks(stem: string) {
  return stem.replace(/[\[［]\s*圖\s*[\]］]/g, '')
}

/** 配分接在題目最後，並先收掉題幹裡還沒關的上色，避免分數被塗成同一色。 */
function stemWithScore(stem: string, scoreMark: string): string {
  if (!scoreMark) return stem
  return stem ? `${stem}{{/}}${scoreMark}` : stem
}

function buildQuestion(
  q: Question,
  num: number,
  scoreMark: string,
  indent: number,
  w: number,
  c: Ctx,
  ruled: boolean,
  reserveAnswers: boolean,
): Built {
  const { m, mt } = c
  const body = resolveStyle(c.st.body, q.bodyStyle)
  const runs: FlowRun[] = []
  const rules: FlowRule[] = []
  const images: FlowImage[] = []
  const lh = body.fontSize * mt.lineHeight
  const prefix = `${num}.`
  const innerW = Math.max(40, w - indent)
  const rawStem = q.stem.trim()
  const scoredStem = stemWithScore(rawStem, scoreMark)

  const right = q.figures.find((f) => f.placement === 'right')
  const middle = q.figures.filter((f) => f.placement === 'middle')
  const after = q.figures.filter((f) => f.placement === 'afterChoices')
  const below = q.figures.filter((f) => f !== right && f.placement !== 'middle' && f.placement !== 'afterChoices')

  runs.push({ key: 'num', x: 0, y: 0, width: indent, text: prefix, style: body, lineHeight: mt.lineHeight })

  let stemW = innerW
  let rightBox: { w: number; h: number } | null = null
  if (right) {
    rightBox = figureSize(c, right.assetId, innerW * 0.6, right.widthRatio)
    if (rightBox) {
      stemW = Math.max(60, innerW - rightBox.w - 10)
      images.push({ key: right.id, x: indent + innerW - rightBox.w, y: 2, w: rightBox.w, h: rightBox.h, assetId: right.assetId })
    }
  }

  const pushStem = (text: string, key: string, y: number, placeholder = false, colors?: string[], singleLine = false) => {
    if (!placeholder && !colors && hasRubyMarkup(text)) {
      const laid = layoutRubyRun(text, stemW, body.fontSize, mt.lineHeight, (sample) =>
        m(sample, 10000, body, mt.lineHeight).naturalWidth,
      )
      runs.push({
        key,
        x: indent,
        y,
        width: stemW,
        height: laid.height,
        text: plainText(text),
        style: body,
        lineHeight: mt.lineHeight,
        ink: laid.pieces,
        inkStep: laid.step,
        lineCount: laid.lineCount,
      })
      return laid.height
    }
    const painted = placeholder ? { text, colors: undefined as string[] | undefined } : paintText(text)
    const height = runHeight(painted.text, stemW, body, mt.lineHeight, m)
    runs.push({
      key,
      x: indent,
      y,
      width: stemW,
      height,
      text: colors ? text : painted.text,
      colors: colors ?? painted.colors,
      style: body,
      lineHeight: mt.lineHeight,
      placeholder,
      lineCount: singleLine ? 1 : undefined,
    })
    return height
  }

  const pushFigures = (list: Figure[], y: number, anchor?: 'middle' | 'below' | 'after') => {
    let cursor = y
    for (const f of list) {
      const size = figureSize(c, f.assetId, innerW, f.widthRatio)
      if (!size) continue
      cursor += 6
      images.push({
        key: f.id,
        x: figureX(indent, innerW, size.w, figureAlignRatio(f)),
        y: cursor,
        w: size.w,
        h: size.h,
        assetId: f.assetId,
        movable: anchor ? true : undefined,
        anchor,
        afterLine: anchor === 'middle' ? f.afterLine : undefined,
      })
      cursor += size.h
    }
    if (list.length) cursor += 2
    return cursor
  }

  let h = 0
  const layoutAnchored = (list: Figure[]) => {
    const raw = stripMarks(scoredStem)
    const painted = paintText(raw)
    const pieces = wrapLines(painted.text, stemW, body, mt.lineHeight, m)
    const atOf = (f: Figure) => Math.max(0, Math.min(pieces.length, f.afterLine ?? 1))
    const placeAt = (index: number) => {
      const batch = list.filter((f) => atOf(f) === index)
      if (batch.length) h = pushFigures(batch, h, 'middle')
    }
    let char = 0
    let lineNo = 0
    placeAt(0)
    for (const line of pieces) {
      while (painted.text[char] === '\n') char += 1
      const start = char
      char += line.length
      if (!line) continue
      const colors = painted.colors?.slice(start, char)
      h += pushStem(line, lineNo === 0 ? 'stem' : `stem-${lineNo}`, h, false, colors, true)
      lineNo += 1
      placeAt(lineNo)
    }
  }

  const anchored = !hasFigureMark(q.stem) && middle.some((f) => typeof f.afterLine === 'number')
  if (!rawStem) {
    const before = anchored ? middle.filter((f) => (f.afterLine ?? 1) <= 0) : []
    const rest = anchored ? middle.filter((f) => (f.afterLine ?? 1) > 0) : middle
    if (before.length) h = pushFigures(before, h, 'middle')
    h += pushStem(EMPTY_STEM, 'stem', h, true)
    h = pushFigures(rest, h, 'middle')
    if (scoreMark) h += pushStem(scoreMark, 'score', h)
  } else if (anchored && !hasRubyMarkup(q.stem)) {
    layoutAnchored(middle)
  } else {
    const plan = planStemFigures(scoredStem, middle.length)
    let figAt = 0
    plan.parts.forEach((part, i) => {
      if (part) h += pushStem(part, i === 0 ? 'stem' : `stem-${i}`, h)
      const batch = middle.slice(figAt, figAt + plan.slots[i])
      figAt += plan.slots[i]
      if (batch.length) h = pushFigures(batch, h, 'middle')
    })
  }
  if (rightBox) h = Math.max(h, rightBox.h + 4)
  h = pushFigures(below, h, 'below')

  if (isChoiceType(q.type) && q.choices.length) {
    h += 4
    const hasImage = (ch: Question['choices'][number]) => !!(ch.image && c.assets[ch.image.assetId])
    const labels = q.choices.map((ch, i) =>
      plainText(ch.text).trim()
        ? paintText(`${choiceLabel(i)} ${ch.text.trim()}`)
        : paintText(hasImage(ch) ? choiceLabel(i) : `${choiceLabel(i)} \u3000`),
    )
    const anyImage = q.choices.some(hasImage)
    const widest = Math.max(...labels.map((t) => m(t.text, 10000, body, mt.lineHeight).naturalWidth))
    let cols: number = q.choiceLayout === 'auto' ? 1 : q.choiceLayout
    if (q.choiceLayout === 'auto') {
      if (anyImage) cols = labels.length <= 4 && innerW / 4 >= 110 ? 4 : 2
      else if (labels.length <= 4 && widest <= innerW / 4 - 8) cols = 4
      else if (widest <= innerW / 2 - 8) cols = 2
    }
    cols = Math.min(cols, labels.length)
    const cellW = innerW / cols
    for (let row = 0; row * cols < labels.length; row++) {
      let rowH = lh
      for (let k = 0; k < cols; k++) {
        const i = row * cols + k
        if (i >= labels.length) break
        const ch = q.choices[i]
        const x = indent + k * cellW
        const textW = cellW - 6
        runs.push({
          key: `ch-${i}`,
          x,
          y: h,
          width: textW,
          text: labels[i].text,
          colors: labels[i].colors,
          style: body,
          lineHeight: mt.lineHeight,
        })
        let cellH = runHeight(labels[i].text, textW, body, mt.lineHeight, m)
        if (ch.image && hasImage(ch)) {
          const inline = !plainText(ch.text).trim()
          const labelW = m(`${choiceLabel(i)} `, 10000, body, mt.lineHeight).naturalWidth
          const maxW = inline ? Math.max(24, textW - labelW) : textW
          const size = figureSize(c, ch.image.assetId, maxW, ch.image.widthRatio)
          if (size) {
            const iy = inline ? 2 : cellH + 2
            images.push({
              key: `chimg-${ch.id}`,
              x: inline ? x + labelW : x,
              y: h + iy,
              w: size.w,
              h: size.h,
              assetId: ch.image.assetId,
            })
            cellH = Math.max(cellH, iy + size.h + 4)
          }
        }
        rowH = Math.max(rowH, cellH)
      }
      h += rowH
    }
  }
  h = pushFigures(after, h, 'after')

  if (reserveAnswers && q.type === 'short_answer' && q.answerLines > 0) {
    h += 4
    for (let i = 0; i < q.answerLines; i++) {
      h += lh * 1.25
      if (ruled) rules.push({ key: `ans-${i}`, x1: indent, y1: h, x2: indent + innerW, y2: h })
    }
    h += 4
  }

  return { height: h, runs, rules, images }
}

type Item =
  | { kind: 'section'; section: Section; index: number }
  | { kind: 'question'; question: Question; section: Section; num: number; firstOfSection: boolean; scoreMark: string }
  | { kind: 'notice'; id: string; text: string }

function formatNum(n: number, style: NumberStyle): string {
  return style === 'paren' ? `(${n})` : `${n}.`
}

function questionLead(it: Extract<Item, { kind: 'question' }>): string {
  return formatNum(it.num, it.section.numberStyle)
}

/** 題幹對齊在題號後面。配分寫在題目最後，不佔題號的寬度。 */
function questionIndents(items: Item[], c: Ctx): Map<string, number> {
  const map = new Map<string, number>()
  for (const it of items) {
    if (it.kind !== 'question') continue
    const body = resolveStyle(c.st.body, it.question.bodyStyle)
    map.set(it.question.id, Math.ceil(body.fontSize * 2))
  }
  return map
}

function itemRef(it: Item): BlockRef {
  if (it.kind === 'section') return { kind: 'section', id: it.section.id }
  if (it.kind === 'notice') return { kind: 'notice', id: it.id }
  return { kind: 'question', id: it.question.id }
}

/** 並排時，一般排列的題與題之間留空隙；直式表格貼齊，靠分隔線切開 */
const PAIR_GAP = 16

function pairGutter(it: Item): number {
  return it.kind === 'question' && it.section.layout === 'rows' ? 0 : PAIR_GAP
}

type Chrome = { pad: number; aside: string; asideWidth: number; minH: number; ruled: boolean }

function questionChrome(section: Section, q: Question, c: Ctx): Chrome {
  const body = resolveStyle(c.st.body, q.bodyStyle)
  const lh = body.fontSize * c.mt.lineHeight
  const rows = section.layout === 'rows'
  const boxed = section.frame === 'body' || section.frame === 'all' || rows
  const pad = boxed ? FRAME_PAD : 0
  const lines = questionRowLines(section, q)
  return {
    pad,
    aside: rows ? (q.aside ?? '').trim() : '',
    asideWidth: questionAsideWidth(q),
    minH: rows ? Math.round(Math.max(2, lines) * lh + pad * 2) : 0,
    ruled: q.answerRuled !== false && !rows,
  }
}

type PaginateResult = Omit<FlowResult, 'squeeze' | 'lineHeight' | 'frames'> & { headMoves: number }

function paginate(items: Item[], getFrames: (page: number) => Box[], c: Ctx): PaginateResult {
  const indents = questionIndents(items, c)
  const build = (it: Item, w: number): Built => {
    if (it.kind === 'notice') return buildNotice(it.text, w, c)
    if (it.kind === 'section') {
      const pad = it.section.frame === 'all' ? FRAME_PAD : 0
      return insetBuilt(buildSectionHead(it.section, it.index, Math.max(40, w - pad * 2), c), pad)
    }
    const chrome = questionChrome(it.section, it.question, c)
    const inner = Math.max(40, w - chrome.pad * 2)
    const left = chrome.aside ? asideLeftEdge(inner, chrome.asideWidth) : inner
    const stemW = chrome.aside ? Math.max(40, left - 8) : left
    const indent = indents.get(it.question.id) ?? Math.ceil(c.st.body.fontSize * 2)
    let built = insetBuilt(
      buildQuestion(it.question, it.num, it.scoreMark, indent, stemW, c, chrome.ruled, it.section.layout !== 'rows'),
      chrome.pad,
    )
    if (chrome.aside) {
      const body = resolveStyle(c.st.body, it.question.bodyStyle)
      const ax = chrome.pad + left + 6
      const painted = paintText(chrome.aside)
      built.runs.push({
        key: 'aside',
        x: ax,
        y: chrome.pad,
        width: Math.max(24, w - chrome.pad - ax),
        text: painted.text,
        colors: painted.colors,
        style: body,
        lineHeight: c.mt.lineHeight,
      })
    }
    if (chrome.minH > built.height) built = { ...built, height: chrome.minH }
    return built
  }
  const gapBefore = (it: Item) => {
    if (it.kind === 'notice') return c.mt.questionGap
    if (it.kind === 'section') return c.mt.sectionGap
    if (it.section.layout === 'rows') return it.firstOfSection ? 8 : 0
    return it.firstOfSection ? 0 : c.mt.questionGap
  }

  /** 從這一題開始，同一列要放的題。只在每一列的第一題呼叫 */
  const rowAt = (index: number): Item[] => {
    const it = items[index]
    if (!it || it.kind !== 'question') return it ? [it] : []
    const size = sectionRowSize(it.section)
    const limit = size === 'all' ? Number.POSITIVE_INFINITY : size === 2 ? 2 : it.question.pairNext ? 2 : 1
    const group: Item[] = [it]
    for (let j = index + 1; j < items.length && group.length < limit; j++) {
      const next = items[j]
      if (next.kind !== 'question' || next.section.id !== it.section.id) break
      group.push(next)
    }
    return group
  }

  const columnWidths = (w: number, count: number, gutterEach: number) => {
    if (count <= 1) return { widths: [w], gutter: 0 }
    const gaps = count - 1
    const gutter = Math.max(0, Math.min(gutterEach, Math.floor(w / 4 / gaps)))
    const usable = w - gutter * gaps
    const base = Math.floor(usable / count)
    const widths = Array.from({ length: count }, () => base)
    widths[count - 1] = usable - base * (count - 1)
    return { widths, gutter }
  }

  const rowMeasure = (index: number, frame: Box) => {
    const group = rowAt(index)
    if (group.length <= 1) return { span: 1, height: build(items[index], frame.w).height }
    const { widths } = columnWidths(frame.w, group.length, pairGutter(group[0]))
    const height = Math.max(...group.map((it, k) => build(it, widths[k]).height))
    return { span: group.length, height }
  }

  /** 大題標題後必須同欄的高度：整個大題（放得進空欄時）或第一列 */
  const keepHeight = (headIndex: number, frame: Box): number => {
    const head = items[headIndex]
    if (head.kind !== 'section') return 0
    let end = headIndex + 1
    while (end < items.length && items[end].kind === 'question') end += 1
    if (end === headIndex + 1) return 0
    const first = rowMeasure(headIndex + 1, frame).height
    if (head.section.keepTogether !== 'whole') return first
    const headH = build(head, frame.w).height
    let whole = 0
    for (let k = headIndex + 1; k < end; ) {
      const row = rowMeasure(k, frame)
      whole += row.height + (k > headIndex + 1 ? c.mt.questionGap : 0)
      k += row.span
    }
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

  const pushAt = (it: Item, built: Built, x: number, w: number, h: number) => {
    blocks.push({
      ref: itemRef(it),
      page,
      frame: fi,
      box: { x, y, w, h },
      runs: built.runs.map((r) => ({ ...r, x: r.x + x, y: r.y + y })),
      rules: built.rules.map((r) => ({ ...r, x1: r.x1 + x, x2: r.x2 + x, y1: r.y1 + y, y2: r.y2 + y })),
      images: built.images.map((im) => ({ ...im, x: im.x + x, y: im.y + y })),
    })
  }

  for (let i = 0; i < items.length; i++) {
    const it = items[i]
    const group = it.kind === 'question' ? rowAt(i) : [it]
    let frame = frames[fi]
    let atTop = y === frame.y
    let gap = atTop ? 0 : gapBefore(it)

    const measureHere = () => {
      if (group.length > 1) {
        const { widths, gutter } = columnWidths(frame.w, group.length, pairGutter(it))
        const built = group.map((g, k) => build(g, widths[k]))
        return { built, widths, gutter, height: Math.max(...built.map((b) => b.height)) }
      }
      const built = build(it, frame.w)
      return { built: [built], widths: [frame.w], gutter: 0, height: built.height }
    }

    let laid = measureHere()
    const bottom = frame.y + frame.h

    if (!atTop) {
      const keep = it.kind === 'section' ? keepHeight(i, frame) : 0
      const fitsAlone = y + gap + laid.height <= bottom
      if (y + gap + laid.height + keep > bottom) {
        const from = { page, frame: fi }
        nextFrame()
        if (it.kind === 'section' && fitsAlone) {
          headMoves += 1
          warnings.push({ type: 'headMoved', sectionId: it.section.id, from, to: { page, frame: fi } })
        }
        frame = frames[fi]
        atTop = true
        gap = 0
        laid = measureHere()
      }
    }
    if (atTop && laid.height > frame.h) {
      for (const g of group) warnings.push({ type: 'oversize', ref: itemRef(g), page })
    }

    y += gap
    let x = frame.x
    laid.built.forEach((built, k) => {
      pushAt(group[k], built, x, laid.widths[k], laid.height)
      x += laid.widths[k] + (k < group.length - 1 ? laid.gutter : 0)
    })
    i += group.length - 1
    y += laid.height
  }

  return { blocks, pageCount: page + 1, warnings, headMoves }
}

const colWidthOf = (fontSize: number) => Math.ceil(fontSize * 1.2)
const colPitchOf = (fontSize: number) => Math.ceil(fontSize * 1.75)
const charsPerColumn = (fontSize: number, lineHeight: number, frameH: number) =>
  Math.max(1, Math.floor((frameH - 6) / (fontSize * lineHeight)))

/**
 * 橫向紙張：文字直排。每一欄由上往下，欄位由右往左；
 * 上半部排完後，從下半部的右邊再往左排。每個題目都從該欄頂端開始。
 */
function paginateVertical(items: Item[], getFrames: (page: number) => Box[], c: Ctx): PaginateResult {
  const { st, mt, assets } = c
  // 直排的字距比橫排行高緊一些，壓縮時仍會跟著變密
  const lh = Math.round((1 + (mt.lineHeight - 1) * 0.4) * 100) / 100
  const blocks: PlacedBlock[] = []
  const warnings: LayoutWarning[] = []
  let headMoves = 0
  if (!items.length) return { blocks, pageCount: 1, warnings, headMoves }

  type Slot = { box: Box; index: number }
  const slotsOf = (pageIndex: number): Slot[] => {
    const list = getFrames(pageIndex).map((box, index) => ({ box, index }))
    if (list.length === 2 && list[1].box.x > list[0].box.x + 1) return [list[1], list[0]]
    return list
  }

  let page = 0
  let slots = slotsOf(0)
  let si = 0
  let x = slots[0].box.x + slots[0].box.w
  /** 圖片插在直排欄中間之後，下一字接在同一欄的這個高度 */
  let resumeY: number | null = null
  const slot = () => slots[si]
  const frame = () => slot().box
  const atStart = () => x >= frame().x + frame().w - 0.5
  const remain = () => x - frame().x

  const nextFrame = (): boolean => {
    resumeY = null
    if (si >= slots.length - 1 && page >= MAX_PAGES - 1) return false
    if (si >= slots.length - 1) {
      page += 1
      slots = slotsOf(page)
      si = 0
    } else {
      si += 1
    }
    x = frame().x + frame().w
    return true
  }

  type Acc = {
    ref: BlockRef
    page: number
    fi: number
    frame: Box
    runs: FlowRun[]
    rules: FlowRule[]
    images: FlowImage[]
    minX: number
    maxX: number
    maxY: number
    live: boolean
    oversize: boolean
  }
  const blank = (ref: BlockRef): Acc => ({
    ref,
    page: 0,
    fi: 0,
    frame: frame(),
    runs: [],
    rules: [],
    images: [],
    minX: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
    live: false,
    oversize: false,
  })
  let acc = blank(itemRef(items[0]))

  const flush = () => {
    if (!acc.live) return
    const f = acc.frame
    blocks.push({
      ref: acc.ref,
      page: acc.page,
      frame: acc.fi,
      box: { x: acc.minX, y: f.y, w: Math.max(8, acc.maxX - acc.minX), h: Math.max(8, acc.maxY - f.y) },
      runs: acc.runs,
      rules: acc.rules,
      images: acc.images,
    })
    acc = blank(acc.ref)
  }

  const track = (x1: number, x2: number, y2: number) => {
    if (!acc.live) {
      acc.live = true
      acc.page = page
      acc.fi = slot().index
      acc.frame = frame()
    }
    acc.minX = Math.min(acc.minX, x1)
    acc.maxX = Math.max(acc.maxX, x2)
    acc.maxY = Math.max(acc.maxY, y2)
  }

  const markOversize = () => {
    if (acc.oversize) return
    acc.oversize = true
    warnings.push({ type: 'oversize', ref: acc.ref, page })
  }

  type Open = {
    chars: { g: string; color?: string }[]
    style: TextStyle
    key: string
    placeholder: boolean
    cap: number
    x: number
    w: number
    y: number
  }
  let open: Open | null = null
  /** 題號寫進題幹欄時，前幾個字不算文中的插入位置 */
  let pendingSkip = 0

  const closeOpen = () => {
    if (!open?.chars.length) {
      open = null
      return
    }
    const step = open.style.fontSize * lh
    const height = open.chars.length * step
    const colors = open.chars.some((c) => c.color) ? open.chars.map((c) => c.color ?? '') : undefined
    const skip = Math.min(pendingSkip, open.chars.length)
    pendingSkip -= skip
    acc.runs.push({
      key: `${open.key}-${acc.runs.length}`,
      x: open.x,
      y: open.y,
      width: open.w,
      height,
      text: open.chars.map((c) => c.g).join('\n'),
      colors,
      style: open.style,
      lineHeight: lh,
      vertical: true,
      placeholder: open.placeholder || undefined,
      stemFrom: skip > 0 ? skip : undefined,
    })
    track(open.x, open.x + open.w, open.y + height)
    open = null
  }

  const reserve = (need: number) => {
    if (need <= remain() + 0.5 || atStart()) return
    closeOpen()
    flush()
    nextFrame()
  }

  const startOpen = (style: TextStyle, key: string, placeholder: boolean) => {
    const p = colPitchOf(style.fontSize)
    const cw = Math.min(colWidthOf(style.fontSize), p)
    const f = frame()
    if (resumeY != null) {
      const y = resumeY
      resumeY = null
      const cap = Math.floor((f.y + f.h - y) / (style.fontSize * lh))
      if (cap >= 1 && x >= f.x) {
        let textX = x + (p - cw) / 2
        if (textX < f.x) textX = f.x
        open = { chars: [], style, key, placeholder, cap, x: textX, w: cw, y }
        return
      }
    }
    reserve(p)
    const host = frame()
    let slotLeft = x - p
    let textX = slotLeft + (p - cw) / 2
    if (slotLeft < host.x) {
      textX = host.x
      slotLeft = host.x
      markOversize()
    }
    x = slotLeft
    open = { chars: [], style, key, placeholder, cap: charsPerColumn(style.fontSize, lh, host.h), x: textX, w: cw, y: host.y }
  }

  const writeChunk = (text: string, style: TextStyle, key: string, placeholder = false) => {
    const chars = richChars(text).filter((unit) => unit.ch !== '\n')
    const room = open && sameStyle(open.style, style) && !!open.placeholder === placeholder ? open.cap - open.chars.length : 0
    if (room < chars.length) closeOpen()
    write(text, style, key, placeholder)
  }

  const pushGlyph = (unit: { ch: string; color?: string }, style: TextStyle, key: string, placeholder: boolean) => {
    if (open && (!sameStyle(open.style, style) || !!open.placeholder !== placeholder || open.chars.length >= open.cap)) closeOpen()
    if (!open) startOpen(style, key, placeholder)
    const col = open
    if (col) col.chars.push({ g: toVerticalGlyph(unit.ch), color: unit.color })
  }

  const write = (text: string, style: TextStyle, key: string, placeholder = false, stemFrom?: number) => {
    if (typeof stemFrom === 'number') pendingSkip = stemFrom
    const units = richChars(text)
    const manual = needsManualWrap(units.map((unit) => unit.ch).join(''))
    if (!manual) {
      for (const unit of units) {
        if (unit.ch === '\n') {
          closeOpen()
          resumeY = null
          continue
        }
        pushGlyph(unit, style, key, placeholder)
      }
      return
    }
    for (const group of clusterUnits(units)) {
      if (group.length === 1 && group[0].ch === '\n') {
        closeOpen()
        resumeY = null
        continue
      }
      const glyphs = group.filter((unit) => unit.ch !== '\n')
      if (
        glyphs.length &&
        open &&
        sameStyle(open.style, style) &&
        !!open.placeholder === placeholder &&
        open.chars.length > 0 &&
        open.chars.length + glyphs.length > open.cap
      ) {
        closeOpen()
      }
      for (const unit of glyphs) pushGlyph(unit, style, key, placeholder)
    }
  }

  const emitImage = (assetId: string, ratio: number, key: string, anchor?: 'middle' | 'below' | 'after') => {
    resumeY = null
    closeOpen()
    const asset = assets[assetId]
    if (!asset) return
    reserve(32)
    const f = frame()
    const aspect = asset.width / Math.max(1, asset.height)
    let h = f.h * Math.min(1, Math.max(0.25, ratio))
    let w = h * aspect
    const maxW = Math.max(48, f.w * 0.45)
    if (w > maxW) {
      w = maxW
      h = w / aspect
    }
    if (h > f.h) {
      h = f.h
      w = h * aspect
    }
    reserve(w + 6)
    const host = frame()
    let ix = x - w
    if (ix < host.x) {
      ix = host.x
      markOversize()
    }
    acc.images.push({
      key,
      x: ix,
      y: host.y,
      w,
      h,
      assetId,
      movable: anchor ? true : undefined,
      anchor,
    })
    track(ix, ix + w, host.y + h)
    x = Math.max(host.x, ix - 6)
  }

  /** 直排文中：圖片接在目前這欄已經寫出的字下面，後面的字再接著往下排 */
  const emitInColumn = (f: Figure, style: TextStyle) => {
    const asset = assets[f.assetId]
    const step = style.fontSize * lh
    const box = frame()
    const yTop = open ? open.y + open.chars.length * step : (resumeY ?? box.y)
    const room = box.y + box.h - yTop
    const inColumn = open != null || resumeY != null
    if (!asset || !inColumn || room < 48) {
      emitImage(f.assetId, f.widthRatio, f.id, 'middle')
      const placed = acc.images[acc.images.length - 1]
      if (placed && placed.key === f.id) placed.afterLine = f.afterLine
      return
    }
    resumeY = null
    const aspect = asset.width / Math.max(1, asset.height)
    const p = colPitchOf(style.fontSize)
    const maxW = Math.max(48, box.w * 0.45)
    let h = box.h * Math.min(1, Math.max(0.25, f.widthRatio))
    let w = h * aspect
    if (w > maxW) {
      w = maxW
      h = w / aspect
    }
    if (h > room - 4) {
      h = Math.max(16, room - 4)
      w = h * aspect
      if (w > maxW) {
        w = maxW
        h = w / aspect
      }
    }
    if (h < 64) {
      emitImage(f.assetId, f.widthRatio, f.id, 'middle')
      const placed = acc.images[acc.images.length - 1]
      if (placed && placed.key === f.id) placed.afterLine = f.afterLine
      return
    }
    const slotRight = x + p
    let ix = w <= p ? x + (p - w) / 2 : slotRight - w
    if (ix < box.x) {
      ix = box.x
      markOversize()
    }
    closeOpen()
    acc.images.push({
      key: f.id,
      x: ix,
      y: yTop,
      w,
      h,
      assetId: f.assetId,
      movable: true,
      anchor: 'middle',
      afterLine: f.afterLine,
    })
    track(ix, ix + w, yTop + h)
    const nextY = yTop + h + 4
    if (w <= p && box.y + box.h - nextY >= step) resumeY = nextY
    else x = Math.max(box.x, ix - 6)
  }

  const emitAnswers = (count: number, fontSize: number, draw: boolean) => {
    closeOpen()
    const p = colPitchOf(fontSize)
    for (let i = 0; i < count; i++) {
      reserve(p)
      const f = frame()
      let slotLeft = x - p
      if (slotLeft < f.x) slotLeft = f.x
      if (draw) {
        const cx = slotLeft + p / 2
        acc.rules.push({ key: `ans-${acc.rules.length}`, x1: cx, y1: f.y + 8, x2: cx, y2: f.y + f.h - 8 })
      }
      track(slotLeft, slotLeft + colWidthOf(fontSize), f.y + f.h - 8)
      x = slotLeft
    }
  }

  const textWidth = (text: string, fontSize: number, frameH: number) => {
    const n = [...plainText(text)].filter((ch) => ch !== '\n').length
    return Math.max(1, Math.ceil(n / charsPerColumn(fontSize, lh, frameH))) * colPitchOf(fontSize)
  }

  const applyGap = (px: number, fontSize: number) => {
    if (px <= 0 || atStart()) return
    if (remain() - px < colPitchOf(fontSize)) nextFrame()
    else x -= px
  }

  for (let i = 0; i < items.length; i++) {
    closeOpen()
    flush()
    const it = items[i]
    acc = blank(itemRef(it))
    if (it.kind === 'notice') {
      applyGap(mt.questionGap, st.body.fontSize)
      const raw = it.text.trim()
      write(raw || '（請輸入提示）', { ...st.body, bold: true }, 'text', !raw)
      continue
    }
    const heading = it.kind === 'section' ? resolveStyle(st.heading, it.section.headingStyle) : st.heading
    const instruction = it.kind === 'section' ? resolveStyle(st.instruction, it.section.instructionStyle) : st.instruction
    const body = it.kind === 'question' ? resolveStyle(st.body, it.question.bodyStyle) : st.body
    applyGap(
      it.kind === 'section' ? mt.sectionGap : it.firstOfSection ? 0 : mt.questionGap,
      it.kind === 'question' ? body.fontSize : heading.fontSize,
    )

    if (it.kind === 'section' && !atStart()) {
      const fh = frame().h
      const title = `${sectionHeading(it.section, it.index)}${sectionScoreNote(it.section)}`
      const headW = textWidth(title, heading.fontSize, fh) + (plainText(it.section.instruction).trim() ? textWidth(it.section.instruction, instruction.fontSize, fh) : 0)
      const follower = items[i + 1]
      const followerSize = follower?.kind === 'question' ? resolveStyle(st.body, follower.question.bodyStyle).fontSize : st.body.fontSize
      const oneCol = colPitchOf(followerSize)
      let keep = headW + oneCol
      if (follower?.kind === 'question' && it.section.keepTogether === 'whole') {
        const rest = items.slice(i + 1).filter((x) => x.kind === 'question') as Extract<Item, { kind: 'question' }>[]
        const whole = rest.reduce(
          (sum, q) =>
            sum +
            textWidth(
              plainText(`${questionLead(q)}${stripMarks(q.question.stem)}${q.scoreMark}`),
              resolveStyle(st.body, q.question.bodyStyle).fontSize,
              fh,
            ),
          headW,
        )
        if (whole <= frame().w) keep = whole
      }
      if (keep <= frame().w && remain() < keep) {
        const from = { page, frame: slot().index }
        nextFrame()
        const to = { page, frame: slot().index }
        if (from.page !== to.page || from.frame !== to.frame) {
          headMoves += 1
          warnings.push({ type: 'headMoved', sectionId: it.section.id, from, to })
        }
      }
    }

    if (it.kind === 'section') {
      write(`${toChineseNumeral(it.index + 1)}、${it.section.title}${sectionScoreNote(it.section)}`, heading, 'title')
      if (plainText(it.section.instruction).trim()) {
        closeOpen()
        write(it.section.instruction.trim(), instruction, 'inst')
      }
      continue
    }

    pendingSkip = 0
    const q = it.question
    const rowsLayout = it.section.layout === 'rows'
    if (rowsLayout && !atStart()) {
      const minW = questionRowLines(it.section, q) * colPitchOf(body.fontSize)
      if (remain() + 0.5 < minW) nextFrame()
    }
    const rowOrigin = rowsLayout ? { page, si, x } : null
    const right = q.figures.filter((f) => f.placement === 'right')
    const middle = q.figures.filter((f) => f.placement === 'middle')
    const after = q.figures.filter((f) => f.placement === 'afterChoices')
    const below = q.figures.filter((f) => f.placement !== 'right' && f.placement !== 'middle' && f.placement !== 'afterChoices')
    right.forEach((f) => emitImage(f.assetId, f.widthRatio, f.id))
    const stem = q.stem.trim()
    const scoredStem = stemWithScore(stem, it.scoreMark)
    const lead = questionLead(it)
    const anchored = !hasFigureMark(stem) && middle.some((f) => typeof f.afterLine === 'number')
    if (!stem) {
      write(lead, body, 'num')
      closeOpen()
      write(EMPTY_STEM, body, 'stem', true)
      middle.forEach((f) => (anchored ? emitInColumn(f, body) : emitImage(f.assetId, f.widthRatio, f.id, 'middle')))
      if (it.scoreMark) write(it.scoreMark, body, 'score')
    } else if (anchored) {
      const units = richChars(stripMarks(stem))
      const visible = units.filter((unit) => unit.ch !== '\n').length
      const atOf = (f: Figure) => Math.max(0, Math.min(visible, f.afterLine ?? 1))
      write(lead, body, 'num')
      const placeAt = (index: number) => {
        for (const f of middle) if (atOf(f) === index) emitInColumn(f, body)
      }
      const pushChar = (ch: string, color?: string) => {
        const col = open
        if (col && (col.placeholder || !sameStyle(col.style, body) || col.chars.length >= col.cap)) closeOpen()
        if (!open) startOpen(body, 'stem', false)
        const next = open
        if (next) next.chars.push({ g: toVerticalGlyph(ch), color })
      }
      const breakBeforeSyllable = (count: number) => {
        const column = open
        if (!column || count <= 1 || column.placeholder || !sameStyle(column.style, body)) return
        if (column.chars.length > 0 && column.chars.length + count > column.cap) closeOpen()
      }
      let seen = 0
      placeAt(0)
      const groups = needsManualWrap(units.map((unit) => unit.ch).join('')) ? clusterUnits(units) : units.map((unit) => [unit])
      for (const group of groups) {
        if (group.length === 1 && group[0].ch === '\n') {
          closeOpen()
          resumeY = null
          continue
        }
        const glyphs = group.filter((unit) => unit.ch !== '\n')
        breakBeforeSyllable(glyphs.length)
        for (const unit of glyphs) {
          pushChar(unit.ch, unit.color)
          seen += 1
          placeAt(seen)
        }
      }
      if (it.scoreMark) for (const ch of it.scoreMark) pushChar(ch)
    } else {
      const plan = planStemFigures(scoredStem, middle.length)
      let figAt = 0
      plan.parts.forEach((part, i) => {
        const text = i === 0 ? `${lead}${part}` : part
        if (text) write(text, body, i === 0 ? 'stem' : `stem-${i}`, false, i === 0 ? [...lead].length : undefined)
        const batch = middle.slice(figAt, figAt + plan.slots[i])
        figAt += plan.slots[i]
        batch.forEach((f) => emitImage(f.assetId, f.widthRatio, f.id, 'middle'))
      })
    }
    below.forEach((f) => emitImage(f.assetId, f.widthRatio, f.id, 'below'))
    if (isChoiceType(q.type)) {
      q.choices.forEach((ch, ci) => {
        const label = plainText(ch.text).trim() ? `${choiceLabel(ci)} ${ch.text.trim()}` : choiceLabel(ci)
        writeChunk(label, body, `ch-${ci}`)
        if (ch.image) emitImage(ch.image.assetId, ch.image.widthRatio, `chimg-${ch.id}`)
      })
    }
    after.forEach((f) => emitImage(f.assetId, f.widthRatio, f.id, 'after'))
    const aside = rowsLayout ? (q.aside ?? '').trim() : ''
    if (aside) write(aside, body, 'aside')
    if (rowsLayout) {
      closeOpen()
      if (rowOrigin && page === rowOrigin.page && si === rowOrigin.si) {
        const pitch = colPitchOf(body.fontSize)
        const minW = questionRowLines(it.section, q) * pitch
        const extra = Math.min(Math.max(0, x - frame().x), Math.max(0, minW - (rowOrigin.x - x)))
        if (extra > 0.5) {
          const target = x - extra
          track(target, rowOrigin.x, frame().y + 8)
          x = target
        }
      }
    } else if (q.type === 'short_answer' && q.answerLines > 0) {
      emitAnswers(q.answerLines, body.fontSize, q.answerRuled !== false)
    }
  }
  closeOpen()
  flush()

  return { blocks, pageCount: page + 1, warnings, headMoves }
}

const FOOTER_GAP = 8

function shrinkBottom(frames: Box[], reserve: number): Box[] {
  if (reserve <= 0 || !frames.length) return frames
  const bottom = Math.max(...frames.map((f) => f.y + f.h))
  return frames.map((f) =>
    Math.abs(f.y + f.h - bottom) < 0.5 ? { ...f, h: Math.max(24, f.h - reserve) } : f,
  )
}

function isSideBySide(frames: Box[]): boolean {
  return frames.length >= 2 && frames[1].x > frames[0].x + 1
}

/** 左右分欄時，續頁提示只佔閱讀順序的最後一欄，不橫跨整頁 */
function continueFrameIndex(frames: Box[], vertical: boolean): number | null {
  if (!isSideBySide(frames)) return null
  return vertical ? 0 : frames.length - 1
}

function shrinkForNotice(frames: Box[], reserve: number, vertical: boolean): Box[] {
  if (reserve <= 0 || !frames.length) return frames
  const idx = continueFrameIndex(frames, vertical)
  if (idx == null) return shrinkBottom(frames, reserve)
  return frames.map((f, i) => (i === idx ? { ...f, h: Math.max(24, f.h - reserve) } : f))
}

function noticeWidth(frames: Box[], vertical: boolean): number {
  const idx = continueFrameIndex(frames, vertical)
  if (idx == null) return contentSpan(frames).w
  return Math.max(40, frames[idx].w)
}

function contentSpan(frames: Box[]) {
  const x = Math.min(...frames.map((f) => f.x))
  const right = Math.max(...frames.map((f) => f.x + f.w))
  const bottom = Math.max(...frames.map((f) => f.y + f.h))
  return { x, w: Math.max(40, right - x), bottom }
}

function placeFooter(
  id: string,
  text: string,
  page: number,
  getFrames: (page: number) => Box[],
  c: Ctx,
  vertical: boolean,
): PlacedBlock {
  const frames = getFrames(page)
  const idx = continueFrameIndex(frames, vertical)
  let x: number
  let w: number
  let bottom: number
  let frame: number
  if (idx == null) {
    const span = contentSpan(frames)
    x = span.x
    w = span.w
    bottom = span.bottom
    frame = Math.max(0, frames.findIndex((f) => Math.abs(f.y + f.h - bottom) < 0.5))
  } else {
    const column = frames[idx]
    x = column.x
    w = column.w
    bottom = column.y + column.h
    frame = idx
  }
  const built = buildNotice(text, w, c)
  const y = bottom - built.height
  return {
    ref: { kind: 'notice', id },
    page,
    frame,
    box: { x, y, w, h: built.height },
    runs: built.runs.map((r) => ({ ...r, x: r.x + x, y: r.y + y })),
    rules: built.rules.map((r) => ({
      ...r,
      x1: r.x1 + x,
      x2: r.x2 + x,
      y1: r.y1 + y,
      y2: r.y2 + y,
    })),
    images: [],
  }
}

/** 外框與直式表格的內部分隔線。提示框的框線已經畫在題塊上。 */
function decorate(exam: ExamContent, blocks: PlacedBlock[], vertical: boolean): FlowFrame[] {
  const frames: FlowFrame[] = []
  const sectionOf = new Map<string, Section>()
  for (const s of exam.sections) for (const q of s.questions) sectionOf.set(q.id, s)

  for (const section of exam.sections) {
    const table = section.layout === 'rows' && !vertical
    const drawOuter = section.frame === 'body' || section.frame === 'all' || table
    if (!drawOuter) continue
    const includeHead = section.frame === 'all'
    const members = blocks.filter((b) => {
      if (b.ref.kind === 'question') return sectionOf.get(b.ref.id)?.id === section.id
      return includeHead && b.ref.kind === 'section' && b.ref.id === section.id
    })
    const groups = new Map<string, PlacedBlock[]>()
    for (const b of members) {
      const key = `${b.page}:${b.frame}`
      const list = groups.get(key) ?? []
      list.push(b)
      groups.set(key, list)
    }
    for (const [key, group] of groups) {
      if (!group.length) continue
      group.sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x)
      const x = Math.min(...group.map((b) => b.box.x))
      const y = Math.min(...group.map((b) => b.box.y))
      const right = Math.max(...group.map((b) => b.box.x + b.box.w))
      const bottom = Math.max(...group.map((b) => b.box.y + b.box.h))
      if (right - x < 4 || bottom - y < 4) continue
      const rules: FlowRule[] = []
      if (table) {
        const questions = group.filter((b) => b.ref.kind === 'question')
        const head = group.find((b) => b.ref.kind === 'section')
        if (head && questions.length) {
          const yy = questions[0].box.y
          rules.push({ key: 'head', x1: x, y1: yy, x2: right, y2: yy, stroke: BOX_STROKE, strokeWidth: 1.25 })
        }
        for (let i = 0; i < questions.length - 1; i++) {
          const yy = questions[i + 1].box.y
          if (Math.abs(yy - questions[i].box.y) < 1) continue
          rules.push({
            key: `row-${questions[i].ref.id}`,
            x1: x,
            y1: yy,
            x2: right,
            y2: yy,
            stroke: BOX_STROKE,
            strokeWidth: 1.25,
          })
        }
        for (let i = 0; i < questions.length - 1; i++) {
          const a = questions[i]
          const b = questions[i + 1]
          if (Math.abs(a.box.y - b.box.y) >= 1) continue
          const top = Math.min(a.box.y, b.box.y)
          const bottomEdge = Math.max(a.box.y + a.box.h, b.box.y + b.box.h)
          rules.push({
            key: `pair-${a.ref.id}`,
            x1: b.box.x,
            y1: top,
            x2: b.box.x,
            y2: bottomEdge,
            stroke: BOX_STROKE,
            strokeWidth: 1.25,
          })
        }
        for (const qb of questions) {
          const q = section.questions.find((item) => item.id === qb.ref.id)
          if (!q || !(q.aside ?? '').trim()) continue
          const left = asideLeftEdge(qb.box.w - FRAME_PAD * 2, questionAsideWidth(q))
          const sx = qb.box.x + FRAME_PAD + left
          rules.push({
            key: `aside-${qb.ref.id}`,
            x1: sx,
            y1: qb.box.y,
            x2: sx,
            y2: qb.box.y + qb.box.h,
            stroke: BOX_STROKE,
            strokeWidth: 1.25,
          })
        }
      }
      frames.push({ key: `${section.id}:${key}`, page: group[0].page, x, y, w: right - x, h: bottom - y, rules })
    }
  }

  for (const b of blocks) {
    if (b.ref.kind !== 'notice' || !b.runs.some((r) => r.vertical)) continue
    const runs = b.runs
    const x = Math.min(...runs.map((r) => r.x)) - 8
    const y = Math.min(...runs.map((r) => r.y)) - 6
    const right = Math.max(...runs.map((r) => r.x + r.width)) + 8
    const bottom = Math.max(...runs.map((r) => r.y + (r.height ?? r.style.fontSize))) + 6
    frames.push({
      key: `notice-${b.ref.id}-${b.page}-${b.frame}`,
      page: b.page,
      x,
      y,
      w: Math.max(8, right - x),
      h: Math.max(8, bottom - y),
      rules: [],
    })
  }
  return frames
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
  vertical = false,
): FlowResult {
  const nums = questionNumbers(exam)
  const items: Item[] = []
  exam.sections.forEach((section, index) => {
    items.push({ kind: 'section', section, index })
    section.questions.forEach((question, qi) =>
      items.push({
        kind: 'question',
        question,
        section,
        num: nums.get(question.id) ?? 0,
        firstOfSection: qi === 0,
        scoreMark: questionScoreMark(section, question),
      }),
    )
  })

  const footer = footerOf(exam)
  if (footer.endOn) items.push({ kind: 'notice', id: FOOTER_END_ID, text: footer.endText })

  const heightCache = new Map<string, number>()
  const continueReserve = (page: number, t: number) => {
    if (!footer.continueOn) return 0
    const w = noticeWidth(getFrames(page), vertical)
    const key = `${t}:${Math.round(w * 100)}`
    const hit = heightCache.get(key)
    if (hit != null) return hit
    const ctx: Ctx = { st, m, mt: metricsAt(spacing, t), assets: exam.assets }
    const value = buildNotice(footer.continueText, w, ctx).height + FOOTER_GAP
    heightCache.set(key, value)
    return value
  }
  const reserveFor = (page: number, assumed: number, t: number) => {
    if (assumed <= 1 || page >= assumed - 1) return 0
    return continueReserve(page, t)
  }

  const run = (t: number, reserveOf: (page: number) => number) => {
    const mt = metricsAt(spacing, t)
    const ctx: Ctx = { st, m, mt, assets: exam.assets }
    const frames = (page: number) => shrinkForNotice(getFrames(page), reserveOf(page), vertical)
    return {
      t,
      mt,
      ctx,
      r: vertical ? paginateVertical(items, frames, ctx) : paginate(items, frames, ctx),
    }
  }

  const settle = (t: number) => {
    let assumed = 1
    let previous = 0
    for (let i = 0; i < 6; i++) {
      const laid = run(t, (page) => reserveFor(page, assumed, t))
      if (laid.r.pageCount === assumed) return laid
      if (laid.r.pageCount === previous) return run(t, (page) => continueReserve(page, t))
      previous = assumed
      assumed = Math.max(1, laid.r.pageCount)
    }
    return run(t, (page) => continueReserve(page, t))
  }

  const score = (r: PaginateResult) => r.pageCount * 1000 + r.headMoves
  const base = settle(0)
  let best = base
  if (spacing.allowSqueeze && items.length) {
    for (const t of SQUEEZE_LEVELS.slice(1)) {
      const cand = settle(t)
      if (score(cand.r) < score(best.r)) best = cand
    }
  }

  const blocks = [...best.r.blocks]
  const pages = best.r.pageCount
  if (footer.continueOn && pages > 1) {
    for (let page = 0; page < pages - 1; page++) {
      blocks.push(placeFooter(FOOTER_CONTINUE_ID, footer.continueText, page, getFrames, best.ctx, vertical))
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
    blocks,
    frames: decorate(exam, blocks, vertical),
    pageCount: pages,
    squeeze: best.t,
    lineHeight: best.mt.lineHeight,
    warnings,
  }
}
