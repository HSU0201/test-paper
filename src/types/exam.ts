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

/** below：題幹之後；middle：題幹文字中間；right：題目右側；afterChoices：選項之後 */
export type FigurePlacement = 'below' | 'middle' | 'right' | 'afterChoices'

/** 題目文字裡的插圖位置。排版時會拿掉，不會印出來。 */
export const FIGURE_MARK = '［圖］'

/** 題目內的圖片，跟著題目一起排版、移動 */
export type Figure = {
  id: string
  assetId: string
  placement: FigurePlacement
  /** 佔題目內容寬度的比例 */
  widthRatio: number
  /** 0 靠左、1 靠右。未設時，文字中間靠左，其餘置中 */
  align?: number
  /**
   * 文中：圖片前面留幾行題幹（直排則是幾個字）。0 表示題幹最前面。
   * 在卷面上上下拖曳圖片會改這個值。
   */
  afterLine?: number
}

/** each：每題配分；blank：每格固定分數，各題格數可以不同 */
export type ScoreMode = 'each' | 'blank'

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
  /**
   * 每格計分時的格數。未設則依題幹裡的（ ）與底線計算，
   * 所以第一題 5 格、第二題 4 格可以各自對上。
   */
  blanks?: number
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
  /** 配分寫在大題標題最後：每題，或每格固定分數 */
  scoreMode: ScoreMode
  /** 每格幾分。scoreMode 為 blank 時使用 */
  blankScore: number
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

/** 題幹裡一個（ ）或一段底線算一格 */
export function countAnswerBlanks(stem: string): number {
  const text = plainText(stem).replaceAll(FIGURE_MARK, '')
  return text.match(/（[\s　]*）|\([\s]*\)|＿{2,}|_{2,}/g)?.length ?? 0
}

export function questionBlankCount(q: Question): number {
  if (typeof q.blanks === 'number' && Number.isFinite(q.blanks)) return Math.max(0, Math.round(q.blanks))
  return countAnswerBlanks(q.stem)
}

export function sectionBlankUnit(s: Section): number {
  const n = Number(s.blankScore)
  return Number.isFinite(n) ? n : 0
}

/** 這一題實際占的分數。每格計分時是格數乘以每格分數 */
export function questionPoints(s: Section, q: Question): number {
  if (s.scoreMode === 'blank') return questionBlankCount(q) * sectionBlankUnit(s)
  const n = Number(q.score)
  return Number.isFinite(n) ? n : 0
}

