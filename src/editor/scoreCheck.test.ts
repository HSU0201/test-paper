import { describe, expect, it } from 'vitest'

import { createQuestion, createSection, type ExamContent } from '../types/exam'
import { checkScores } from './scoreCheck'

function exam(sections: ExamContent['sections'], fullScore?: number): ExamContent {
  return { numbering: 'continuous', sections, assets: {}, footer: undefined as never, ...(fullScore ? { fullScore } : {}) }
}

function choice(score: number, answer: string) {
  const q = createQuestion('single_choice', score)
  q.stem = '哪一個？'
  q.choices = q.choices.map((c, i) => ({ ...c, text: `選項${i}` }))
  q.answer = answer
  return q
}

describe('checkScores', () => {
  it('總分等於滿分、答案齊全時沒有問題', () => {
    const s = createSection('選擇題')
    s.questions = Array.from({ length: 50 }, () => choice(2, 'B'))
    expect(checkScores(exam([s])).issues).toEqual([])
  })

  it('總分和滿分不同時提醒差多少', () => {
    const s = createSection('選擇題')
    s.questions = [choice(2, 'A')]
    const r = checkScores(exam([s], 10))
    expect(r.total).toBe(2)
    expect(r.issues[0]).toMatchObject({ level: 'error' })
    expect(r.issues[0].text).toContain('少了 8 分')
  })

  it('找出不計分、沒答案、答案對不到選項的題目', () => {
    const s = createSection('選擇題')
    s.questions = [choice(0, 'A'), choice(2, ''), choice(2, 'F')]
    const texts = checkScores(exam([s], 4)).issues.map((i) => i.text)
    expect(texts.some((t) => t.includes('第 1 題不計分'))).toBe(true)
    expect(texts.some((t) => t.includes('第 2 題沒有填答案'))).toBe(true)
    expect(texts.some((t) => t.includes('第 3 題的答案「F」對不到選項'))).toBe(true)
  })

  it('每格計分：沒有空格的題目、格數和答案數不同、原卷總分不符', () => {
    const s = createSection('填充題', 'fill_blank')
    s.scoreMode = 'blank'
    s.blankScore = 0.5
    s.expectedTotal = 3
    const noBlank = createQuestion('fill_blank', 0)
    noBlank.stem = '寫出答案'
    noBlank.answer = '甲'
    const mismatch = createQuestion('fill_blank', 0)
    mismatch.stem = '（　　）和（　　）'
    mismatch.answer = '甲、乙、丙'
    s.questions = [noBlank, mismatch]
    const texts = checkScores(exam([s], 1)).issues.map((i) => i.text)
    expect(texts.some((t) => t.includes('算出 0 格'))).toBe(true)
    expect(texts.some((t) => t.includes('有 2 格，答案卻寫了 3 項'))).toBe(true)
    expect(texts.some((t) => t.includes('原卷寫共 3 分'))).toBe(true)
  })
})
