import type { FlowRule, FlowRun, PlacedBlock } from '../editor/flowLayout'
import { lineInkCenter, measureText } from '../editor/konvaMeasure'
import { layoutRichLines, plainText } from '../editor/richText'
import { rubyPlace, splitRubyReading } from '../editor/rubyLayout'
import { needsManualWrap } from '../editor/zhuyin'
import {
  asideLeftEdge,
  choiceLabel,
  type ExamContent,
  isChoiceType,
  type Question,
  questionAsideWidth,
  type Section,
} from '../types/exam'
import { toVerticalGlyph } from '../types/layout'

export const ANSWER_INK = '#c42318'

export type AnswerTextMark = {
  kind: 'text'
  page: number
  x: number
  y: number
  w: number
  h: number
  text: string
  fontSize: number
  lineHeight: number
  align?: 'left' | 'center'
  /** 直排：text 已是一字一行 */
  vertical?: boolean
  /** 蓋在題目上時墊一層白底，避免跟題幹黏在一起 */
  plate?: boolean
  /** 白底遮住底線，不畫外框。答案寫進空格時用 */
  mask?: boolean
}

export type AnswerMark = { kind: 'ring'; page: number; x: number; y: number; rx: number; ry: number } | AnswerTextMark

function foldLetter(ch: string): string {
  const c = ch.codePointAt(0) ?? 0
  if (c >= 0xff21 && c <= 0xff3a) return String.fromCharCode(c - 0xfee0)
  if (c >= 0xff41 && c <= 0xff5a) return String.fromCharCode(c - 0xfee0)
  return ch
}

/** 「C」「(C)」「Ａ、Ｃ」這類作答，轉成選項索引。說明句不當成選項。 */
function choiceHits(q: Question): number[] {
  const count = q.choices.length
  if (!count) return []
  const parts = q.answer
    .trim()
    .split(/[、,，;；\n/／|｜\s]+/)
    .map((part) => part.trim())
    .filter(Boolean)
  const hits: number[] = []
  const add = (index: number) => {
    if (index >= 0 && index < count && !hits.includes(index)) hits.push(index)
  }
  for (const part of parts) {
    const only = [...part]
      .map((ch) => foldLetter(ch).toUpperCase())
      .join('')
      .replace(/[()（）.．]/g, '')
    if (/^[A-Z]+$/.test(only)) {
      const indexes = [...only].map((ch) => ch.charCodeAt(0) - 65)
      if (indexes.every((index) => index >= 0 && index < count)) indexes.forEach(add)
      continue
    }
    const text = part.trim()
    const found = q.choices.findIndex((ch) => {
      const label = plainText(ch.text).trim()
      return label.length > 0 && label === text
    })
    if (found >= 0) add(found)
  }
  return hits
}

function byReadingOrder(a: PlacedBlock, b: PlacedBlock): number {
  if (a.page !== b.page) return a.page - b.page
  if (a.frame !== b.frame) return a.frame - b.frame
  if (a.box.y !== b.box.y) return a.box.y - b.box.y
  return a.box.x - b.box.x
}

function isStemKey(key: string): boolean {
  return key === 'stem' || key.startsWith('stem-')
}

function isAnswerRule(rule: FlowRule): boolean {
  return rule.key.startsWith('ans-')
}

function locate(exam: ExamContent, id: string): { section: Section; question: Question } | null {
  for (const section of exam.sections) {
    const question = section.questions.find((q) => q.id === id)
    if (question) return { section, question }
  }
  return null
}

function textStyleOf(blocks: PlacedBlock[]): { fontSize: number; lineHeight: number } {
  for (const block of blocks) {
    const run = block.runs.find((r) => isStemKey(r.key)) ?? block.runs[0]
    if (run) return { fontSize: run.style.fontSize, lineHeight: run.lineHeight }
  }
  return { fontSize: 16, lineHeight: 1.5 }
}

