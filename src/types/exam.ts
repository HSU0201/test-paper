import { plainText } from '../editor/richText'

export type QuestionType = 'single_choice' | 'multi_choice' | 'fill_blank' | 'short_answer'

export const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  single_choice: '單選題',
  multi_choice: '多選題',
  fill_blank: '填充題',
  short_answer: '問答題',
}

export type ChoiceLayout = 'auto' | 1 | 2 | 4

/** 選項圖片；widthRatio 為佔該選項格寬度的比例 */
export type ChoiceImage = { assetId: string; widthRatio: number }

export type Choice = { id: string; text: string; image?: ChoiceImage }

/** below：題目下方；right：題目右側（文字繞排）；afterChoices：選項之後 */
export type FigurePlacement = 'below' | 'right' | 'afterChoices'

/** 題目內的圖片，跟著題目一起排版、移動 */
export type Figure = {
  id: string
  assetId: string
  placement: FigurePlacement
  /** 佔題目內容寬度的比例 */
  widthRatio: number
}

export type Asset = { src: string; width: number; height: number }

/** 個別字級。沒填的欄位跟隨全卷預設 */
export type FontOverride = {
  fontSize?: number
  bold?: boolean
}

/** 小題（題目層） */
export type Question = {
  id: string
  type: QuestionType
  score: number
  stem: string
  choices: Choice[]
  choiceLayout: ChoiceLayout
  answer: string
  /** 問答題留給學生作答的行數 */
  answerLines: number
  figures: Figure[]
  /** 題號、題幹、選項；未設則用全卷「小題題文」 */
  bodyStyle?: FontOverride
}

/** firstChild：標題至少與第一題同欄；whole：整個大題不跨欄 */
export type KeepTogether = 'firstChild' | 'whole'

/** 大題（題型層） */
export type Section = {
  id: string
  title: string
  instruction: string
  /** 新增小題時的預設配分 */
  defaultScore: number
  defaultType: QuestionType
  keepTogether: KeepTogether
  questions: Question[]
  /** 大題標題；未設則用全卷「大題標題」 */
  headingStyle?: FontOverride
  /** 作答說明；未設則用全卷「作答說明」 */
  instructionStyle?: FontOverride
}

export type QuestionNumbering = 'continuous' | 'perSection'

export type ExamContent = {
  numbering: QuestionNumbering
  sections: Section[]
  /** 圖片資料（data URL），由 Figure.assetId 參照 */
  assets: Record<string, Asset>
}

/** header：頁首欄位 */
export type BlockRef = { kind: 'section' | 'question' | 'header'; id: string }

const newId = () => crypto.randomUUID()

const CN_DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九']

/** 1–99 轉中文數字（大題編號用） */
export function toChineseNumeral(n: number): string {
  if (n <= 0 || n >= 100) return String(n)
  if (n < 10) return CN_DIGITS[n]
  const tens = Math.floor(n / 10)
  const ones = n % 10
  return `${tens === 1 ? '' : CN_DIGITS[tens]}十${ones ? CN_DIGITS[ones] : ''}`
}

export function choiceLabel(index: number): string {
  return `(${String.fromCharCode(65 + index)})`
}

export function sectionScore(s: Section): number {
  return s.questions.reduce((sum, q) => sum + (Number(q.score) || 0), 0)
}

export function examTotals(exam: ExamContent) {
  let questions = 0
  let score = 0
  for (const s of exam.sections) {
    questions += s.questions.length
    score += sectionScore(s)
  }
  return { questions, score, sections: exam.sections.length }
}

/** 題號一律由順序推導，不存檔 */
export function questionNumbers(exam: ExamContent): Map<string, number> {
  const map = new Map<string, number>()
  let n = 0
  for (const s of exam.sections) {
    if (exam.numbering === 'perSection') n = 0
    for (const q of s.questions) map.set(q.id, ++n)
  }
  return map
}

export function sectionHeading(s: Section, index: number): string {
  return `${toChineseNumeral(index + 1)}、${plainText(s.title)}`
}

function questionPoints(q: Question): number {
  const n = Number(q.score)
  return Number.isFinite(n) ? n : 0
}

/** 大題內每題分數相同時回傳該分數；沒有小題或分數不一則為 null */
export function uniformQuestionScore(s: Section): number | null {
  if (!s.questions.length) return null
  const first = questionPoints(s.questions[0])
  return s.questions.every((q) => questionPoints(q) === first) ? first : null
}

/** 大題標題後的配分說明：每題同分時寫「每題 N 分」，否則只寫總分 */
export function sectionScoreNote(s: Section): string {
  if (!s.questions.length) return ''
  const total = sectionScore(s)
  const each = uniformQuestionScore(s)
  return each == null ? `（共 ${total} 分）` : `（每題 ${each} 分，共 ${total} 分）`
}

/** 小題配分不同時印在題號後；全大題同分時不重複標示 */
export function questionScoreMark(section: Section, q: Question): string {
  if (uniformQuestionScore(section) != null) return ''
  return `（${questionPoints(q)} 分）`
}

