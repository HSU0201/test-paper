/** 國字右側直排注音的寬度與換行。沒有這種標記的句子不走這裡。 */
import { hasRubyMarkup, inkAtoms, type RubyFace } from './richText'
import { textAtoms } from './zhuyin'

const TONE_MARK = new Set(['\u02c7', '\u02c9', '\u02ca', '\u02cb', '\u02d9'])

export type InkPiece = {
  text: string
  color: string
  x: number
  line: number
  width: number
  ruby?: { face: RubyFace; han: string; reading: string }
}

export type RubyMetrics = {
  letters: string[]
  tone: string
  letter: number
  pitch: number
  stack: number
  /** 國字或方格的寬。方格是給手寫的正方形，比正文大。 */
  base: number
  mid: number
  width: number
  /** 注音留白的虛線框。不是這種空格時為 0。 */
  slotW: number
  slotH: number
}

/** 學生要在裡面寫字，空格要比正文字大一圈。 */
const WRITE = 1.72

export function splitRubyReading(reading: string): { letters: string[]; tone: string } {
  const letters: string[] = []
  let tone = ''
  for (const ch of reading) {
    if (TONE_MARK.has(ch)) tone = ch
    else letters.push(ch)
  }
  return { letters, tone }
}

/** 一格的寬度。方格比正文大，注音留白的虛線框也要比印出來的注音高、寬。 */
export function rubyAdvance(fontSize: number, face: RubyFace, reading: string): RubyMetrics {
  const split = splitRubyReading(reading)
  const letters = split.letters.length ? split.letters : ['·']
  const letter = fontSize * 0.48
  const pitch = letter * 1.05
  const stack = letters.length * pitch
  const write = fontSize * WRITE
  const toneW = split.tone ? letter * 0.85 : 0
  const colW = letter * 1.05 + toneW
  const base = face === 'box' ? write : face === 'reading' ? 0 : fontSize
  const mid = face === 'reading' ? 0 : fontSize * (face === 'box' ? 0.24 : 0.2)
  const slotW = face === 'blank' ? Math.max(fontSize * 1.45, colW + fontSize * 0.55) : 0
  const slotH = face === 'blank' ? Math.max(write, stack + fontSize * 0.62) : 0
  const rubyCol = face === 'blank' ? slotW : colW
  const tail = face === 'reading' ? fontSize * 0.62 : fontSize * (face === 'blank' ? 0.3 : 0.36)
  return {
    letters,
    tone: split.tone,
    letter,
    pitch,
    stack,
    base,
    mid,
    width: base + mid + rubyCol + tail,
    slotW,
    slotH,
  }
}

/** 方格、國字、注音虛線框在一行裡的位置。畫卷和印答案都用這一份。 */
export function rubyPlace(fontSize: number, lineStep: number, face: RubyFace, reading: string) {
  const adv = rubyAdvance(fontSize, face, reading)
  const hanH = face === 'box' ? adv.base : fontSize
  const sideH = face === 'blank' ? adv.slotH : adv.stack
  const blockH = Math.max(hanH, sideH)
  const top = Math.max(0, (lineStep - blockH) / 2)
  const pad = Math.max(1.25, fontSize * 0.08)
  const baseY = top + (blockH - hanH) / 2
  const sideY = top + (blockH - sideH) / 2
  const colX = adv.base + adv.mid
  return {
    adv,
    pad,
    baseY,
    sideY,
    colX,
    box:
      face === 'box'
        ? { x: pad, y: baseY + pad, w: Math.max(4, adv.base - pad * 2), h: Math.max(4, adv.base - pad * 2) }
        : null,
    blank: face === 'blank' ? { x: colX, y: sideY, w: adv.slotW, h: adv.slotH } : null,
  }
}

type Unit =
  | { kind: 'text'; text: string; color: string; width: number }
  | { kind: 'ruby'; face: RubyFace; han: string; reading: string; color: string; width: number }

export function layoutRubyRun(
  input: string,
  width: number,
  fontSize: number,
  lineHeight: number,
  measure: (sample: string) => number,
): { pieces: InkPiece[]; height: number; lineCount: number; step: number } {
  if (!hasRubyMarkup(input)) {
    return { pieces: [], height: 0, lineCount: 0, step: fontSize * lineHeight }
  }
  const units: Unit[] = []
  let tallest = fontSize
  for (const atom of inkAtoms(input)) {
    if (atom.kind === 'ruby') {
      const adv = rubyAdvance(fontSize, atom.face, atom.reading)
      tallest = Math.max(tallest, adv.stack, adv.base, adv.slotH, fontSize)
      units.push({
        kind: 'ruby',
        face: atom.face,
        han: atom.han,
        reading: atom.reading,
        color: atom.color ?? '',
        width: adv.width,
      })
      continue
    }
    for (const piece of textAtoms(atom.text)) {
      units.push({
        kind: 'text',
        text: piece,
        color: atom.color ?? '',
        width: piece === '\n' ? 0 : measure(piece),
      })
    }
  }
  const step = Math.max(fontSize * lineHeight, tallest + fontSize * 0.08)
  const pieces: InkPiece[] = []
  let line = 0
  let x = 0
  let buf = ''
  let bufColor = ''
  let bufX = 0
  let bufW = 0
  const flush = () => {
    if (!buf) return
    pieces.push({ text: buf, color: bufColor, x: bufX, line, width: bufW })
    buf = ''
    bufW = 0
  }
  const breakLine = () => {
    flush()
    line += 1
    x = 0
  }
  for (const unit of units) {
    if (unit.kind === 'text' && unit.text === '\n') {
      breakLine()
      continue
    }
    if (x > 0 && x + unit.width > width + 0.5) breakLine()
    if (unit.kind === 'ruby') {
      flush()
      pieces.push({
        text: '',
        color: unit.color,
        x,
        line,
        width: unit.width,
        ruby: { face: unit.face, han: unit.han, reading: unit.reading },
      })
      x += unit.width
      continue
    }
    if (buf && unit.color !== bufColor) flush()
    if (!buf) {
      bufX = x
      bufColor = unit.color
    }
    buf += unit.text
    bufW += unit.width
    x += unit.width
  }
  flush()
  const lineCount = pieces.length ? Math.max(...pieces.map((p) => p.line)) + 1 : 0
  return { pieces, height: Math.max(lineCount, 1) * step, lineCount: Math.max(lineCount, 1), step }
}