function contentBottom(block: PlacedBlock): number {
  let y = block.box.y
  for (const run of block.runs) {
    const height = run.height ?? run.style.fontSize * run.lineHeight * Math.max(1, run.lineCount ?? 1)
    y = Math.max(y, run.y + height)
  }
  for (const image of block.images) y = Math.max(y, image.y + image.h)
  return y
}

function textMark(
  page: number,
  x: number,
  y: number,
  w: number,
  text: string,
  fontSize: number,
  lineHeight: number,
  fontFamily: string,
  plate: boolean,
  align: 'left' | 'center' = 'left',
  vertical = false,
  mask = false,
): AnswerTextMark {
  const width = Math.max(fontSize, w)
  const measured = vertical
    ? text.split('\n').length * fontSize * lineHeight
    : measureText(fontFamily, text, Math.max(8, width - (plate ? 8 : 0)), { fontSize, fill: ANSWER_INK }, lineHeight).height
  return {
    kind: 'text',
    page,
    x,
    y,
    w: width,
    h: Math.max(fontSize, measured + (plate ? 6 : 0)),
    text,
    fontSize,
    lineHeight,
    align,
    vertical: vertical || undefined,
    plate: plate || undefined,
    mask: mask || undefined,
  }
}

/** 選項可能跟前後選項寫在同一欄，所以在選項文字裡找 (C)，不靠欄位鍵。 */
function findChoiceRing(blocks: PlacedBlock[], index: number, fontFamily: string): AnswerMark | null {
  const label = choiceLabel(index)
  const verticalWant = [...label].map((ch) => toVerticalGlyph(ch))
  for (const block of blocks) {
    for (const run of block.runs) {
      if (!run.key.startsWith('ch-')) continue
      if (run.vertical) {
        const glyphs = run.text.split('\n')
        for (let i = 0; i <= glyphs.length - verticalWant.length; i++) {
          if (!verticalWant.every((glyph, k) => glyphs[i + k] === glyph)) continue
          const step = run.style.fontSize * run.lineHeight
          return {
            kind: 'ring',
            page: block.page,
            x: run.x + run.width / 2,
            y: run.y + (i + verticalWant.length / 2) * step,
            rx: run.style.fontSize * 0.78,
            ry: (verticalWant.length * step) / 2 + 1,
          }
        }
        continue
      }
      const box = horizontalChoiceRing(run, label, fontFamily)
      if (!box) continue
      return { kind: 'ring', page: block.page, ...box }
    }
  }
  return null
}

/** 圈心對準 (C) 這幾個字的筆畫，而不是行距的上半部。 */
function horizontalChoiceRing(
  run: FlowRun,
  label: string,
  fontFamily: string,
): { x: number; y: number; rx: number; ry: number } | null {
  const at = run.text.indexOf(label)
  if (at < 0) return null
  const fontSize = run.style.fontSize
  const step = fontSize * run.lineHeight
  const widthOf = (sample: string, deco = '') => charWidth(fontFamily, run, sample, deco)
  const labelW = widthOf(label)
  const manual = needsManualWrap(run.text) || !!run.colors?.some(Boolean) || !!run.decos?.some(Boolean)
  let originX: number
  let centerY: number
  if (manual) {
    const pieces = layoutRichLines(run.text, run.colors, run.width, widthOf, run.decos)
    let seen = 0
    let hit: { x: number; line: number } | null = null
    for (const piece of pieces) {
      const start = seen
      seen += piece.text.length
      if (at < start || at + label.length > seen) continue
      hit = { x: piece.x + widthOf(piece.text.slice(0, at - start), piece.deco), line: piece.line }
      break
    }
    if (!hit) return null
    const shift = manualLineShift(run, pieces, widthOf, hit.line)
    originX = run.x + hit.x + shift
    centerY = run.y + hit.line * step + lineInkCenter(fontFamily, label, run.style, 1)
  } else {
    const prefix = run.text.slice(0, at)
    let line = 0
    let lineW = 0
    if (prefix && widthOf(prefix) + labelW > run.width + 0.5) {
      for (const ch of prefix) {
        const w = widthOf(ch)
        if (lineW > 0 && lineW + w > run.width + 0.5) {
          line += 1
          lineW = 0
        }
        lineW += w
      }
      if (lineW > 0 && lineW + labelW > run.width + 0.5) {
        line += 1
        lineW = 0
      }
    } else if (prefix) {
      lineW = widthOf(prefix)
    }
    originX = run.x + lineW
    centerY = run.y + line * step + lineInkCenter(fontFamily, label, run.style, run.lineHeight)
  }
  return {
    x: originX + labelW / 2,
    y: centerY,
    rx: labelW / 2 + fontSize * 0.28,
    ry: fontSize * 0.72,
  }
}