export function createQuestion(type: QuestionType, score: number): Question {
  const isChoice = type === 'single_choice' || type === 'multi_choice'
  return {
    id: newId(),
    type,
    score,
    stem: '',
    choices: isChoice ? ['', '', '', ''].map((text) => ({ id: newId(), text })) : [],
    choiceLayout: 'auto',
    answer: '',
    answerLines: type === 'short_answer' ? 3 : 0,
    figures: [],
  }
}

export function createChoice(): Choice {
  return { id: newId(), text: '' }
}

export function createSection(title = '新大題', defaultType: QuestionType = 'single_choice'): Section {
  return {
    id: newId(),
    title,
    instruction: '',
    defaultScore: 2,
    defaultType,
    keepTogether: 'firstChild',
    questions: [],
  }
}

export function isChoiceType(t: QuestionType): boolean {
  return t === 'single_choice' || t === 'multi_choice'
}

function q(type: QuestionType, score: number, stem: string, choices: string[] = [], answer = ''): Question {
  return {
    ...createQuestion(type, score),
    stem,
    choices: choices.map((text) => ({ id: newId(), text })),
    answer,
  }
}

export function createSampleExam(): ExamContent {
  const choice = createSection('選擇題', 'single_choice')
  choice.defaultScore = 4
  choice.instruction = '請選出最適當的答案。'
  choice.questions = [
    q('single_choice', 4, '下列哪一個數是質數？', ['21', '27', '29', '33'], 'C'),
    q('single_choice', 4, '若 2x + 3 = 11，則 x 的值為何？', ['3', '4', '5', '7'], 'B'),
    q(
      'single_choice',
      4,
      '某班有 30 位學生，其中男生占全班的五分之二，請問女生有幾位？',
      ['12 位', '15 位', '18 位', '20 位'],
      'C',
    ),
  ]
  const fill = createSection('填充題', 'fill_blank')
  fill.defaultScore = 5
  fill.questions = [
    q('fill_blank', 5, '一個正方形的周長是 36 公分，它的面積是＿＿＿＿平方公分。', [], '81'),
    q('fill_blank', 5, '3/4 化成小數是＿＿＿＿。', [], '0.75'),
  ]
  const essay = createSection('計算題', 'short_answer')
  essay.defaultScore = 10
  essay.instruction = '請寫出計算過程。'
  essay.questions = [
    { ...q('short_answer', 10, '小明買了 3 枝筆和 2 本筆記本共花了 110 元，已知一枝筆 20 元，請問一本筆記本多少元？'), answerLines: 4 },
  ]
  return { numbering: 'continuous', sections: [choice, fill, essay], assets: {} }
}

export function createEmptyExam(): ExamContent {
  return { numbering: 'continuous', sections: [], assets: {} }
}

const QUESTION_TYPES = Object.keys(QUESTION_TYPE_LABEL) as QuestionType[]

function normalizeFontOverride(raw: unknown): FontOverride | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as FontOverride
  const fontSize =
    typeof r.fontSize === 'number' && Number.isFinite(r.fontSize)
      ? Math.min(72, Math.max(8, Math.round(r.fontSize)))
      : undefined
  const bold = typeof r.bold === 'boolean' ? r.bold : undefined
  if (fontSize == null && bold == null) return undefined
  return { ...(fontSize != null ? { fontSize } : {}), ...(bold != null ? { bold } : {}) }
}

/** 載入檔案時補齊欄位；舊檔沒有題目資料則回傳空試卷 */
export function normalizeExam(raw: unknown): ExamContent {
  if (!raw || typeof raw !== 'object') return createEmptyExam()
  const r = raw as Partial<ExamContent>
  const sections = Array.isArray(r.sections) ? r.sections : []
  const assets = r.assets && typeof r.assets === 'object' ? r.assets : {}
  return {
    numbering: r.numbering === 'perSection' ? 'perSection' : 'continuous',
    assets,
    sections: sections.map((s) => {
      const base = createSection()
      const defaultType = QUESTION_TYPES.includes(s.defaultType) ? s.defaultType : base.defaultType
      return {
        ...base,
        ...s,
        defaultType,
        keepTogether: s.keepTogether === 'whole' ? 'whole' : 'firstChild',
        headingStyle: normalizeFontOverride(s.headingStyle),
        instructionStyle: normalizeFontOverride(s.instructionStyle),
        questions: (Array.isArray(s.questions) ? s.questions : []).map((item) => {
          const type = QUESTION_TYPES.includes(item.type) ? item.type : 'single_choice'
          return {
            ...createQuestion(type, 0),
            ...item,
            type,
            bodyStyle: normalizeFontOverride(item.bodyStyle),
            choices: (Array.isArray(item.choices) ? item.choices : []).map((c) =>
              c.image && !assets[c.image.assetId] ? { id: c.id, text: c.text } : c,
            ),
            figures: (Array.isArray(item.figures) ? item.figures : []).filter((f) => f && assets[f.assetId]),
          }
        }),
      }
    }),
  }
}
