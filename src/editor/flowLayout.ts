import type { Box } from './bounds'
import {
  choiceLabel,
  isChoiceType,
  questionNumbers,
  questionScoreMark,
  sectionHeading,
  sectionScoreNote,
  toChineseNumeral,
  type Asset,
  type BlockRef,
  type ExamContent,
  type FontOverride,
  type Question,
  type Section,
} from '../types/exam'
import { toVerticalGlyph, type SpacingSettings } from '../types/layout'
import { paintText, plainText, richChars } from './richText'

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

function buildSectionHead(s: Section, index: number, w: number, c: Ctx): Built {
  const { st, m, mt } = c
  const heading = resolveStyle(st.heading, s.headingStyle)
  const instruction = resolveStyle(st.instruction, s.instructionStyle)
  const runs: FlowRun[] = []
  const title = paintText(`${toChineseNumeral(index + 1)}、${s.title}${sectionScoreNote(s)}`)
  runs.push({ key: 'title', x: 0, y: 0, width: w, text: title.text, colors: title.colors, style: heading, lineHeight: mt.lineHeight })
  let h = m(title.text, w, heading, mt.lineHeight).height
  if (plainText(s.instruction).trim()) {
    h += 2
    const inst = paintText(s.instruction)
    runs.push({ key: 'inst', x: 0, y: h, width: w, text: inst.text, colors: inst.colors, style: instruction, lineHeight: mt.lineHeight })
    h += m(inst.text, w, instruction, mt.lineHeight).height
  }
  return { height: h + 4, runs, rules: [], images: [] }
}

function figureSize(c: Ctx, assetId: string, maxW: number, ratio: number) {
  const a = c.assets[assetId]
  if (!a) return null
  const w = Math.max(24, Math.min(maxW, maxW * ratio))
  return { w, h: (w * a.height) / Math.max(1, a.width) }
}