function manualLineShift(
  run: FlowRun,
  pieces: { text: string; x: number; line: number; deco?: string }[],
  widthOf: (sample: string, deco?: string) => number,
  line: number,
): number {
  if (!run.align || run.align === 'left') return 0
  let used = 0
  for (const piece of pieces) {
    if (piece.line === line) used = Math.max(used, piece.x + widthOf(piece.text, piece.deco))
  }
  return run.align === 'center' ? Math.max(0, (run.width - used) / 2) : Math.max(0, run.width - used)
}

type Glyph = { ch: string; x: number; y: number; w: number; h: number; fontSize: number; page: number }
type Slot = { page: number; x: number; y: number; w: number; h: number; fontSize: number }

const PAREN_OPEN = new Set(['（', '('])
const PAREN_CLOSE = new Set(['）', ')'])
const BLANK_SPACE = new Set([' ', '　', '\t'])

function charWidth(fontFamily: string, run: FlowRun, sample: string, deco = ''): number {
  if (!sample) return 0
  return measureText(
    fontFamily,
    sample,
    10000,
    { ...run.style, bold: !!run.style.bold || deco.includes('b'), italic: deco.includes('i') },
    run.lineHeight,
  ).naturalWidth
}

function lineShift(run: FlowRun, line: number): number {
  if (!run.ink || !run.align || run.align === 'left') return 0
  let used = 0
  for (const piece of run.ink) {
    if (piece.line === line) used = Math.max(used, piece.x + piece.width)
  }
  return run.align === 'center' ? Math.max(0, (run.width - used) / 2) : Math.max(0, run.width - used)
}

function stemGlyphs(run: FlowRun, page: number, fontFamily: string): Glyph[] {
  const fontSize = run.style.fontSize
  const step = run.ink?.length ? (run.inkStep ?? fontSize * run.lineHeight) : fontSize * run.lineHeight
  if (run.ink?.length) {
    const glyphs: Glyph[] = []
    for (const piece of run.ink) {
      if (piece.ruby || !piece.text) continue
      const y = run.y + piece.line * step
      const origin = run.x + piece.x + lineShift(run, piece.line)
      let consumed = ''
      for (const ch of piece.text) {
        glyphs.push({
          ch,
          x: origin + charWidth(fontFamily, run, consumed, piece.deco),
          y,
          w: charWidth(fontFamily, run, ch, piece.deco),
          h: fontSize,
          fontSize,
          page,
        })
        consumed += ch
      }
    }
    return glyphs
  }
  if (run.vertical) {
    return run.text.split('\n').map((ch, index) => ({
      ch,
      x: run.x,
      y: run.y + index * step,
      w: run.width,
      h: step,
      fontSize,
      page,
    }))
  }
  const pieces = layoutRichLines(run.text, run.colors, run.width, (sample, deco) => charWidth(fontFamily, run, sample, deco), run.decos)
  const glyphs: Glyph[] = []
  for (const piece of pieces) {
    let consumed = ''
    const y = run.y + piece.line * step
    for (const ch of piece.text) {
      glyphs.push({
        ch,
        x: run.x + piece.x + charWidth(fontFamily, run, consumed, piece.deco),
        y,
        w: charWidth(fontFamily, run, ch, piece.deco),
        h: fontSize,
        fontSize,
        page,
      })
      consumed += ch
    }
  }
  return glyphs
}

