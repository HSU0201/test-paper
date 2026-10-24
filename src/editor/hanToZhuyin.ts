/**
 * 國字轉注音。詞庫用 pinyin-pro（含繁體讀音），再把拼音換成注音。
 * 少數台灣教材和詞庫不同的詞，在這裡改成國小常見讀法；轉完仍可在欄位裡直接改注音。
 */
import traditionalDict from '@pinyin-pro/data/traditional'
import { addTraditionalDict, pinyin } from 'pinyin-pro'

let dictReady = false

function ensureDict() {
  if (dictReady) return
  addTraditionalDict(traditionalDict)
  dictReady = true
}

/** 每個字一個帶聲調數字的拼音，例如 ji3、ge0。輕聲是 0。 */
const TW: Record<string, string[]> = {
  一個: ['yi4', 'ge0'],
  兩個: ['liang3', 'ge0'],
  三個: ['san1', 'ge0'],
  四個: ['si4', 'ge0'],
  五個: ['wu3', 'ge0'],
  六個: ['liu4', 'ge0'],
  七個: ['qi1', 'ge0'],
  八個: ['ba1', 'ge0'],
  九個: ['jiu3', 'ge0'],
  十個: ['shi2', 'ge0'],
  幾個: ['ji3', 'ge0'],
  這個: ['zhe4', 'ge0'],
  那個: ['na4', 'ge0'],
  哪個: ['na3', 'ge0'],
  每個: ['mei3', 'ge0'],
  整個: ['zheng3', 'ge0'],
  什麼: ['shen2', 'me0'],
  怎麼: ['zen3', 'me0'],
  垃圾: ['le4', 'se4'],
  還是: ['hai2', 'shi4'],
  還有: ['hai2', 'you3'],
  還要: ['hai2', 'yao4'],
  因為: ['yin1', 'wei4'],
  我們: ['wo3', 'men0'],
  你們: ['ni3', 'men0'],
  他們: ['ta1', 'men0'],
  她們: ['ta1', 'men0'],
  它們: ['ta1', 'men0'],
  謝謝: ['xie4', 'xie0'],
  美麗: ['mei3', 'li4'],
}

