/** 考卷內文的局部上色、換成注音，以及國字右側的直排注音。標記只存在資料裡。 */
import { readingsFor } from './hanToZhuyin'
import { textAtoms } from './zhuyin'

const OPEN = /^\{\{#([0-9a-fA-F]{6})\}\}/
const CLOSE = '{{/}}'
const ZY = /^\{\{z:([^|}]+)\|([^}]*)\}\}/
const RUBY = /^\{\{y([brn])?:([^|}]+)\|([^}]*)\}\}/
const TONE_MARK = new Set(['\u02c7', '\u02c9', '\u02ca', '\u02cb', '\u02d9'])

export type RichChar = { ch: string; color?: string }

/** char：國字＋注音。box：方格＋注音。reading：只留注音。blank：國字＋注音留白，給學生書寫。 */
export type RubyFace = 'char' | 'box' | 'reading' | 'blank'

type Seg =
  | { kind: 'ch'; ch: string; color?: string }
  | { kind: 'zy'; han: string; reading: string; color?: string }
  | { kind: 'ruby'; face: RubyFace; han: string; reading: string; color?: string }

function rubyFace(mark: string | undefined): RubyFace {
  if (mark === 'b') return 'box'
  if (mark === 'r') return 'reading'
  if (mark === 'n') return 'blank'
  return 'char'
}

function rubyMark(face: RubyFace): string {
  if (face === 'box') return 'yb'
  if (face === 'reading') return 'yr'
  if (face === 'blank') return 'yn'
  return 'y'
}

/** 畫面上這一格佔幾個字。方格和國字算 1，只留注音時算注音的字數。 */
function rubyShown(face: RubyFace, han: string, reading: string): string {
  if (face === 'box') return '□'
  if (face === 'reading') return reading || han
  return han
}

function parseSegments(input: string): Seg[] {
  const out: Seg[] = []
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
    const ruby = RUBY.exec(input.slice(i))
    if (ruby) {
      out.push({ kind: 'ruby', face: rubyFace(ruby[1]), han: ruby[2], reading: ruby[3], color })
      i += ruby[0].length
      continue
    }
    const zy = ZY.exec(input.slice(i))
    if (zy) {
      out.push({ kind: 'zy', han: zy[1], reading: zy[2], color })
      i += zy[0].length
      continue
    }
    const cp = input.codePointAt(i)!
    const ch = String.fromCodePoint(cp)
    out.push({ kind: 'ch', ch, color })
    i += ch.length
  }
  return out
}

export function hasZhuyinMarkup(input: string): boolean {
  return input.includes('{{z:')
}