function stemGlyphList(blocks: PlacedBlock[], fontFamily: string): Glyph[] {
  const glyphs: Glyph[] = []
  for (const block of blocks) {
    for (const run of block.runs) {
      if (isStemKey(run.key)) glyphs.push(...stemGlyphs(run, block.page, fontFamily))
    }
  }
  return glyphs
}

/** 方格裡寫國字，注音留白的虛線框裡寫注音。座標對齊卷面上的那一格。 */
function rubySlots(blocks: PlacedBlock[]): { boxes: Slot[]; readings: (Slot & { reading: string })[] } {
  const boxes: Slot[] = []
  const readings: (Slot & { reading: string })[] = []
  for (const block of blocks) {
    for (const run of block.runs) {
      if (!run.ink?.length) continue
      const fontSize = run.style.fontSize
      const step = run.inkStep ?? fontSize * run.lineHeight
      for (const piece of run.ink) {
        const face = piece.ruby?.face
        if (!piece.ruby || (face !== 'box' && face !== 'blank')) continue
        const place = rubyPlace(fontSize, step, face, piece.ruby.reading)
        const x0 = run.x + piece.x + lineShift(run, piece.line)
        const y0 = run.y + piece.line * step
        if (place.box) {
          boxes.push({
            page: block.page,
            x: x0 + place.box.x,
            y: y0 + place.box.y,
            w: place.box.w,
            h: place.box.h,
            fontSize,
          })
          continue
        }
        if (!place.blank) continue
        readings.push({
          page: block.page,
          x: x0 + place.blank.x,
          y: y0 + place.blank.y,
          w: place.blank.w,
          h: place.blank.h,
          fontSize,
          reading: piece.ruby.reading,
        })
      }
    }
  }
  return { boxes, readings }
}

function fittedText(slot: Slot, text: string, fontFamily: string, size: number): AnswerTextMark {
  let fontSize = size
  let natural = measureText(fontFamily, text, 10000, { fontSize, fill: ANSWER_INK }, 1).naturalWidth
  while (natural > slot.w * 0.94 && fontSize > 8) {
    fontSize = Math.round(fontSize * 0.9)
    natural = measureText(fontFamily, text, 10000, { fontSize, fill: ANSWER_INK }, 1).naturalWidth
  }
  return textMark(
    slot.page,
    slot.x,
    slot.y + Math.max(0, (slot.h - fontSize) / 2),
    Math.max(slot.w, fontSize),
    text,
    fontSize,
    1,
    fontFamily,
    false,
    'center',
  )
}

function marksInBoxes(slots: Slot[], answer: string, fontFamily: string): AnswerTextMark[] {
  const chars = [...answer.replace(/[\s　]/g, '')]
  return slots.flatMap((slot, index) => {
    const ch = chars[index]
    if (!ch) return []
    const size = Math.min(slot.fontSize * 0.92, slot.w * 0.72, slot.h * 0.72)
    return [fittedText(slot, ch, fontFamily, size)]
  })
}

function readingParts(answer: string, slots: { reading: string }[]): string[] {
  const parts = answer
    .trim()
    .split(/[\s　、,，]+/)
    .map((part) => part.trim())
    .filter(Boolean)
  if (parts.length === slots.length) return parts
  const compact = (value: string) => value.replace(/[\s　、,，]/g, '')
  const markup = slots.map((slot) => slot.reading)
  if (markup.every(Boolean) && compact(answer) === compact(markup.join(''))) return markup
  if (parts.length === 1 && markup.every((reading) => compact(reading).length > 0)) {
    let rest = compact(parts[0])
    const out = markup.map((reading) => {
      const n = compact(reading).length
      const slice = rest.slice(0, n)
      rest = rest.slice(n)
      return slice
    })
    if (!rest && out.every(Boolean)) return out
  }
  return parts.length === slots.length ? parts : []
}

