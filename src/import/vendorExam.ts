/**
 * 把廠商考卷（題目卷＋解析卷）的段落整理成大題與小題。
 * 認得的寫法：
 *   大題：「一、選擇題：每格 0.3 分、共 6.3 分」，不用自動編號
 *   小題：Word 自動編號的段落；整份都沒有自動編號時，改認「1.」「1、」開頭
 *   選項：題目最後的 ①②③④
 *   答案：解析卷每題下面的「答案：②」「解析：……」
 */
import { FIGURE_MARK } from '../types/exam'
import type { DocImage, DocParagraph } from './docxParagraphs'

export type ImportedQuestion = {
  /** 題幹；圖片位置以［圖］標記 */
  stem: string
  images: DocImage[]
  /** 拆出來的選項；不是選擇題時為 null */
  choices: string[] | null
  answer: string
  explanation: string
}

export type ImportedSection = {
  title: string
  /** 標題冒號後面的原文，例如「每格 0.3 分、共 6.3 分」 */
  note: string
  instruction: string
  blankScore: number | null
  eachScore: number | null
  /** 廠商寫的大題總分，用來核對 */
  total: number | null
  questions: ImportedQuestion[]
}

export type ImportedExam = {
  title: string
  sections: ImportedSection[]
  warnings: string[]
}

const HEADING = /^[\s　]*([一二三四五六七八九十百]+)[、．.]\s*(.+)$/
const NUMBERED = /^[\s　]*\d+[.．、]\s*/
const ANSWER = /^[\s　]*[【[〔(（]?\s*答案\s*[】\]〕)）]?\s*[:：]?\s*/
const EXPLAIN = /^[\s　]*[【[〔(（]?\s*(?:解析|詳解|說明)\s*[】\]〕)）]?\s*[:：]?\s*/
const CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩'

function paragraphText(p: DocParagraph): { text: string; images: DocImage[] } {
  let text = ''
  const images: DocImage[] = []
  for (const part of p.parts) {
    if (part.kind === 'text') text += part.text
    else {
      images.push(part.image)
      text += FIGURE_MARK
    }
  }
  return { text, images }
}

function parseNumber(s: string | undefined): number | null {
  if (!s) return null
  const n = Number(s.replace(/[０-９．]/g, (c) => (c === '．' ? '.' : String.fromCharCode(c.charCodeAt(0) - 0xfee0))))
  return Number.isFinite(n) ? n : null
}

function parseHeading(text: string): Pick<ImportedSection, 'title' | 'note' | 'blankScore' | 'eachScore' | 'total'> | null {
  const m = text.trim().match(HEADING)
  if (!m) return null
  const rest = m[2].trim()
  const colon = rest.search(/[:：]/)
  const title = (colon >= 0 ? rest.slice(0, colon) : rest).trim()
  const note = colon >= 0 ? rest.slice(colon + 1).trim() : ''
  const blank = note.match(/每(?:格|空|小格)\s*([\d０-９.．]+)\s*分/)
  const each = note.match(/每(?:題|小題)\s*([\d０-９.．]+)\s*分/)
  const total = note.match(/共\s*([\d０-９.．]+)\s*分/)
  return {
    title,
    note,
    blankScore: parseNumber(blank?.[1]),
    eachScore: parseNumber(each?.[1]),
    total: parseNumber(total?.[1]),
  }
}

