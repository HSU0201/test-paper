/**
 * PDF 文字層或圖片文字辨識（OCR）讀出來的是一行一行的文字，沒有 Word 的段落與自動編號。
 * 這裡把行接回段落，交給 vendorExam 用同一套規則認大題、小題與答案：
 *   - 「一、」「1.」「答案：」「解析：」開頭的行另起一段
 *   - 其他行（題目換行、選項行）接在上一段後面
 *   - (A)(B)(C)(D) 選項改寫成 ①②③④，讓選擇題能拆出選項
 */
import type { DocParagraph } from './docxParagraphs'

const CJK = '\\u3400-\\u9fff\\uf900-\\ufaff\\u3000-\\u303f\\uff00-\\uffef\\u3100-\\u312f\\u02c7\\u02c9-\\u02cb\\u02d9'
// 括號裡的空白是作答空格，要留著
const BETWEEN_CJK = new RegExp(`(?<=[${CJK}])(?<![（(])[ \\t]+(?=[${CJK}])(?![）)])`, 'g')
const HALF_PUNCT: Record<string, string> = { '?': '？', '!': '！', ',': '，', ':': '：', ';': '；' }
// OCR 常把中文標點認成半形：前面是中文字的 ?!,:; 改回全形，括號也一樣
const PUNCT_AFTER_CJK = new RegExp(`(?<=[${CJK}])[ \\t]*([?!,:;])`, 'g')
// (A)、(1) 這類選項或小題標記不動
const OPEN_AFTER_CJK = new RegExp(`(?<=[${CJK}])[ \\t]*\\((?![ \\t]*[A-Za-z0-9]{1,2}[ \\t]*\\))`, 'g')
const CLOSE_BEFORE_CJK = new RegExp(`(?<!\\([ \\t]*[A-Za-z0-9]{1,2}[ \\t]*)\\)[ \\t]*(?=[${CJK}]|$)`, 'g')
const ENDS_CJK = new RegExp(`[${CJK}]$`)
const STARTS_CJK = new RegExp(`^[${CJK}]`)

const HEADING = /^[一二三四五六七八九十百]+[、．.]/
const NUMBERED = /^\d+[.．、]/
const ANSWER = /^[【[〔(（]?\s*(?:答案|解析|詳解|說明)\s*[】\]〕)）]?\s*[:：]/
const LETTER_MARK = /[(（]\s*([A-Da-dＡ-Ｄａ-ｄ])\s*[)）]/g
const CIRCLED = '①②③④'

/** 整理一行 OCR／PDF 文字：去掉中文字之間多餘的空白、全形數字轉半形、「1 .」併成「1.」 */
export function cleanLine(line: string): string {
  return line
    // 很多 PDF 會把「一」「小」等字存成外觀相同的康熙部首（⼀ U+2F00），轉回一般的字
    .replace(/[⺀-⿟]/g, (c) => c.normalize('NFKC'))
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(PUNCT_AFTER_CJK, (_, p: string) => HALF_PUNCT[p])
    .replace(OPEN_AFTER_CJK, '（')
    .replace(CLOSE_BEFORE_CJK, '）')
    .replace(BETWEEN_CJK, '')
    .replace(/^[\s　]*(\d+)\s+([.．、])/, '$1$2')
    .replace(/^[\s　]*([一二三四五六七八九十百]+)\s+([、．.])/, '$1$2')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

function letterIndex(c: string): number {
  const code = c.toUpperCase().charCodeAt(0)
  return code >= 0xff21 ? code - 0xff21 : code - 65
}

/** 段落裡依序出現 (A)(B)… 時改成 ①②…；順序不對（例如題幹裡引用「(B)」）就不動 */
export function letterChoicesToCircled(text: string): string {
  const marks = [...text.matchAll(LETTER_MARK)]
  const start = marks.findIndex((m) => letterIndex(m[1]) === 0)
  if (start < 0) return text
  const run = [marks[start]]
  for (let i = start + 1; i < marks.length && run.length < 4; i++) {
    if (letterIndex(marks[i][1]) === run.length) run.push(marks[i])
    else return text
  }
  if (run.length < 2 || marks.length - start !== run.length) return text
  let out = ''
  let at = 0
  run.forEach((m, i) => {
    out += text.slice(at, m.index) + CIRCLED[i]
    at = m.index! + m[0].length
  })
  return out + text.slice(at)
}

function startsBlock(line: string): boolean {
  return HEADING.test(line) || NUMBERED.test(line) || ANSWER.test(line)
}

function join(a: string, b: string): string {
  if (!a) return b
  return ENDS_CJK.test(a) && STARTS_CJK.test(b) ? a + b : `${a} ${b}`
}

/** 文字行 → 段落（沒有自動編號，題號留在文字裡讓 vendorExam 辨認） */
export function linesToParagraphs(lines: string[]): DocParagraph[] {
  const texts: string[] = []
  for (const raw of lines) {
    const line = cleanLine(raw)
    if (!line) continue
    if (!texts.length || startsBlock(line)) texts.push(line)
    else texts[texts.length - 1] = join(texts[texts.length - 1], line)
  }
  return texts.map((text) => ({ numbered: false, parts: [{ kind: 'text', text: letterChoicesToCircled(text) }] }))
}