function marksInReadings(slots: (Slot & { reading: string })[], answer: string, fontFamily: string): AnswerTextMark[] {
  const parts = readingParts(answer, slots)
  if (parts.length !== slots.length) return []
  const marks: AnswerTextMark[] = []
  slots.forEach((slot, index) => {
    const split = splitRubyReading(parts[index])
    const letters = split.letters.length ? split.letters : [...parts[index]]
    const innerW = slot.w * 0.82
    const innerH = slot.h * 0.78
    const letter = Math.min(slot.fontSize * 0.62, innerH / Math.max(1, letters.length * 1.05), innerW / 2.05)
    const pitch = letter * 1.05
    const stack = letters.length * pitch
    const groupW = split.tone ? letter * 1.94 : letter * 1.15
    const x0 = slot.x + Math.max(0, (slot.w - groupW) / 2)
    const y0 = slot.y + Math.max(0, (slot.h - stack) / 2)
    letters.forEach((ch, i) => {
      marks.push(textMark(slot.page, x0, y0 + i * pitch, letter * 1.15, ch, letter, 1, fontFamily, false, 'center'))
    })
    if (split.tone) {
      marks.push(
        textMark(
          slot.page,
          x0 + letter * 1.02,
          y0 + (stack - letter * 0.92) / 2,
          letter,
          split.tone,
          letter * 0.9,
          1,
          fontFamily,
          false,
          'left',
        ),
      )
    }
  })
  return marks
}

type ParenGroup = { open: Glyph; close: Glyph; interior: Glyph[] }

function parenGroups(glyphs: Glyph[]): ParenGroup[] {
  const groups: ParenGroup[] = []
  for (let i = 0; i < glyphs.length; i++) {
    if (!PAREN_OPEN.has(glyphs[i].ch)) continue
    let j = i + 1
    while (j < glyphs.length && !PAREN_CLOSE.has(glyphs[j].ch) && !PAREN_OPEN.has(glyphs[j].ch)) j += 1
    if (j >= glyphs.length || !PAREN_CLOSE.has(glyphs[j].ch)) continue
    groups.push({ open: glyphs[i], close: glyphs[j], interior: glyphs.slice(i + 1, j) })
    i = j
  }
  return groups
}

function sameLine(a: Glyph, b: Glyph): boolean {
  return Math.abs(a.y - b.y) < 1
}

function slotBetween(open: Glyph, close: Glyph, interior: Glyph[], fontSize: number): Slot {
  if (sameLine(open, close) && close.x >= open.x) {
    const x = open.x + open.w
    const w = Math.max(fontSize * 0.8, close.x - x)
    return { page: open.page, x, y: open.y, w, h: fontSize, fontSize }
  }
  const body = interior.length ? interior : [open]
  const x = Math.min(...body.map((glyph) => glyph.x))
  const y = Math.min(...body.map((glyph) => glyph.y))
  const right = Math.max(...body.map((glyph) => glyph.x + glyph.w))
  const bottom = Math.max(...body.map((glyph) => glyph.y + glyph.h))
  return { page: open.page, x, y, w: Math.max(fontSize, right - x), h: bottom - y, fontSize }
}

function answerChunks(answer: string, count: number): string[] {
  const trimmed = answer.trim()
  if (count <= 1) return [trimmed]
  const byMark = trimmed
    .split(/[、,，]/)
    .map((part) => part.trim())
    .filter(Boolean)
  if (byMark.length === count) return byMark
  const bySpace = trimmed.split(/[\s　]+/).filter(Boolean)
  if (bySpace.length === count) return bySpace
  const chars = [...trimmed.replace(/[\s　]/g, '')]
  if (chars.length === count) return chars
  return []
}

