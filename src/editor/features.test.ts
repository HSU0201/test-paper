import { describe, expect, it } from 'vitest'

import {
  createMatchPair,
  createQuestion,
  createSection,
  type ExamContent,
  matchAnswerText,
  matchRightItems,
  questionBlankCount,
  trueFalseAnswer,
} from '../types/exam'
import { blueprintCsv, crossTable, questionRows } from './blueprint'
import { examReducer } from './examReducer'
import { fracMarkup, hasInkMarkup, monoMarkup, plainText } from './richText'
import { layoutRubyRun } from './rubyLayout'
import { makeRetakeExam, makeShuffledExam } from './variants'

function examWith(...qs: ReturnType<typeof createQuestion>[]): ExamContent {
  const s = createSection('選擇題')
  s.questions = qs
  return { numbering: 'continuous', sections: [s], assets: {}, footer: { continueOn: false, endOn: false, continueText: '', endText: '' } }
}

function choice(stem: string, answer: string, texts = ['甲', '乙', '丙', '丁']) {
  const q = createQuestion('single_choice', 2)
  q.stem = stem
  q.answer = answer
  q.choices = q.choices.map((c, i) => ({ ...c, text: texts[i] }))
  return q
}

describe('是非題', () => {
  it('答案統一成 ○ ×', () => {
    expect(trueFalseAnswer('O')).toBe('○')
    expect(trueFalseAnswer('對')).toBe('○')
    expect(trueFalseAnswer('X')).toBe('×')
    expect(trueFalseAnswer('錯')).toBe('×')
    expect(trueFalseAnswer('')).toBe('')
  })

  it('作答括號算一格', () => {
    const q = createQuestion('true_false', 2)
    q.stem = '太陽從東邊升起。'
    expect(questionBlankCount(q)).toBe(1)
  })
})

describe('連連看', () => {
  it('右欄打亂，答案寫成①丙這種格式', () => {
    const q = createQuestion('matching', 3)
    q.pairs = [createMatchPair('蘋果', '紅'), createMatchPair('香蕉', '黃'), createMatchPair('葡萄', '紫'), createMatchPair('', '白')]
    const right = matchRightItems(q)
    expect(right).toHaveLength(4)
    expect(right.map((p) => p.id)).not.toEqual(q.pairs.map((p) => p.id))
    expect(matchAnswerText(q).split(' ')).toHaveLength(3)
    expect(questionBlankCount(q)).toBe(3)
  })

  it('存了順序就照存下的順序', () => {
    const q = createQuestion('matching', 3)
    q.pairs = [createMatchPair('a', 'A'), createMatchPair('b', 'B')]
    q.matchOrder = [q.pairs[1].id, q.pairs[0].id]
    expect(matchAnswerText(q)).toBe('①乙 ②甲')
  })
})

describe('複製', () => {
  it('複製題目換新 id，接在原題下面', () => {
    const q = choice('1+1=?', 'B')
    const exam = examWith(q)
    const next = examReducer({ exam, selectedBlock: null }, { type: 'DUPLICATE_QUESTION', id: q.id })
    const qs = next.exam.sections[0].questions
    expect(qs).toHaveLength(2)
    expect(qs[1].id).not.toBe(q.id)
    expect(qs[1].stem).toBe(q.stem)
    expect(qs[1].choices[0].id).not.toBe(q.choices[0].id)
    expect(next.selectedBlock).toEqual({ kind: 'question', id: qs[1].id })
  })

  it('複製大題', () => {
    const exam = examWith(choice('a', 'A'), choice('b', 'B'))
    const id = exam.sections[0].id
    const next = examReducer({ exam, selectedBlock: null }, { type: 'DUPLICATE_SECTION', id })
    expect(next.exam.sections).toHaveLength(2)
    expect(next.exam.sections[1].questions).toHaveLength(2)
    expect(next.exam.sections[1].id).not.toBe(id)
  })
})

describe('A／B 卷', () => {
  it('選項打亂後，用代號寫的答案跟著改', () => {
    const qs = Array.from({ length: 6 }, (_, i) => choice(`第${i}題`, 'B'))
    const b = makeShuffledExam(examWith(...qs), 'B-1', { questions: true, choices: true })
    for (const q of b.sections[0].questions) {
      const index = q.answer.charCodeAt(0) - 65
      expect(q.choices[index].text).toBe('乙')
    }
    expect(b.sections[0].questions.map((q) => q.id)).not.toEqual(qs.map((q) => q.id))
  })

  it('「以上皆是」留在原位，承上題跟著上一題', () => {
    const first = choice('小明有 3 顆糖', 'D', ['1', '2', '3', '以上皆是'])
    const follow = choice('承上題，再給他 2 顆', 'A', ['5', '6', '7', '8'])
    const others = Array.from({ length: 4 }, (_, i) => choice(`其他${i}`, 'A'))
    for (let seed = 0; seed < 5; seed++) {
      const b = makeShuffledExam(examWith(first, follow, ...others), `s${seed}`, { questions: true, choices: true })
      const list = b.sections[0].questions
      const at = list.findIndex((q) => q.id === first.id)
      expect(list[at + 1].id).toBe(follow.id)
      expect(list[at].choices[3].text).toBe('以上皆是')
      expect(list[at].answer).toBe('D')
    }
  })

  it('同一個種子結果相同', () => {
    const exam = examWith(...Array.from({ length: 5 }, (_, i) => choice(`q${i}`, 'A')))
    const a = makeShuffledExam(exam, 'x', { questions: true, choices: true })
    const b = makeShuffledExam(exam, 'x', { questions: true, choices: true })
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })
})