export function hasRubyMarkup(input: string): boolean {
  return /\{\{y[brn]?:/.test(input)
}

export type InkAtom =
  | { kind: 'text'; text: string; color?: string }
  | { kind: 'ruby'; face: RubyFace; han: string; reading: string; color?: string }

/** 一般字連成一段；右側注音每一格單獨一段，給排版量寬度。 */
export function inkAtoms(input: string): InkAtom[] {
  const out: InkAtom[] = []
  let buf = ''
  let color: string | undefined
  let prevZy = false
  const flush = () => {
    if (!buf) return
    out.push(color ? { kind: 'text', text: buf, color } : { kind: 'text', text: buf })
    buf = ''
  }
  const pushText = (text: string, next?: string) => {
    if (!text) return
    if (next !== color) {
      flush()
      color = next
    }
    buf += text
  }
  for (const seg of parseSegments(input)) {
    if (seg.kind === 'ruby') {
      flush()
      out.push({
        kind: 'ruby',
        face: seg.face,
        han: seg.han,
        reading: seg.reading,
        ...(seg.color ? { color: seg.color } : {}),
      })
      prevZy = false
      continue
    }
    if (seg.kind === 'zy') {
      const reading = seg.reading || seg.han
      pushText(prevZy && reading ? ` ${reading}` : reading, seg.color)
      prevZy = Boolean(reading)
      continue
    }
    prevZy = false
    pushText(seg.ch, seg.color)
  }
  flush()
  return out
}

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

/** 拆成畫面上的一個字一個顏色。注音標記會展開成注音，相鄰音節中間補一個空格。 */
export function richChars(input: string): RichChar[] {
  const out: RichChar[] = []
  let prevZy = false
  for (const seg of parseSegments(input)) {
    if (seg.kind === 'ruby') {
      prevZy = false
      for (const ch of rubyShown(seg.face, seg.han, seg.reading)) {
        out.push(seg.color ? { ch, color: seg.color } : { ch })
      }
      continue
    }
    if (seg.kind === 'zy') {
      const reading = seg.reading || seg.han
      if (prevZy && reading) out.push({ ch: ' ' })
      for (const ch of reading) out.push(seg.color ? { ch, color: seg.color } : { ch })
      prevZy = Boolean(reading)
      continue
    }
    out.push(seg.color ? { ch: seg.ch, color: seg.color } : { ch: seg.ch })
    prevZy = false
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

/** 橫排換行：同一行、同一色的字合成一段，x 是該段在行內的起點。有注音時以音節為單位。 */
export function layoutRichLines(
  text: string,
  colors: string[] | undefined,
  width: number,
  measure: (sample: string) => number,
): RichPiece[] {
  const pieces: RichPiece[] = []
  let line = 0
  let lineText = ''
  let buf = ''
  let bufColor = ''
  let index = 0
  const flush = () => {
    if (!buf) return
    pieces.push({ text: buf, color: bufColor, x: measure(lineText), line })
    lineText += buf
    buf = ''
  }
  for (const atom of textAtoms(text)) {
    if (atom === '\n') {
      flush()
      line += 1
      lineText = ''
      index += 1
      continue
    }
    if (lineText + buf && measure(lineText + buf + atom) > width + 0.5) {
      flush()
      line += 1
      lineText = ''
    }
    for (const ch of atom) {
      const color = colors?.[index] || ''
      index += 1
      if (buf && color !== bufColor) flush()
      bufColor = color
      buf += ch
    }
  }
  flush()
  return pieces
}

function splitTone(reading: string): { letters: string[]; tone: string } {
  const letters: string[] = []
  let tone = ''
  for (const ch of reading) {
    if (TONE_MARK.has(ch)) tone = ch
    else letters.push(ch)
  }
  return { letters, tone }
}

function rubyHtml(face: RubyFace, han: string, reading: string): string {
  const { letters, tone } = splitTone(reading)
  const lettersHtml = (letters.length ? letters : ['·']).map((ch) => escapeHtml(ch)).join('<br>')
  const toneHtml = tone ? `<span class="ruby__tone">${escapeHtml(tone)}</span>` : ''
  const base = face === 'char' || face === 'blank' ? escapeHtml(han) : ''
  const title = face === 'blank' ? ' title="卷上只留空位，不印出注音"' : ''
  return `<span class="ruby ruby--${face}" contenteditable="false"${title} data-face="${face}" data-han="${escapeAttr(han)}" data-reading="${escapeAttr(reading)}"><span class="ruby__base">${base}</span><span class="ruby__ann"><span class="ruby__letters">${lettersHtml}</span>${toneHtml}</span></span>`
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, '&quot;')
}

export function markupToHtml(input: string): string {
  let html = ''
  let buf = ''
  let color = ''
  let prevZy = false
  const flush = () => {
    if (!buf) return
    const body = escapeHtml(buf).replace(/\n/g, '<br>')
    html += color ? `<span style="color:${color}">${body}</span>` : body
    buf = ''
  }
  for (const seg of parseSegments(input)) {
    if (seg.kind === 'ruby') {
      flush()
      const span = rubyHtml(seg.face, seg.han, seg.reading)
      const ink = seg.color ?? ''
      html += ink ? `<span style="color:${ink}">${span}</span>` : span
      prevZy = false
      color = ''
      continue
    }
    if (seg.kind === 'zy') {
      flush()
      const reading = seg.reading || seg.han
      if (prevZy && reading) html += ' '
      const span = `<span class="zy" data-han="${escapeAttr(seg.han)}" title="${escapeAttr(seg.han)}">${escapeHtml(reading)}</span>`
      const ink = seg.color ?? ''
      html += ink ? `<span style="color:${ink}">${span}</span>` : span
      prevZy = Boolean(reading)
      color = ''
      continue
    }
    prevZy = false
    const next = seg.color ?? ''
    if (next !== color) flush()
    color = next
    buf += seg.ch
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

/**
 * 把色盤編輯器的 HTML 存回標記。黑色不寫進標記。
 * 瀏覽器用 `<div><br></div>` 表示空行；區塊本身已經換行，裡面的 br 不再多算一行。
 */
export function htmlToMarkup(root: HTMLElement): string {
  const lines: string[] = ['']
  let seenBlock = false
  const pushText = (t: string, color: string | null) => {
    if (!t) return
    lines[lines.length - 1] += color ? `{{#${color.slice(1)}}}${t}{{/}}` : t
  }
  const edgeIsZy = (node: Node | null, dir: 'prev' | 'next'): boolean => {
    let n = node
    while (n) {
      if (n.nodeType === Node.TEXT_NODE) {
        if ((n.textContent ?? '').replace(/\u00a0/g, ' ').trim() !== '') return false
        n = dir === 'prev' ? n.previousSibling : n.nextSibling
        continue
      }
      if (n.nodeType !== Node.ELEMENT_NODE) return false
      const el = n as HTMLElement
      if (el.dataset.han) return true
      if (el.tagName === 'BR') return false
      const child = dir === 'prev' ? el.lastChild : el.firstChild
      if (!child) {
        n = dir === 'prev' ? n.previousSibling : n.nextSibling
        continue
      }
      n = child
    }
    return false
  }
  const walk = (node: Node, color: string | null) => {
    if (node.nodeType === Node.TEXT_NODE) {
      let t = (node.textContent ?? '').replace(/\u00a0/g, ' ')
      if (
        t === ' ' &&
        edgeIsZy(node.previousSibling, 'prev') &&
        edgeIsZy(node.nextSibling, 'next')
      ) {
        t = ''
      }
      pushText(t, color)
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return
    const el = node as HTMLElement
    if (el.tagName === 'BR') {
      lines.push('')
      return
    }
    if (el.classList.contains('ruby')) {
      const face = el.dataset.face === 'box' ? 'b' : el.dataset.face === 'reading' ? 'r' : el.dataset.face === 'blank' ? 'n' : ''
      const han = (el.dataset.han ?? '').replace(/[|}]/g, '')
      const reading = (el.dataset.reading ?? '').replace(/[|}]/g, '')
      if (han) pushText(`{{y${face}:${han}|${reading}}}`, color)
      return
    }
    if (el.dataset.han) {
      const han = el.dataset.han.replace(/[|}]/g, '')
      const shown = (el.textContent ?? '').replace(/\u00a0/g, ' ').replace(/}/g, '').trim()
      if (han) pushText(shown ? `{{z:${han}|${shown}}}` : han, color)
      return
    }
    const next = readColor(el) ?? color
    const block = el.tagName === 'DIV' || el.tagName === 'P'
    if (!block) {
      el.childNodes.forEach((child) => walk(child, next))
      return
    }
    const atStart = !seenBlock && lines.length === 1 && lines[0] === ''
    if (!atStart) lines.push('')
    seenBlock = true
    const onlyBr =
      el.childNodes.length === 1 &&
      el.childNodes[0].nodeType === Node.ELEMENT_NODE &&
      (el.childNodes[0] as HTMLElement).tagName === 'BR'
    if (onlyBr) return
    el.childNodes.forEach((child) => walk(child, next))
  }
  root.childNodes.forEach((child) => walk(child, null))
  return lines.join('\n')
}

type Placed = Seg & { start: number; len: number; gap?: boolean }

function placeSegments(segs: Seg[]): Placed[] {
  const out: Placed[] = []
  let n = 0
  let prevZy = false
  for (const seg of segs) {
    if (seg.kind === 'ruby') {
      const len = Math.max(1, [...rubyShown(seg.face, seg.han, seg.reading)].length)
      out.push({ ...seg, start: n, len })
      n += len
      prevZy = false
      continue
    }
    if (seg.kind === 'zy') {
      const reading = seg.reading || seg.han
      if (prevZy && reading) {
        out.push({ kind: 'ch', ch: ' ', start: n, len: 1, gap: true })
        n += 1
      }
      const len = [...reading].length
      out.push({ ...seg, start: n, len })
      n += len
      prevZy = Boolean(reading)
      continue
    }
    out.push({ ...seg, start: n, len: [...seg.ch].length })
    n += [...seg.ch].length
    prevZy = false
  }
  return out
}

function serializeSegments(pieces: Placed[]): string {
  let out = ''
  let color: string | undefined
  const setColor = (next?: string) => {
    if (next === color) return
    if (color) out += CLOSE
    if (next) out += `{{#${next.slice(1)}}}`
    color = next
  }
  for (const piece of pieces) {
    if (piece.gap) continue
    setColor(piece.color)
    if (piece.kind === 'zy') out += `{{z:${piece.han}|${piece.reading}}}`
    else if (piece.kind === 'ruby') out += `{{${rubyMark(piece.face)}:${piece.han}|${piece.reading}}}`
    else out += piece.ch
  }
  if (color) out += CLOSE
  return out
}

function isHan(ch: string): boolean {
  const c = ch.codePointAt(0) ?? 0
  return (c >= 0x3400 && c <= 0x9fff) || (c >= 0xf900 && c <= 0xfaff)
}

function isProtectedFigure(pieces: Placed[], index: number): boolean {
  const piece = pieces[index]
  if (!piece || piece.kind !== 'ch' || piece.ch !== '圖') return false
  const prev = pieces[index - 1]
  const next = pieces[index + 1]
  const open = prev?.kind === 'ch' && (prev.ch === '［' || prev.ch === '[')
  const close = next?.kind === 'ch' && (next.ch === '］' || next.ch === ']')
  return Boolean(open && close)
}

function overlaps(piece: Placed, start: number, end: number): boolean {
  return piece.len > 0 && piece.start < end && piece.start + piece.len > start
}

/** 把畫面上 [start, end) 的國字換成注音，或把注音改回國字。位置以印出來的字為準。 */
export function editZhuyin(input: string, start: number, end: number, mode: 'to-zhuyin' | 'to-han'): string {
  if (end <= start) return input
  const pieces = placeSegments(parseSegments(input))
  if (mode === 'to-han') {
    let changed = false
    const next = pieces.map((piece) => {
      if (piece.kind !== 'zy' || !overlaps(piece, start, end)) return piece
      changed = true
      const han: Placed = { kind: 'ch', ch: piece.han, color: piece.color, start: piece.start, len: [...piece.han].length }
      return han
    })
    return changed ? serializeSegments(next) : input
  }
  const groups: number[][] = []
  let current: number[] = []
  pieces.forEach((piece, index) => {
    const take =
      piece.kind === 'ch' &&
      !piece.gap &&
      overlaps(piece, start, end) &&
      isHan(piece.ch) &&
      !isProtectedFigure(pieces, index)
    if (!take) {
      if (current.length) groups.push(current)
      current = []
      return
    }
    current.push(index)
  })
  if (current.length) groups.push(current)
  if (!groups.length) return input
  const replaced = pieces.slice()
  for (const group of groups) {
    const hans = group.map((index) => (replaced[index] as { ch: string }).ch).join('')
    const readings = readingsFor(hans)
    group.forEach((index, k) => {
      const reading = readings[k]
      const prev = replaced[index]
      if (!reading || prev.kind !== 'ch') return
      replaced[index] = { kind: 'zy', han: prev.ch, reading, color: prev.color, start: prev.start, len: [...reading].length }
    })
  }
  return serializeSegments(replaced)
}

export function convertAllToZhuyin(input: string): string {
  return editZhuyin(input, 0, Number.MAX_SAFE_INTEGER, 'to-zhuyin')
}

export function revertAllZhuyin(input: string): string {
  return editZhuyin(input, 0, Number.MAX_SAFE_INTEGER, 'to-han')
}

export type RubyEdit = 'char' | 'box' | 'reading' | 'blank' | 'plain'

/** 把畫面上 [start, end) 加上右側注音、改印法，或去掉注音。位置以印出來的字為準。 */
export function editRuby(input: string, start: number, end: number, mode: RubyEdit): string {
  if (end <= start) return input
  const pieces = placeSegments(parseSegments(input))
  let changed = false
  if (mode === 'plain') {
    const next = pieces.map((piece) => {
      if (piece.kind !== 'ruby' || !overlaps(piece, start, end)) return piece
      changed = true
      const han: Placed = { kind: 'ch', ch: piece.han, color: piece.color, start: piece.start, len: [...piece.han].length }
      return han
    })
    return changed ? serializeSegments(next) : input
  }
  const replaced = pieces.slice()
  replaced.forEach((piece, index) => {
    if (piece.kind !== 'ruby' || !overlaps(piece, start, end) || piece.face === mode) return
    changed = true
    replaced[index] = { ...piece, face: mode }
  })
  const groups: number[][] = []
  let current: number[] = []
  replaced.forEach((piece, index) => {
    const take =
      piece.kind === 'ch' &&
      !piece.gap &&
      overlaps(piece, start, end) &&
      isHan(piece.ch) &&
      !isProtectedFigure(replaced, index)
    if (!take) {
      if (current.length) groups.push(current)
      current = []
      return
    }
    current.push(index)
  })
  if (current.length) groups.push(current)
  for (const group of groups) {
    const hans = group.map((index) => (replaced[index] as { ch: string }).ch).join('')
    const readings = readingsFor(hans)
    group.forEach((index, k) => {
      const reading = readings[k]
      const prev = replaced[index]
      if (!reading || prev.kind !== 'ch') return
      changed = true
      replaced[index] = {
        kind: 'ruby',
        face: mode,
        han: prev.ch,
        reading,
        color: prev.color,
        start: prev.start,
        len: [...rubyShown(mode, prev.ch, reading)].length,
      }
    })
  }
  return changed ? serializeSegments(replaced) : input
}