function buildQuestion(q: Question, num: number, scoreMark: string, indent: number, w: number, c: Ctx): Built {
  const { m, mt } = c
  const body = resolveStyle(c.st.body, q.bodyStyle)
  const runs: FlowRun[] = []
  const rules: FlowRule[] = []
  const images: FlowImage[] = []
  const lh = body.fontSize * mt.lineHeight
  const prefix = scoreMark ? `${num}.${scoreMark}` : `${num}.`
  const innerW = Math.max(40, w - indent)
  const stemPainted = paintText(q.stem.trim() || EMPTY_STEM)
  const stem = stemPainted.text

  const right = q.figures.find((f) => f.placement === 'right')
  const below = q.figures.filter((f) => f !== right && f.placement !== 'afterChoices')
  const after = q.figures.filter((f) => f !== right && f.placement === 'afterChoices')

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
  runs.push({
    key: 'stem',
    x: indent,
    y: 0,
    width: stemW,
    text: stem,
    colors: q.stem.trim() ? stemPainted.colors : undefined,
    style: body,
    lineHeight: mt.lineHeight,
    placeholder: !q.stem.trim(),
  })
  let h = m(stem, stemW, body, mt.lineHeight).height
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
        let cellH = m(labels[i].text, textW, body, mt.lineHeight).height
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
  | { kind: 'question'; question: Question; num: number; firstOfSection: boolean; scoreMark: string }

function questionLead(it: Extract<Item, { kind: 'question' }>): string {
  return it.scoreMark ? `${it.num}.${it.scoreMark}` : `${it.num}.`
}

/** 配分不同時，同一大題的題幹對齊到最寬的「題號＋分數」之後 */
function questionIndents(items: Item[], c: Ctx): Map<string, number> {
  const map = new Map<string, number>()
  let group: Extract<Item, { kind: 'question' }>[] = []
  const flush = () => {
    if (!group.length) return
    const marked = group.some((q) => q.scoreMark)
    let shared = 0
    for (const q of group) {
      const body = resolveStyle(c.st.body, q.question.bodyStyle)
      const base = Math.ceil(body.fontSize * 2)
      if (!marked) {
        map.set(q.question.id, base)
        continue
      }
      const measured = c.m(questionLead(q), 10000, body, c.mt.lineHeight).naturalWidth
      shared = Math.max(shared, base, Math.ceil(measured + body.fontSize * 0.35))
    }
    if (marked) for (const q of group) map.set(q.question.id, shared)
    group = []
  }
  for (const it of items) {
    if (it.kind === 'section') flush()
    else group.push(it)
  }
  flush()
  return map
}

function itemRef(it: Item): BlockRef {
  return it.kind === 'section' ? { kind: 'section', id: it.section.id } : { kind: 'question', id: it.question.id }
}

type PaginateResult = Omit<FlowResult, 'squeeze' | 'lineHeight'> & { headMoves: number }

function paginate(items: Item[], getFrames: (page: number) => Box[], c: Ctx): PaginateResult {
  const indents = questionIndents(items, c)
  const build = (it: Item, w: number): Built =>
    it.kind === 'section'
      ? buildSectionHead(it.section, it.index, w, c)
      : buildQuestion(it.question, it.num, it.scoreMark, indents.get(it.question.id) ?? Math.ceil(c.st.body.fontSize * 2), w, c)
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
  const slot = () => slots[si]
  const frame = () => slot().box
  const atStart = () => x >= frame().x + frame().w - 0.5
  const remain = () => x - frame().x

  const nextFrame = (): boolean => {
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

  const closeOpen = () => {
    if (!open?.chars.length) {
      open = null
      return
    }
    const step = open.style.fontSize * lh
    const height = open.chars.length * step
    const colors = open.chars.some((c) => c.color) ? open.chars.map((c) => c.color ?? '') : undefined
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
    reserve(p)
    const f = frame()
    let slotLeft = x - p
    let textX = slotLeft + (p - cw) / 2
    if (slotLeft < f.x) {
      textX = f.x
      slotLeft = f.x
      markOversize()
    }
    x = slotLeft
    open = { chars: [], style, key, placeholder, cap: charsPerColumn(style.fontSize, lh, f.h), x: textX, w: cw, y: f.y }
  }

  const writeChunk = (text: string, style: TextStyle, key: string, placeholder = false) => {
    const chars = richChars(text).filter((unit) => unit.ch !== '\n')
    const room = open && sameStyle(open.style, style) && !!open.placeholder === placeholder ? open.cap - open.chars.length : 0
    if (room < chars.length) closeOpen()
    write(text, style, key, placeholder)
  }

  const write = (text: string, style: TextStyle, key: string, placeholder = false) => {
    for (const unit of richChars(text)) {
      if (unit.ch === '\n') {
        closeOpen()
        continue
      }
      if (open && (!sameStyle(open.style, style) || !!open.placeholder !== placeholder || open.chars.length >= open.cap)) closeOpen()
      if (!open) startOpen(style, key, placeholder)
      const col = open
      if (col) col.chars.push({ g: toVerticalGlyph(unit.ch), color: unit.color })
    }
  }

  const emitImage = (assetId: string, ratio: number, key: string) => {
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
    acc.images.push({ key, x: ix, y: host.y, w, h, assetId })
    track(ix, ix + w, host.y + h)
    x = Math.max(host.x, ix - 6)
  }

  const emitAnswers = (count: number, fontSize: number) => {
    closeOpen()
    const p = colPitchOf(fontSize)
    for (let i = 0; i < count; i++) {
      reserve(p)
      const f = frame()
      let slotLeft = x - p
      if (slotLeft < f.x) slotLeft = f.x
      const cx = slotLeft + p / 2
      acc.rules.push({ key: `ans-${acc.rules.length}`, x1: cx, y1: f.y + 8, x2: cx, y2: f.y + f.h - 8 })
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
    const heading = it.kind === 'section' ? resolveStyle(st.heading, it.section.headingStyle) : st.heading
    const instruction = it.kind === 'section' ? resolveStyle(st.instruction, it.section.instructionStyle) : st.instruction
    const body = it.kind === 'question' ? resolveStyle(st.body, it.question.bodyStyle) : st.body
    applyGap(it.kind === 'section' ? mt.sectionGap : it.firstOfSection ? 0 : mt.questionGap, it.kind === 'section' ? heading.fontSize : body.fontSize)

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
          (sum, q) => sum + textWidth(plainText(`${questionLead(q)}${q.question.stem}`), resolveStyle(st.body, q.question.bodyStyle).fontSize, fh),
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

    const q = it.question
    const right = q.figures.filter((f) => f.placement === 'right')
    const below = q.figures.filter((f) => f.placement !== 'right' && f.placement !== 'afterChoices')
    const after = q.figures.filter((f) => f.placement === 'afterChoices')
    right.forEach((f) => emitImage(f.assetId, f.widthRatio, f.id))
    const stem = q.stem.trim()
    const lead = questionLead(it)
    if (stem) write(`${lead}${stem}`, body, 'stem')
    else {
      write(lead, body, 'num')
      closeOpen()
      write(EMPTY_STEM, body, 'stem', true)
    }
    below.forEach((f) => emitImage(f.assetId, f.widthRatio, f.id))
    if (isChoiceType(q.type)) {
      q.choices.forEach((ch, ci) => {
        const label = plainText(ch.text).trim() ? `${choiceLabel(ci)} ${ch.text.trim()}` : choiceLabel(ci)
        writeChunk(label, body, `ch-${ci}`)
        if (ch.image) emitImage(ch.image.assetId, ch.image.widthRatio, `chimg-${ch.id}`)
      })
    }
    after.forEach((f) => emitImage(f.assetId, f.widthRatio, f.id))
    if (q.type === 'short_answer' && q.answerLines > 0) emitAnswers(q.answerLines, body.fontSize)
  }
  closeOpen()
  flush()

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
        num: nums.get(question.id) ?? 0,
        firstOfSection: qi === 0,
        scoreMark: questionScoreMark(section, question),
      }),
    )
  })

  const run = (t: number) => {
    const mt = metricsAt(spacing, t)
    const ctx = { st, m, mt, assets: exam.assets }
    return { t, mt, r: vertical ? paginateVertical(items, getFrames, ctx) : paginate(items, getFrames, ctx) }
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