const INITIALS = ['zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'r', 'z', 'c', 's']

const INITIAL_MARK: Record<string, string> = {
  b: 'ㄅ',
  p: 'ㄆ',
  m: 'ㄇ',
  f: 'ㄈ',
  d: 'ㄉ',
  t: 'ㄊ',
  n: 'ㄋ',
  l: 'ㄌ',
  g: 'ㄍ',
  k: 'ㄎ',
  h: 'ㄏ',
  j: 'ㄐ',
  q: 'ㄑ',
  x: 'ㄒ',
  zh: 'ㄓ',
  ch: 'ㄔ',
  sh: 'ㄕ',
  r: 'ㄖ',
  z: 'ㄗ',
  c: 'ㄘ',
  s: 'ㄙ',
}

const FINALS: Record<string, string> = {
  a: 'ㄚ',
  o: 'ㄛ',
  e: 'ㄜ',
  ai: 'ㄞ',
  ei: 'ㄟ',
  ao: 'ㄠ',
  ou: 'ㄡ',
  an: 'ㄢ',
  en: 'ㄣ',
  ang: 'ㄤ',
  eng: 'ㄥ',
  i: 'ㄧ',
  ia: 'ㄧㄚ',
  ie: 'ㄧㄝ',
  iao: 'ㄧㄠ',
  iu: 'ㄧㄡ',
  ian: 'ㄧㄢ',
  in: 'ㄧㄣ',
  iang: 'ㄧㄤ',
  ing: 'ㄧㄥ',
  u: 'ㄨ',
  ua: 'ㄨㄚ',
  uo: 'ㄨㄛ',
  uai: 'ㄨㄞ',
  ui: 'ㄨㄟ',
  uan: 'ㄨㄢ',
  un: 'ㄨㄣ',
  uang: 'ㄨㄤ',
  ueng: 'ㄨㄥ',
  ong: 'ㄨㄥ',
  v: 'ㄩ',
  ve: 'ㄩㄝ',
  van: 'ㄩㄢ',
  vn: 'ㄩㄣ',
  iong: 'ㄩㄥ',
}

const YW: Record<string, string> = {
  yi: 'ㄧ',
  ya: 'ㄧㄚ',
  ye: 'ㄧㄝ',
  yao: 'ㄧㄠ',
  you: 'ㄧㄡ',
  yan: 'ㄧㄢ',
  yin: 'ㄧㄣ',
  yang: 'ㄧㄤ',
  ying: 'ㄧㄥ',
  yong: 'ㄩㄥ',
  yo: 'ㄧㄛ',
  wu: 'ㄨ',
  wa: 'ㄨㄚ',
  wo: 'ㄨㄛ',
  wai: 'ㄨㄞ',
  wei: 'ㄨㄟ',
  wan: 'ㄨㄢ',
  wen: 'ㄨㄣ',
  wang: 'ㄨㄤ',
  weng: 'ㄨㄥ',
  yu: 'ㄩ',
  yue: 'ㄩㄝ',
  yuan: 'ㄩㄢ',
  yun: 'ㄩㄣ',
}

const JQX_U: Record<string, string> = {
  u: 'ㄩ',
  ue: 'ㄩㄝ',
  uan: 'ㄩㄢ',
  un: 'ㄩㄣ',
  iong: 'ㄩㄥ',
}

const EMPTY_I = new Set(['zh', 'ch', 'sh', 'r', 'z', 'c', 's'])

function withTone(syllable: string, tone: string): string {
  if (tone === '0' || tone === '5') return `\u02d9${syllable}`
  if (tone === '2') return `${syllable}\u02ca`
  if (tone === '3') return `${syllable}\u02c7`
  if (tone === '4') return `${syllable}\u02cb`
  return syllable
}

/** `xiao3`、`nü3`、`ge0` 轉成一個注音音節。轉不出來就回傳 null。 */
export function pinyinSyllableToZhuyin(raw: string): string | null {
  const match = raw
    .trim()
    .toLowerCase()
    .replace(/u:/g, 'v')
    .replace(/ü/g, 'v')
    .match(/^([a-z]+)([0-5])$/)
  if (!match) return null
  const body = match[1]
  const tone = match[2]
  if (body === 'er') return withTone('ㄦ', tone)
  if (body.startsWith('y') || body.startsWith('w')) {
    const mapped = YW[body]
    return mapped ? withTone(mapped, tone) : null
  }
  let initial = ''
  let rest = body
  for (const key of INITIALS) {
    if (body.startsWith(key)) {
      initial = key
      rest = body.slice(key.length)
      break
    }
  }
  if (!initial) return null
  let final: string
  if (EMPTY_I.has(initial) && (rest === 'i' || rest === '')) final = ''
  else if ((initial === 'j' || initial === 'q' || initial === 'x') && JQX_U[rest]) final = JQX_U[rest]
  else if (FINALS[rest] !== undefined && rest !== '') final = FINALS[rest]
  else return null
  return withTone(`${INITIAL_MARK[initial]}${final}`, tone)
}

type PinyinRow = { origin: string; result: string; isZh: boolean }

/** 一段連續國字，每個字一個注音；沒有讀音的字是 null。 */
export function readingsFor(text: string): (string | null)[] {
  ensureDict()
  const chars = [...text]
  if (!chars.length) return []
  const rows = pinyin(text, { type: 'all', toneType: 'num', traditional: true }) as PinyinRow[]
  const out: (string | null)[] = []
  if (rows.length === chars.length && rows.every((row, i) => row.origin === chars[i])) {
    for (const row of rows) out.push(row.isZh ? row.result : null)
  } else {
    for (const ch of chars) {
      const one = pinyin(ch, { type: 'all', toneType: 'num', traditional: true }) as PinyinRow[]
      out.push(one[0]?.isZh ? one[0].result : null)
    }
  }
  let i = 0
  while (i < chars.length) {
    let used = 1
    const max = Math.min(8, chars.length - i)
    for (let len = max; len >= 2; len -= 1) {
      const word = chars.slice(i, i + len).join('')
      const py = TW[word]
      if (!py || py.length !== len) continue
      for (let k = 0; k < len; k += 1) out[i + k] = py[k]
      used = len
      break
    }
    i += used
  }
  return out.map((py) => (py ? pinyinSyllableToZhuyin(py) : null))
}