describe('補考卷', () => {
  it('只留勾選的題目', () => {
    const qs = [choice('a', 'A'), choice('b', 'B'), choice('c', 'C')]
    const r = makeRetakeExam(examWith(...qs), new Set([qs[1].id]))
    expect(r.sections[0].questions.map((q) => q.stem)).toEqual(['b'])
  })
})

describe('雙向細目表', () => {
  it('依單元與能力統計題數和配分', () => {
    const a = choice('a', 'A')
    a.unit = '第一課'
    a.skill = '記憶'
    a.level = 'easy'
    const b = choice('b', 'B')
    b.unit = '第一課'
    b.skill = '理解'
    const c = choice('c', 'C')
    const rows = questionRows(examWith(a, b, c))
    const t = crossTable(rows, 'unit', 'skill')
    expect(t.rows).toEqual(['第一課', '未填'])
    expect(t.cols).toEqual(['記憶', '理解', '未填'])
    expect(t.cell('第一課', '記憶')).toEqual({ count: 1, points: 2 })
    expect(t.total).toEqual({ count: 3, points: 6 })
    expect(blueprintCsv(rows)).toContain('第一課')
  })
})

describe('分數與黑白', () => {
  it('分數標記：純文字是 3/4，走逐格排版', () => {
    const m = `答案是${fracMarkup('3', '4')}`
    expect(plainText(m)).toBe('答案是3/4')
    expect(hasInkMarkup(m)).toBe(true)
    const laid = layoutRubyRun(m, 500, 16, 1.6, (s) => [...s].length * 16)
    expect(laid.pieces.some((p) => p.frac?.num === '3' && p.frac.den === '4')).toBe(true)
  })

  it('黑白：彩色字改成粗體，不留顏色', () => {
    expect(monoMarkup('{{#d92d20}}紅字{{/}}黑字')).toBe('{{*b}}紅字{{/*}}黑字')
  })
})

describe('範本與字級', () => {
  it('套用範本換掉頁首與紙張，試卷名稱和題目不變', async () => {
    const { editorReducer, initialEditorState, templateOf } = await import('./reducer')
    const school = initialEditorState()
    const withSchool = editorReducer(school, {
      type: 'UPDATE_HEADER_ITEM',
      id: school.layout.header.items.find((it) => it.role === 'schoolName')!.id,
      patch: { value: '範本國小' },
    })
    const template = templateOf(editorReducer(withSchool, { type: 'SET_COLUMNS', patch: { count: 1 } }))
    const paper = initialEditorState()
    const titleId = paper.layout.header.items.find((it) => it.role === 'examTitle')!.id
    const mine = editorReducer(paper, { type: 'UPDATE_HEADER_ITEM', id: titleId, patch: { value: '我的期中考' } })
    const applied = editorReducer(mine, { type: 'APPLY_TEMPLATE', template })
    const value = (role: string) => applied.layout.header.items.find((it) => it.role === role)?.value
    expect(value('schoolName')).toBe('範本國小')
    expect(value('examTitle')).toBe('我的期中考')
    expect(applied.layout.columns.count).toBe(1)
    expect(applied.exam).toBe(mine.exam)
  })

  it('字級與行距一起改', async () => {
    const { editorReducer, initialEditorState } = await import('./reducer')
    const next = editorReducer(initialEditorState(), {
      type: 'SET_TEXT_SCALE',
      overrides: { question_body: { fontSize: 20 } },
      lineHeight: { nominal: 1.9, min: 1.6 },
    })
    expect(next.textLevelOverrides.question_body?.fontSize).toBe(20)
    expect(next.layout.spacing.lineHeight.nominal).toBe(1.9)
  })
})

describe('範例考卷', () => {
  it('國英數社自五科都是 100 分，沒有配分錯誤，而且示範多種題型', async () => {
    const { createSampleExam, SAMPLE_SUBJECTS } = await import('./chineseSample')
    const { checkScores } = await import('./scoreCheck')
    const { examTotals } = await import('../types/exam')
    expect(SAMPLE_SUBJECTS.map((s) => s.label)).toEqual(['國文', '英文', '數學', '社會', '自然'])
    for (const { id } of SAMPLE_SUBJECTS) {
      const exam = createSampleExam(id)
      expect(examTotals(exam).score, id).toBe(100)
      const check = checkScores(exam)
      expect(check.issues.filter((i) => i.level === 'error'), id).toEqual([])
      expect(check.issues.filter((i) => i.text.includes('沒有填答案')), id).toEqual([])
      const types = new Set(exam.sections.flatMap((s) => s.questions.map((q) => q.type)))
      expect(types.has('true_false'), id).toBe(true)
      expect(types.has('matching'), id).toBe(true)
      expect(types.has('single_choice'), id).toBe(true)
      expect(types.size, id).toBeGreaterThanOrEqual(4)
    }
  })
})