/** 底線、（　　）裡寫答案。括號裡是選項時改成圈起來，不另畫一塊蓋住題目。 */
function marksInBlanks(blocks: PlacedBlock[], answer: string, fontFamily: string): AnswerMark[] {
  const glyphs = stemGlyphList(blocks, fontFamily)
  if (!glyphs.length) return []
  const groups = parenGroups(glyphs)
  const rings: AnswerMark[] = []
  const blanks: Slot[] = []
  for (const group of groups) {
    const text = group.interior.map((glyph) => glyph.ch).join('')
    if (group.interior.every((glyph) => BLANK_SPACE.has(glyph.ch))) {
      blanks.push(slotBetween(group.open, group.close, group.interior, group.open.fontSize))
      continue
    }
    const options = text.split('、')
    if (options.length < 2) continue
    let cursor = 0
    for (const option of options) {
      const optionGlyphs = group.interior.slice(cursor, cursor + [...option].length)
      cursor += [...option].length + 1
      if (optionGlyphs.length && option.trim() && option.trim() === answer.trim()) {
        const size = optionGlyphs[0].fontSize
        const x1 = Math.min(...optionGlyphs.map((glyph) => glyph.x))
        const x2 = Math.max(...optionGlyphs.map((glyph) => glyph.x + glyph.w))
        const y = optionGlyphs[0].y
        rings.push({
          kind: 'ring',
          page: optionGlyphs[0].page,
          x: (x1 + x2) / 2,
          y: y + size * 0.48,
          rx: (x2 - x1) / 2 + size * 0.12,
          ry: size * 0.52,
        })
      }
    }
  }
  if (rings.length) return rings

  let start = -1
  const closeUnderscore = (end: number) => {
    const count = start < 0 ? 0 : end - start
    if (count >= 2) {
      const slice = glyphs.slice(start, end)
      const x = Math.min(...slice.map((glyph) => glyph.x))
      const y = Math.min(...slice.map((glyph) => glyph.y))
      const right = Math.max(...slice.map((glyph) => glyph.x + glyph.w))
      blanks.push({
        page: slice[0].page,
        x,
        y,
        w: right - x,
        h: slice[0].fontSize,
        fontSize: slice[0].fontSize,
      })
    }
    start = -1
  }
  glyphs.forEach((glyph, index) => {
    const blank = glyph.ch === '＿' || glyph.ch === '_'
    if (blank && start < 0) start = index
    if (!blank) closeUnderscore(index)
  })
  closeUnderscore(glyphs.length)

  blanks.sort((a, b) => a.y - b.y || a.x - b.x)
  const chunks = answerChunks(answer, blanks.length)
  if (!chunks.length || chunks.length !== blanks.length) return []
  return blanks.map((slot, index) => fittedText(slot, chunks[index], fontFamily, slot.fontSize * 0.9))
}

function answerRules(block: PlacedBlock): FlowRule[] {
  return block.rules.filter(isAnswerRule)
}

function marksOnRules(
  block: PlacedBlock,
  answer: string,
  fontSize: number,
  lineHeight: number,
  fontFamily: string,
): AnswerMark[] {
  const rules = answerRules(block)
  if (!rules.length) return []
  const horizontal = rules.filter((rule) => Math.abs(rule.x2 - rule.x1) >= Math.abs(rule.y2 - rule.y1))
  if (horizontal.length) {
    const ordered = [...horizontal].sort((a, b) => a.y1 - b.y1)
    const konvaLine = lineHeight * 1.25
    const x1 = Math.min(...ordered.map((rule) => Math.min(rule.x1, rule.x2)))
    const x2 = Math.max(...ordered.map((rule) => Math.max(rule.x1, rule.x2)))
    const y = ordered[0].y1 - fontSize * konvaLine
    return [
      textMark(block.page, x1 + 4, y, Math.max(24, x2 - x1 - 8), answer, fontSize, konvaLine, fontFamily, false),
    ]
  }
  const columns = [...rules].sort((a, b) => b.x1 - a.x1)
  const glyphs = [...answer.trim()].filter((ch) => ch !== '\n').map((ch) => toVerticalGlyph(ch))
  const step = fontSize * lineHeight
  const marks: AnswerMark[] = []
  let cursor = 0
  for (const column of columns) {
    const room = Math.max(1, Math.floor(Math.abs(column.y2 - column.y1) / step))
    const slice = glyphs.slice(cursor, cursor + room)
    cursor += slice.length
    if (!slice.length) break
    const top = Math.min(column.y1, column.y2)
    marks.push(
      textMark(
        block.page,
        column.x1 - fontSize / 2,
        top,
        fontSize,
        slice.join('\n'),
        fontSize,
        lineHeight,
        fontFamily,
        false,
        'center',
        true,
      ),
    )
  }
  return marks
}

