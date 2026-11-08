/**
 * 由原卷產生另一份試卷：A／B 卷（打亂題目與選項順序）、補考卷（只留挑選的題目）。
 * 都回傳新的 ExamContent，不改動原卷。
 */
import { choiceHits } from '../export/answerMarks'
import { type Asset, type ExamContent, isChoiceType, type Question, seededRandom, shuffled } from '../types/exam'
import { plainText } from './richText'

/** 這些選項通常要留在最後，不跟著打亂 */
const FIXED_CHOICE = /以上皆|以上都|以上均|都對|都不對|皆非|皆是|都是|都不是|無法判斷/

/** 「承上題」這類題目跟著上一題，不拆開 */
const FOLLOWS_PREVIOUS = /^[\s　]*[（(]?承上/

function letter(index: number): string {
  return String.fromCharCode(65 + index)
}

/** 答案是不是用選項代號寫的（A、(B)、AC）。是的話，打亂選項後要跟著改 */
function answerIsLetters(answer: string): boolean {
  const folded = [...answer.trim()]
    .map((ch) => {
      const c = ch.codePointAt(0) ?? 0
      return c >= 0xff21 && c <= 0xff5a ? String.fromCharCode(c - 0xfee0) : ch
    })
    .join('')
  return folded.length > 0 && /^[A-Za-z、,，;；\s()（）.．/／]+$/.test(folded)
}

function shuffleChoices(q: Question, rand: () => number): Question {
  if (!isChoiceType(q.type) || q.choices.length < 2) return q
  const letters = answerIsLetters(q.answer)
  const hits = letters ? choiceHits(q) : []
  if (letters && !hits.length) return q
  const movable = q.choices.map((c, i) => ({ c, i })).filter(({ c }) => !FIXED_CHOICE.test(plainText(c.text)))
  if (movable.length < 2) return q
  const order = shuffled(movable, rand)
  const choices = [...q.choices]
  movable.forEach((slot, k) => {
    choices[slot.i] = order[k].c
  })
  if (!letters) return { ...q, choices }
  const answer = hits
    .map((old) => choices.findIndex((c) => c.id === q.choices[old].id))
    .sort((a, b) => a - b)
    .map(letter)
    .join(hits.length > 1 && /[、,，]/.test(q.answer) ? '、' : '')
  return { ...q, choices, answer }
}

function shuffleMatching(q: Question, rand: () => number): Question {
  if (q.type !== 'matching' || !q.pairs?.length) return q
  const ids = q.pairs.filter((p) => plainText(p.right).trim()).map((p) => p.id)
  return { ...q, matchOrder: shuffled(ids, rand) }
}

/** 把題目分成一組一組；「承上題」黏在前一題後面 */
function questionGroups(questions: Question[]): Question[][] {
  const groups: Question[][] = []
  for (const q of questions) {
    const last = groups[groups.length - 1]
    if (last && FOLLOWS_PREVIOUS.test(plainText(q.stem))) last.push(q)
    else groups.push([q])
  }
  return groups
}

export type ShuffleOptions = { questions: boolean; choices: boolean }

/** 依種子打亂。同一個種子每次結果相同，方便重印 */
export function makeShuffledExam(exam: ExamContent, seed: string, opts: ShuffleOptions): ExamContent {
  const rand = seededRandom(seed)
  return {
    ...exam,
    sections: exam.sections.map((section) => {
      let questions = section.questions
      if (opts.questions && questions.length > 1) {
        let groups = questionGroups(questions)
        const before = groups.map((g) => g[0].id).join()
        for (let k = 0; k < 5; k++) {
          const next = shuffled(groups, rand)
          if (next.map((g) => g[0].id).join() !== before || groups.length < 2) {
            groups = next
            break
          }
        }
        questions = groups.flat().map((q) => (q.pairNext ? { ...q, pairNext: false } : q))
      }
      if (opts.choices) questions = questions.map((q) => shuffleMatching(shuffleChoices(q, rand), rand))
      return { ...section, questions }
    }),
  }
}

/** 只留下挑選的題目；沒有題目的大題拿掉，用不到的圖片也拿掉 */
export function makeRetakeExam(exam: ExamContent, keep: Set<string>): ExamContent {
  const sections = exam.sections
    .map((s) => ({ ...s, questions: s.questions.filter((q) => keep.has(q.id)) }))
    .filter((s) => s.questions.length)
  return { ...exam, sections, assets: usedAssets(exam.assets, sections.flatMap((s) => s.questions)) }
}

/** 題目用到的圖片 */
export function usedAssets(assets: Record<string, Asset>, questions: Question[]): Record<string, Asset> {
  const out: Record<string, Asset> = {}
  for (const q of questions) {
    for (const f of q.figures) if (assets[f.assetId]) out[f.assetId] = assets[f.assetId]
    for (const c of q.choices) if (c.image && assets[c.image.assetId]) out[c.image.assetId] = assets[c.image.assetId]
  }
  return out
}