export function sectionScore(s: Section): number {
  return s.questions.reduce((sum, q) => sum + questionPoints(s, q), 0)
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

function storedScore(q: Question): number {
  const n = Number(q.score)
  return Number.isFinite(n) ? n : 0
}

/** 大題內每題分數相同時回傳該分數；沒有小題或分數不一則為 null。每格計分不走這條 */
export function uniformQuestionScore(s: Section): number | null {
  if (s.scoreMode === 'blank' || !s.questions.length) return null
  const first = storedScore(s.questions[0])
  return s.questions.every((q) => storedScore(q) === first) ? first : null
}

/**
 * 配分一律接在大題標題最後。
 * 每格固定分數時寫「每格N分・共T分」，即使各題格數不同也不拆開。
 */
export function sectionScoreNote(s: Section): string {
  if (!s.questions.length) return ''
  const total = sectionScore(s)
  if (s.scoreMode === 'blank') return `（每格${sectionBlankUnit(s)}分・共${total}分）`
  const each = uniformQuestionScore(s)
  return each == null ? `（共 ${total} 分）` : `（每題 ${each} 分，共 ${total} 分）`
}

/**
 * 小題配分不同時印在題號後。
 * 每格固定分數時各題總分可能不同（5 格、4 格），這種情況不列在題號前。
 */
export function questionScoreMark(section: Section, q: Question): string {
  if (section.scoreMode === 'blank') return ''
  if (uniformQuestionScore(section) != null) return ''
  return `（${storedScore(q)} 分）`
}

function tidySegment(text: string, index: number, count: number): string {
  let t = text
  if (index > 0) t = t.replace(/^\n/, '')
  if (index < count - 1) t = t.replace(/\n$/, '')
  return t
}

/**
 * 題幹怎麼被「文字中間」的圖切開。
 * parts 是要印出的文字；slots[i] 是這段文字後面要放幾張圖。
 * 有［圖］就依標記切開；沒有標記時，有圖就放在第一行後面。
 */
export function planStemFigures(stem: string, middleCount: number): { parts: string[]; slots: number[] } {
  const count = Math.max(0, middleCount)
  if (stem.includes(FIGURE_MARK)) {
    const raw = stem.split(FIGURE_MARK)
    const parts = raw.map((p, i) => tidySegment(p, i, raw.length))
    const slots: number[] = parts.map((_, i) => (i < parts.length - 1 ? 1 : 0))
    const gaps = parts.length - 1
    if (count > gaps) {
      if (gaps > 0) slots[gaps - 1] += count - gaps
      else slots[0] = count
    } else {
      for (let i = count; i < gaps; i++) slots[i] = 0
    }
    return { parts, slots }
  }
  if (count > 0) {
    const nl = stem.indexOf('\n')
    if (nl >= 0) return { parts: [stem.slice(0, nl), stem.slice(nl + 1)], slots: [count, 0] }
    return { parts: [stem], slots: [count] }
  }
  return { parts: [stem], slots: [0] }
}

/** 讓題幹至少有 count 個［圖］。多的不刪，方便使用者自己搬位置。 */
export function ensureFigureMarks(stem: string, count: number): string {
  let next = stem
  let have = next.split(FIGURE_MARK).length - 1
  while (have < count) {
    if (!next.trim()) next = FIGURE_MARK
    else {
      const nl = next.indexOf('\n')
      next = nl < 0 ? `${next}\n${FIGURE_MARK}\n` : `${next.slice(0, nl)}\n${FIGURE_MARK}${next.slice(nl)}`
    }
    have += 1
  }
  return next
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
    scoreMode: 'each',
    blankScore: 2,
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
const FIGURE_PLACEMENTS: FigurePlacement[] = ['below', 'middle', 'right', 'afterChoices']

function clampScore(n: unknown, fallback: number): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : fallback
  return Math.min(100, Math.max(0, Math.round(v)))
}

function normalizeFigure(f: Figure | undefined, assets: Record<string, Asset>): Figure | null {
  if (!f?.assetId || !assets[f.assetId]) return null
  const placement = FIGURE_PLACEMENTS.includes(f.placement) ? f.placement : 'below'
  const widthRatio =
    typeof f.widthRatio === 'number' && Number.isFinite(f.widthRatio) ? Math.min(1, Math.max(0.15, f.widthRatio)) : 0.6
  const align =
    typeof f.align === 'number' && Number.isFinite(f.align) ? Math.min(1, Math.max(0, f.align)) : undefined
  const afterLine =
    placement === 'middle' && typeof f.afterLine === 'number' && Number.isFinite(f.afterLine)
      ? Math.max(0, Math.round(f.afterLine))
      : undefined
  return {
    id: f.id || crypto.randomUUID(),
    assetId: f.assetId,
    placement,
    widthRatio,
    ...(align != null ? { align } : {}),
    ...(afterLine != null ? { afterLine } : {}),
  }
}

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
        scoreMode: s.scoreMode === 'blank' ? 'blank' : 'each',
        blankScore: clampScore(s.blankScore, clampScore(s.defaultScore, base.defaultScore)),
        headingStyle: normalizeFontOverride(s.headingStyle),
        instructionStyle: normalizeFontOverride(s.instructionStyle),
        questions: (Array.isArray(s.questions) ? s.questions : []).map((item) => {
          const type = QUESTION_TYPES.includes(item.type) ? item.type : 'single_choice'
          const blanks =
            typeof item.blanks === 'number' && Number.isFinite(item.blanks)
              ? Math.min(30, Math.max(0, Math.round(item.blanks)))
              : undefined
          return {
            ...createQuestion(type, 0),
            ...item,
            type,
            blanks,
            bodyStyle: normalizeFontOverride(item.bodyStyle),
            choices: (Array.isArray(item.choices) ? item.choices : []).map((c) =>
              c.image && !assets[c.image.assetId] ? { id: c.id, text: c.text } : c,
            ),
            figures: (Array.isArray(item.figures) ? item.figures : [])
              .map((f) => normalizeFigure(f, assets))
              .filter((f): f is Figure => !!f),
          }
        }),
      }
    }),
  }
}