/** 題目最後的 ①②③… 拆成選項。標記要從①開始、依序、各出現一次，否則不拆。 */
export function splitChoices(stem: string): { stem: string; choices: string[] } | null {
  const positions: number[] = []
  for (let k = 0; k < CIRCLED.length; k++) {
    const mark = CIRCLED[k]
    const first = stem.indexOf(mark)
    if (first < 0) break
    if (stem.indexOf(mark, first + 1) >= 0) return null
    if (positions.length && first < positions[positions.length - 1]) return null
    positions.push(first)
  }
  if (positions.length < 2) return null
  // 後面的編號若還出現（例如跳號），代表不是單純的選項
  if (positions.length < CIRCLED.length && stem.includes(CIRCLED[positions.length])) return null
  const head = stem.slice(0, positions[0]).replace(/[\s　]+$/, '')
  if (!head.replace(/［圖］/g, '').trim()) return null
  const choices = positions.map((at, i) =>
    stem
      .slice(at + 1, positions[i + 1] ?? stem.length)
      .replace(/^[\s　.．、]+|[\s　]+$/g, ''),
  )
  // 選項裡的圖片放回題幹最後
  const marks = choices.join('').split(FIGURE_MARK).length - 1
  const cleaned = choices.map((c) => c.split(FIGURE_MARK).join('').trim())
  if (cleaned.some((c) => !c)) return null
  return { stem: head + FIGURE_MARK.repeat(marks), choices: cleaned }
}

/** 「②」「(B)」「B」轉成選項索引；看不懂回傳空陣列 */
export function choiceIndexes(answer: string, count: number): number[] {
  const out: number[] = []
  for (const ch of answer) {
    const k = CIRCLED.indexOf(ch)
    if (k >= 0 && k < count && !out.includes(k)) out.push(k)
  }
  if (out.length) return out
  const letters = answer.toUpperCase().replace(/[^A-Z]/g, '')
  if (letters && [...letters].every((c) => c.charCodeAt(0) - 65 < count)) {
    return [...new Set([...letters].map((c) => c.charCodeAt(0) - 65))]
  }
  return []
}

const LABEL = /^(?:[(（][\d０-９]+[)）]|[⑴-⒇])/
const INNER_LABEL = /^[①-⑳](?=[ˇ╳○×✓✔✗Ｏ])/

/**
 * 「(１)ㄈ，ㄆ；(２)高」這種分小題的答案攤平成「ㄈ，ㄆ，高」，讓每一格各對一個答案。
 * 攤平後的數量和格數對不上時回傳 null，保留原文。
 */
export function flattenAnswer(answer: string, blanks: number): string | null {
  const text = answer.trim()
  if (!text || blanks <= 1) return null
  const items: string[] = []
  for (const piece of text.split(/[；;]|(?=[(（][\d０-９]+[)）])|(?=[⑴-⒇])/)) {
    let rest = piece.trim()
    while (LABEL.test(rest)) rest = rest.replace(LABEL, '').trim()
    for (const sub of rest.split(/[，,、]/)) {
      const v = sub.trim().replace(INNER_LABEL, '').trim()
      if (v) items.push(v)
    }
  }
  return items.length === blanks ? items.join('，') : null
}

/** 題目說明裡的「請在（　）裡打ˇ」「填在＿＿裡」只是說明，不是作答格 */
const PROMPT_BLANK = /(?:（[\s　]*）|\([\s　]*\)|□|＿{2,}|_{2,})(?=[裡中內上])/g

/** 作答格數：題幹裡的（　）、底線（不含說明用的那一個）；題幹沒有時，看答案有幾項 */
export function vendorBlankCount(stem: string, answer: string, countStemBlanks: (s: string) => number): number {
  const inStem = countStemBlanks(stem.replace(PROMPT_BLANK, ''))
  if (inStem > 0) return inStem
  const entries = answer
    .split(/[；;\n]|(?=[(（][\d０-９]+[)）])|(?=[⑴-⒇])/)
    .map((s) => s.trim())
    .filter(Boolean)
  let maxLabel = 0
  for (const m of answer.matchAll(/[(（]([\d０-９]+)[)）]|([⑴-⒇])|([①-⑳])/g)) {
    const n = m[1]
      ? Number(m[1].replace(/[０-９]/g, (c) => String(c.charCodeAt(0) - 0xff10)))
      : m[2]
        ? m[2].charCodeAt(0) - 0x2473
        : m[3].charCodeAt(0) - 0x245f
    if (n > maxLabel) maxLabel = n
  }
  return Math.max(1, entries.length, maxLabel)
}

