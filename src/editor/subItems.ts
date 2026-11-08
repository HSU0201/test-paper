/**
 * 題目裡的子題號（第三層）。題幹只存 {{n}}，印出時才依順序編號，
 * 中間刪掉或插入一題，後面的號碼會跟著改。
 */
import { plainText, replaceLeadingChars, splitMarkupLines, stripLeadingSub, SUB_TOKEN } from './richText'

/** circled：①②③；paren：(1)(2)(3)；stem：甲、乙、丙、；bopomofo：ㄅ、ㄆ、ㄇ、 */
export type SubStyle = 'circled' | 'paren' | 'stem' | 'bopomofo'

export const SUB_STYLES: SubStyle[] = ['circled', 'paren', 'stem', 'bopomofo']

export const SUB_STYLE_LABEL: Record<SubStyle, string> = {
  circled: '①',
  paren: '(1)',
  stem: '甲、',
  bopomofo: 'ㄅ、',
}

const HEAVENLY = '甲乙丙丁戊己庚辛壬癸'
const BOPOMOFO = 'ㄅㄆㄇㄈㄉㄊㄋㄌㄍㄎㄏㄐㄑㄒㄓㄔㄕㄖㄗㄘㄙㄚㄛㄜㄝㄞㄟㄠㄡㄢㄣㄤㄥㄦㄧㄨㄩ'

export function normalizeSubStyle(raw: unknown): SubStyle | undefined {
  return SUB_STYLES.includes(raw as SubStyle) ? (raw as SubStyle) : undefined
}

export function subStyleOf(q: { subStyle?: SubStyle }): SubStyle {
  return normalizeSubStyle(q.subStyle) ?? 'circled'
}

function circled(n: number): string {
  if (n >= 1 && n <= 20) return String.fromCodePoint(0x2460 + n - 1)
  if (n >= 21 && n <= 35) return String.fromCodePoint(0x3251 + n - 21)
  if (n >= 36 && n <= 50) return String.fromCodePoint(0x32b1 + n - 36)
  return `(${n})`
}

/** 第 n 個子題號（從 1 起算）印出來的樣子 */
export function subLabel(n: number, style: SubStyle): string {
  if (style === 'paren') return `(${n})`
  if (style === 'stem') return n <= HEAVENLY.length ? `${HEAVENLY[n - 1]}、` : `(${n})`
  if (style === 'bopomofo') return n <= BOPOMOFO.length ? `${BOPOMOFO[n - 1]}、` : `(${n})`
  return circled(n)
}

export function hasSubItems(stem: string): boolean {
  return stem.includes(SUB_TOKEN)
}

export function countSubItems(stem: string): number {
  return stem.split(SUB_TOKEN).length - 1
}

/** 子題號換成印出來的文字，給直排、注音格這類不做懸掛縮排的排版用 */
export function resolveSubItems(stem: string, style: SubStyle, from = 1): string {
  if (!hasSubItems(stem)) return stem
  let n = from
  return stem.split(SUB_TOKEN).reduce((out, part, i) => (i === 0 ? part : `${out}${subLabel(n++, style)}${part}`))
}

/** 一段題幹：label 有值時是一個子題，排版時題號靠左、內容懸掛縮排 */
export type SubChunk = { label?: string; text: string }

/**
 * 依子題號把題幹切段。一個子題就是有子題號的那一行，太長自動換行時對齊在號碼後面；
 * 下一行沒有子題號就回到題目本文。不在行首的子題號直接換成文字。
 */
export function subChunks(stem: string, style: SubStyle, from = 1): { chunks: SubChunk[]; next: number } {
  let n = from
  if (!hasSubItems(stem)) return { chunks: [{ text: stem }], next: n }
  const chunks: SubChunk[] = []
  let current: { label?: string; lines: string[] } | null = null
  const close = () => {
    if (current) chunks.push({ ...(current.label ? { label: current.label } : {}), text: current.lines.join('\n') })
    current = null
  }
  for (const line of splitMarkupLines(stem)) {
    const rest = stripLeadingSub(line)
    if (rest != null) {
      close()
      const label = subLabel(n++, style)
      const resolved = resolveSubItems(rest, style, n)
      n += countSubItems(rest)
      current = { label, lines: [resolved] }
      continue
    }
    const resolved = resolveSubItems(line, style, n)
    n += countSubItems(line)
    if (current?.label) close()
    if (!current) current = { lines: [] }
    current.lines.push(resolved)
  }
  close()
  return { chunks, next: n }
}

const TYPED: { style: SubStyle; pattern: RegExp }[] = [
  { style: 'circled', pattern: /^[ 　]*[①-⑳㉑-㉟㊱-㊿][ 　]*/ },
  { style: 'paren', pattern: /^[ 　]*[(（][ 　]*\d{1,2}[ 　]*[)）][ 　]*/ },
  { style: 'stem', pattern: /^[ 　]*[甲乙丙丁戊己庚辛壬癸][ 　]*[、.．][ 　]*/ },
  { style: 'bopomofo', pattern: /^[ 　]*[ㄅ-ㄩ][ 　]*[、.．][ 　]*/ },
]

/**
 * 找出題幹裡自己打的子題號（行首的 ①、(1)、甲、ㄅ、），至少兩行才算。
 * 回傳換成自動子題號後的題幹與樣式；找不到回傳 null。
 */
export function adoptTypedSubItems(stem: string): { stem: string; style: SubStyle } | null {
  if (hasSubItems(stem)) return null
  const lines = splitMarkupLines(stem)
  for (const { style, pattern } of TYPED) {
    const hits = lines.map((line) => pattern.exec(plainText(line)))
    if (hits.filter(Boolean).length < 2) continue
    const next = lines.map((line, i) => {
      const hit = hits[i]
      return hit ? replaceLeadingChars(line, [...hit[0]].length, SUB_TOKEN) : line
    })
    return { stem: next.join('\n'), style }
  }
  return null
}