function questionMarks(
  section: Section,
  question: Question,
  blocks: PlacedBlock[],
  fontFamily: string,
): AnswerMark[] {
  const answer = question.answer.trim()
  if (!answer || !blocks.length) return []
  const ordered = [...blocks].sort(byReadingOrder)
  const { fontSize, lineHeight } = textStyleOf(ordered)
  const vertical = ordered.some((block) => block.runs.some((run) => run.vertical))

  if (isChoiceType(question.type)) {
    const rings = choiceHits(question)
      .map((index) => findChoiceRing(ordered, index, fontFamily))
      .filter((mark): mark is AnswerMark => mark != null)
    if (rings.length) return rings
  }

  const ruby = rubySlots(ordered)
  if (ruby.boxes.length) return marksInBoxes(ruby.boxes, answer, fontFamily)
  if (ruby.readings.length) {
    const readings = marksInReadings(ruby.readings, answer, fontFamily)
    if (readings.length) return readings
  }

  const blanks = marksInBlanks(ordered, answer, fontFamily)
  if (blanks.length) return blanks

  const ruled = ordered.find((block) => answerRules(block).length)
  if (ruled) return marksOnRules(ruled, answer, fontSize, lineHeight, fontFamily)

  const host = ordered[ordered.length - 1]
  if (!vertical && question.type === 'short_answer' && question.answerLines > 0) {
    const stem = [...host.runs].reverse().find((run) => isStemKey(run.key))
    const x = stem?.x ?? host.box.x
    const width = stem?.width ?? host.box.w
    const y = contentBottom(host) + 2
    return [textMark(host.page, x, y, width, answer, fontSize, lineHeight, fontFamily, false)]
  }

  if (!vertical && section.layout === 'rows') {
    const aside = (question.aside ?? '').trim()
    const contentW = aside ? asideLeftEdge(host.box.w, questionAsideWidth(question)) : host.box.w
    const width = Math.max(fontSize * 2, contentW - 12)
    const draft = textMark(host.page, host.box.x + 6, host.box.y, width, answer, fontSize, lineHeight, fontFamily, false)
    const y = Math.max(host.box.y + 2, host.box.y + host.box.h - draft.h - 4)
    return [{ ...draft, y }]
  }

  return []
}

/** 這一頁要印上的答案。選擇題圈選項，國字進方格，注音進虛線框，其餘寫進（ ）或底線。 */
export function answerMarks(
  exam: ExamContent,
  blocks: PlacedBlock[],
  page: number,
  fontFamily: string,
): AnswerMark[] {
  const byQuestion = new Map<string, PlacedBlock[]>()
  for (const block of blocks) {
    if (block.ref.kind !== 'question') continue
    const list = byQuestion.get(block.ref.id)
    if (list) list.push(block)
    else byQuestion.set(block.ref.id, [block])
  }
  const marks: AnswerMark[] = []
  for (const [id, group] of byQuestion) {
    const hit = locate(exam, id)
    if (!hit) continue
    for (const mark of questionMarks(hit.section, hit.question, group, fontFamily)) {
      if (mark.page === page) marks.push(mark)
    }
  }
  return marks
}