function key(stem: string): string {
  return stem.replace(/［圖］|\{\{[^}]*\}\}|[\s　＿_()（）]/g, '').slice(0, 24)
}

type Collected = { sections: ImportedSection[]; title: string }

function collect(paragraphs: DocParagraph[], withAnswers: boolean): Collected {
  const anyNumbered = paragraphs.some((p) => p.numbered)
  const sections: ImportedSection[] = []
  let title = ''
  let section: ImportedSection | null = null
  let question: ImportedQuestion | null = null
  /** 解析卷裡，答案、解析之後的段落都算說明，不併回題幹 */
  let inAnswer: 'answer' | 'explanation' | null = null

  const ensureSection = () => {
    if (!section) {
      section = { title: '題目', note: '', instruction: '', blankScore: null, eachScore: null, total: null, questions: [] }
      sections.push(section)
    }
    return section
  }

  for (const p of paragraphs) {
    const { text, images } = paragraphText(p)
    if (!text.trim()) continue
    const heading = !p.numbered ? parseHeading(text) : null
    if (heading) {
      section = { ...heading, instruction: '', questions: [] }
      sections.push(section)
      question = null
      inAnswer = null
      continue
    }
    if (withAnswers && question && !p.numbered) {
      if (ANSWER.test(text)) {
        question.answer = text.replace(ANSWER, '').trim()
        inAnswer = 'answer'
        continue
      }
      if (EXPLAIN.test(text)) {
        question.explanation = text.replace(EXPLAIN, '').trim()
        inAnswer = 'explanation'
        continue
      }
      if (inAnswer === 'explanation') {
        question.explanation += `\n${text.trim()}`
        continue
      }
    }
    const isQuestion = anyNumbered ? p.numbered : NUMBERED.test(text)
    if (isQuestion) {
      question = {
        stem: (anyNumbered ? text : text.replace(NUMBERED, '')).trim(),
        images,
        choices: null,
        answer: '',
        explanation: '',
      }
      ensureSection().questions.push(question)
      inAnswer = null
      continue
    }
    if (question) {
      question.stem += `\n${text.trim()}`
      question.images.push(...images)
    } else if (section) {
      const s: ImportedSection = section
      s.instruction = s.instruction ? `${s.instruction}\n${text.trim()}` : text.trim()
    } else if (!title) {
      title = text.replace(/[\s　]+/g, ' ').trim()
    }
  }
  return { sections, title }
}

/** 題目卷段落＋（可選）解析卷段落 → 匯入結果 */
export function buildVendorExam(questionDoc: DocParagraph[], answerDoc?: DocParagraph[]): ImportedExam {
  const warnings: string[] = []
  const { sections, title } = collect(questionDoc, false)

  if (answerDoc) {
    const answers = collect(answerDoc, true)
    const byKey = new Map<string, ImportedQuestion>()
    for (const s of answers.sections) for (const q of s.questions) {
      const k = key(q.stem)
      if (k && !byKey.has(k)) byKey.set(k, q)
    }
    let missing = 0
    sections.forEach((s, si) => {
      s.questions.forEach((q, qi) => {
        const hit = byKey.get(key(q.stem)) ?? answers.sections[si]?.questions[qi]
        if (hit) {
          q.answer = hit.answer
          q.explanation = hit.explanation
        }
        if (!hit?.answer) missing += 1
      })
    })
    if (missing) warnings.push(`有 ${missing} 題在解析卷裡找不到答案。`)
  }

  for (const s of sections) {
    for (const q of s.questions) {
      const split = splitChoices(q.stem)
      if (split) {
        q.stem = split.stem
        q.choices = split.choices
      }
    }
  }
  if (!sections.some((s) => s.questions.length)) warnings.push('沒有找到題目。請確認是用 Word 自動編號的考卷。')
  return { title, sections, warnings }
}
