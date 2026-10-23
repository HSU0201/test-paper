/**
 * 橫式注音一個音節要留在一起：聲母、介音、韻母、聲調。
 * 輕聲點可以寫在音節前面（˙ㄉㄜ）或後面（ㄉㄜ˙）。
 */

const NEUTRAL = '\u02d9'

function isTone(ch: string): boolean {
  return ch === '\u02c7' || ch === '\u02c9' || ch === '\u02ca' || ch === '\u02cb' || ch === NEUTRAL
}

function isBopomofoLetter(ch: string): boolean {
  const c = ch.codePointAt(0) ?? 0
  return c >= 0x3105 && c <= 0x312f
}

function isInitial(ch: string): boolean {
  const c = ch.codePointAt(0) ?? 0
  return c >= 0x3105 && c <= 0x3119
}

function isMedial(ch: string): boolean {
  const c = ch.codePointAt(0) ?? 0
  return c >= 0x3127 && c <= 0x3129
}

function isFinal(ch: string): boolean {
  const c = ch.codePointAt(0) ?? 0
  return c >= 0x311a && c <= 0x3126
}

export function hasBopomofo(text: string): boolean {
  for (const ch of text) {
    if (isBopomofoLetter(ch)) return true
  }
  return false
}

const BLANK_RUN = /＿{2,}|_{2,}|　{2,}|（[ 　\t]+）|\([ \t]+\)/

/** 有注音，或有不能拆開的作答空格時，改由我們自己換行，不交給逐字換行。 */
export function needsManualWrap(text: string): boolean {
  return hasBopomofo(text) || BLANK_RUN.test(text)
}

/** 從 i 取出一個音節，回傳結束位置（不含）。聲調最多帶一個。 */
function takeSyllable(chars: string[], i: number): number {
  const start = i
  if (i < chars.length && isInitial(chars[i])) i += 1
  if (i < chars.length && isMedial(chars[i])) i += 1
  if (i < chars.length && isFinal(chars[i])) i += 1
  if (i === start && i < chars.length && isBopomofoLetter(chars[i])) i += 1
  if (i < chars.length && isTone(chars[i])) i += 1
  return i
}

/** 作答空格：連續底線，或括號裡只有空白。沒有組成空格時只取一個字。 */
function takeBlank(chars: string[], i: number): number {
  const ch = chars[i]
  if (ch === '＿' || ch === '_' || ch === '　') {
    let j = i + 1
    while (j < chars.length && chars[j] === ch) j += 1
    return j - i >= 2 ? j : i + 1
  }
  if (ch !== '（' && ch !== '(') return i + 1
  const close = ch === '（' ? '）' : ')'
  let j = i + 1
  while (j < chars.length && j - i < 12 && chars[j] !== close) {
    if (chars[j] !== ' ' && chars[j] !== '　' && chars[j] !== '\t') return i + 1
    j += 1
  }
  if (j < chars.length && chars[j] === close && j > i + 1) return j + 1
  return i + 1
}

/**
 * 換行時不可拆開的片段。
 * 沒有注音時，每個字元各自一段，和原本逐字換行相同。
 */
export function textAtoms(text: string): string[] {
  const chars = [...text]
  if (!needsManualWrap(text)) return chars
  const atoms: string[] = []
  let i = 0
  while (i < chars.length) {
    const ch = chars[i]
    if (ch === '\n') {
      atoms.push('\n')
      i += 1
      continue
    }
    if (ch === NEUTRAL && i + 1 < chars.length && isBopomofoLetter(chars[i + 1])) {
      const end = takeSyllable(chars, i + 1)
      atoms.push(chars.slice(i, end).join(''))
      i = end
      continue
    }
    if (isBopomofoLetter(ch)) {
      const end = takeSyllable(chars, i)
      atoms.push(chars.slice(i, end).join(''))
      i = end
      continue
    }
    const end = takeBlank(chars, i)
    atoms.push(chars.slice(i, end).join(''))
    i = end
  }
  return atoms
}

/** 直排時一整個音節盡量留在同一欄。沒有注音則每個字一組。 */
export function clusterUnits<T extends { ch: string }>(units: T[]): T[][] {
  const text = units.map((u) => u.ch).join('')
  if (!needsManualWrap(text)) return units.map((u) => [u])
  const groups: T[][] = []
  let i = 0
  for (const atom of textAtoms(text)) {
    const n = [...atom].length
    groups.push(units.slice(i, i + n))
    i += n
  }
  return groups
}
