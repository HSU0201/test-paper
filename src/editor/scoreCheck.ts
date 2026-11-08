/** 整份試卷的配分檢查：總分、各大題、每一題的分數與答案。 */
import {
  type BlockRef,
  type ExamContent,
  examTotals,
  isChoiceType,
  matchLeftItems,
  type Question,
  questionBlankCount,
  questionNumbers,
  questionPoints,
  type Section,
  sectionScore,
  toChineseNumeral,
  trueFalseAnswer,
} from '../types/exam'
import { plainText } from './richText'

export const DEFAULT_FULL_SCORE = 100

export type ScoreIssue = {
  /** error：分數一定有錯；warn：可能有問題，請老師看一下 */
  level: 'error' | 'warn'
  text: string
  ref?: BlockRef
}

export type ScoreCheck = {
  total: number
  fullScore: number
  issues: ScoreIssue[]
}

const round = (n: number) => Math.round(n * 1000) / 1000

function sectionName(s: Section, index: number): string {
  return `${toChineseNumeral(index + 1)}、${s.title || '（未命名大題）'}`
}

/** 選擇題的答案能不能對到選項：A、(B)、①，或和選項文字相同 */
function choiceAnswerOk(q: Question): boolean {
  const parts = q.answer
    .trim()
    .split(/[、,，;；\n/／|｜\s]+/)
    .map((p) => p.trim())
    .filter(Boolean)
  if (!parts.length) return false
  return parts.every((part) => {
    const letters = part.toUpperCase().replace(/[()（）.．]/g, '')
    if (/^[A-Z]+$/.test(letters)) return [...letters].every((c) => c.charCodeAt(0) - 65 < q.choices.length)
    const circled = '①②③④⑤⑥⑦⑧⑨⑩'.indexOf(part)
    if (circled >= 0) return circled < q.choices.length
    return q.choices.some((c) => plainText(c.text).trim() === part)
  })
}

/** 填充題答案用「、」「，」分開的項數；一項時回傳 1 */
function answerItems(answer: string): number {
  return answer
    .trim()
    .split(/[、,，]/)
    .filter((s) => s.trim()).length
}

export function checkScores(exam: ExamContent): ScoreCheck {
  const issues: ScoreIssue[] = []
  const nums = questionNumbers(exam)
  const total = examTotals(exam).score
  const fullScore = exam.fullScore ?? DEFAULT_FULL_SCORE

  // 還在出題時總分不到滿分很正常，只提醒；超過滿分才是錯
  if (Math.abs(total - fullScore) > 0.001) {
    const diff = round(total - fullScore)
    issues.push(
      diff > 0
        ? { level: 'error', text: `全卷總分 ${total} 分，超過滿分 ${fullScore} 分，多了 ${diff} 分。` }
        : { level: 'warn', text: `全卷目前 ${total} 分，還差 ${-diff} 分才到滿分 ${fullScore} 分。` },
    )
  }

  exam.sections.forEach((s, si) => {
    const name = sectionName(s, si)
    const ref: BlockRef = { kind: 'section', id: s.id }
    if (!s.questions.length) {
      issues.push({ level: 'warn', text: `${name}還沒有小題。`, ref })
      return
    }
    const got = sectionScore(s)
    if (typeof s.expectedTotal === 'number' && Math.abs(got - s.expectedTotal) > 0.001) {
      issues.push({ level: 'warn', text: `${name}：原卷寫共 ${s.expectedTotal} 分，現在算出 ${got} 分。`, ref })
    }
    if (s.scoreMode === 'blank' && !(s.blankScore > 0)) {
      issues.push({ level: 'error', text: `${name}：每格分數是 0，整個大題都不會計分。`, ref })
    }

    s.questions.forEach((q) => {
      const where = `${name}第 ${nums.get(q.id) ?? '?'} 題`
      const qref: BlockRef = { kind: 'question', id: q.id }
      const points = questionPoints(s, q)
      if (!(points > 0)) {
        const why =
          s.scoreMode === 'blank'
            ? questionBlankCount(q) === 0
              ? '題目裡沒有（　）或底線，算出 0 格'
              : '每格分數是 0'
            : '配分是 0'
        issues.push({ level: 'error', text: `${where}不計分：${why}。`, ref: qref })
      }
      // 注音格的答案就是格子裡留白的字，不用另外填
      if (s.layout === 'grid') return
      // 連連看的答案由配對產生
      if (q.type === 'matching') {
        if (matchLeftItems(q).length < 2) issues.push({ level: 'warn', text: `${where}的連連看還沒填好配對。`, ref: qref })
        return
      }
      const answer = q.answer.trim()
      if (q.type === 'true_false' && answer && !trueFalseAnswer(answer)) {
        issues.push({ level: 'warn', text: `${where}是是非題，答案要選 ○ 或 ×。`, ref: qref })
        return
      }
      if (!answer) {
        issues.push({ level: 'warn', text: `${where}沒有填答案，答案卷上會空著。`, ref: qref })
        return
      }
      if (isChoiceType(q.type)) {
        if (!choiceAnswerOk(q)) {
          issues.push({ level: 'warn', text: `${where}的答案「${answer}」對不到選項。`, ref: qref })
        }
        return
      }
      if (s.scoreMode === 'blank') {
        const blanks = questionBlankCount(q)
        const items = answerItems(answer)
        if (items > 1 && blanks > 1 && items !== blanks) {
          issues.push({
            level: 'warn',
            text: `${where}有 ${blanks} 格，答案卻寫了 ${items} 項，答案卷上對不齊。`,
            ref: qref,
          })
        }
      }
    })
  })

  return { total, fullScore, issues }
}
