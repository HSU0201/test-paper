/**
 * 新增大題時直接選題型：名稱、作答說明、排版一次設好，並附上第一題，
 * 老師按下去就能開始打題目。
 */
import type { Question, QuestionType, Section } from '../types/exam'

export type SectionPreset = {
  id: string
  label: string
  /** 選單上的一句說明 */
  hint: string
  type: QuestionType
  title: string
  patch: Partial<Omit<Section, 'id' | 'questions'>>
  /** 第一題的預設值 */
  question?: Partial<Omit<Question, 'id'>>
}

export const SECTION_PRESETS: SectionPreset[] = [
  {
    id: 'choice',
    label: '選擇題',
    hint: '選一個答案',
    type: 'single_choice',
    title: '選擇題',
    patch: { instruction: '請選出正確的答案，把代號寫在（　）裡。', defaultScore: 2 },
  },
  {
    id: 'truefalse',
    label: '是非題',
    hint: '打○或×',
    type: 'true_false',
    title: '是非題',
    patch: { instruction: '對的打○，錯的打×。', defaultScore: 2 },
  },
  {
    id: 'fill',
    label: '填充題',
    hint: '寫在（　）裡',
    type: 'fill_blank',
    title: '填充題',
    patch: { instruction: '請把正確的答案寫在（　　）裡。', defaultScore: 2 },
  },
  {
    id: 'matching',
    label: '連連看',
    hint: '左右畫線配對',
    type: 'matching',
    title: '連連看',
    patch: { instruction: '請把相配的用線連起來。', defaultScore: 3 },
  },
  {
    id: 'short',
    label: '問答題',
    hint: '留線寫答案',
    type: 'short_answer',
    title: '問答題',
    patch: { instruction: '請把答案寫在線上。', defaultScore: 4 },
  },
  {
    id: 'grid',
    label: '國字注音格',
    hint: '看注音寫國字',
    type: 'fill_blank',
    title: '看注音寫國字',
    patch: { instruction: '看注音，把國字寫在格子裡。', layout: 'grid', defaultScore: 1, scoreMode: 'blank', blankScore: 1, gridGuide: true },
  },
  {
    id: 'vertical',
    label: '直式計算',
    hint: '右邊可驗算',
    type: 'short_answer',
    title: '直式計算',
    patch: { instruction: '用直式計算。', layout: 'rows', rowLines: 5, defaultScore: 5 },
    question: { answerLines: 0, aside: '驗算：' },
  },
  {
    id: 'blank',
    label: '空白大題',
    hint: '自己設定',
    type: 'single_choice',
    title: '新大題',
    patch: {},
  },
]
