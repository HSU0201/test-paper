import { plainText } from '../editor/richText'

export type QuestionType = 'single_choice' | 'multi_choice' | 'fill_blank' | 'short_answer'

/** 這一題是否用注音出題。未設則跟隨大題。 */
export function questionUsesZhuyin(section: { zhuyin?: boolean }, question: { zhuyin?: boolean }): boolean {
  return typeof question.zhuyin === 'boolean' ? question.zhuyin : section.zhuyin === true
}

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

/** 題目文字裡的插圖位置。排版時會拿掉，不會印出來。半形 [圖] 也認。 */
export const FIGURE_MARK = '［圖］'

const FIGURE_MARK_PATTERN = /[\[［]\s*圖\s*[\]］]/

export function hasFigureMark(stem: string): boolean {
  return FIGURE_MARK_PATTERN.test(stem)
}

/** 拿掉插圖標記。整行只有標記時，那一行也刪掉，避免拖曳後多出空白行 */
export function stripFigureMarks(stem: string): string {
  const clear = (line: string) => line.replace(new RegExp(FIGURE_MARK_PATTERN.source, 'g'), '')
  return stem
    .split('\n')
    .filter((line) => !(FIGURE_MARK_PATTERN.test(line) && clear(line).trim() === ''))
    .map(clear)
    .join('\n')
}

export function splitFigureMarks(stem: string): string[] {
  return stem.split(new RegExp(FIGURE_MARK_PATTERN.source, 'g'))
}

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

/** none：不畫框；body：只框題目；all：標題和題目一起框 */
export type SectionFrame = 'none' | 'body' | 'all'

/** flow：由上往下；rows：每一題一列，適合直式計算 */
export type SectionLayout = 'flow' | 'rows'

/** dot：1. ；paren：(1) */
export type NumberStyle = 'dot' | 'paren'

/** 舊版提示框。載入時會轉成頁尾開關，不再依大題拖位置 */
export type Notice = {
  id: string
  text: string
  /** 接在這個大題後面。null 表示放在卷末 */
  afterSectionId: string | null
}

export const NOTICE_CONTINUE = '下一頁還有題目！'
export const NOTICE_END = '作答結束，請仔細檢查！'
export const FOOTER_CONTINUE_ID = 'continue'
export const FOOTER_END_ID = 'end'

/** 卷末提示。有下一頁時印 continue；end 接在最後一題下面 */
export type ExamFooter = {
  continueOn: boolean
  endOn: boolean
  continueText: string
  endText: string
}

export function createDefaultFooter(): ExamFooter {
  return {
    continueOn: false,
    endOn: false,
    continueText: NOTICE_CONTINUE,
    endText: NOTICE_END,
  }
}

export function footerOf(exam: ExamContent): ExamFooter {
  return exam.footer ?? createDefaultFooter()
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
  /** 問答留白是否畫底線。false 只留空白 */
  answerRuled: boolean
  /**
   * 直式表格這一列要幾行。沒填，或是 0，就跟著大題「每列至少」。
   * 填了別的數字，只有這一題不同。
   */
  rowLines?: number
  /** 直式表格右側欄，例如「驗算：」。空字串表示這一列不拆開 */
  aside: string
  /**
   * 右側欄佔這一列內容寬的百分比。沒填或 0 就用預設。
   * 只有右側欄有文字時，這一列才會照這個寬度拆開。
   */
  asideWidth?: number
  /**
   * 與下一題並排，各佔半列。設在左邊那一題。
   * 直式表格中間有分隔線；一般排列中間留空隙。
   * 右邊那一題若也打開，排版時會略過，避免三題擠在同一列。
   */
  pairNext?: boolean
  figures: Figure[]
  /**
   * 每格計分時的格數。未設則依題幹裡的（ ）與底線計算，
   * 所以第一題 5 格、第二題 4 格可以各自對上。
   */
  blanks?: number
  /** 題號、題幹、選項；未設則用全卷「小題題文」 */
  bodyStyle?: FontOverride
  /** 未設則跟隨大題。有注音時音節與作答空格不會在換行時被拆開 */
  zhuyin?: boolean
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
  /** 這一題要不要用線框起來 */
  frame: SectionFrame
  /** 題目直向排列，或收成直式表格 */
  layout: SectionLayout
  /** 直式表格每一列至少幾行。小題沒有另設列高時，每一題都用這個行數 */
  rowLines: number
  /** 小題題號寫成 1. 或 (1) */
  numberStyle: NumberStyle
  /**
   * 這一大題的小題怎麼並排。
   * 1：一題一列（各題仍可用「與下一題同一列」）。
   * 2：兩題一列，1 跟 2、3 跟 4，最後剩一題就獨佔。
   * all：全部小題排在同一列。
   */
  rowSize: 1 | 2 | 'all'
  /** 這一題用注音出題。新的小題跟著這個設定，各題仍可單獨改 */
  zhuyin: boolean
}

export type QuestionNumbering = 'continuous' | 'perSection'

export type ExamContent = {
  numbering: QuestionNumbering
  sections: Section[]
  /** 圖片資料（data URL），由 Figure.assetId 參照 */
  assets: Record<string, Asset>
  /** 續頁提示與作答結束。位置由排版決定，這裡只開關與文字 */
  footer: ExamFooter
}

/** header：頁首欄位；notice：提示框 */
export type BlockRef = { kind: 'section' | 'question' | 'header' | 'notice'; id: string }

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
  const text = plainText(stem).replace(new RegExp(FIGURE_MARK_PATTERN.source, 'g'), '')
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

export function sectionRowSize(section: Section): 1 | 2 | 'all' {
  return section.rowSize === 2 || section.rowSize === 'all' ? section.rowSize : 1
}

/** 這一題若與其他題同一列，回傳那一列從哪一題開始、共幾題 */
export function questionRowGroup(section: Section, index: number): { start: number; count: number } | null {
  const qs = section.questions
  if (index < 0 || index >= qs.length) return null
  const size = sectionRowSize(section)
  if (size === 'all') return qs.length > 1 ? { start: 0, count: qs.length } : null
  if (size === 2) {
    const start = index - (index % 2)
    const count = Math.min(2, qs.length - start)
    return count > 1 ? { start, count } : null
  }
  let i = 0
  while (i < qs.length) {
    if (qs[i].pairNext && i + 1 < qs.length) {
      if (index === i || index === i + 1) return { start: i, count: 2 }
      i += 2
    } else {
      if (index === i) return null
      i += 1
    }
  }
  return null
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
  if (hasFigureMark(stem)) {
    const raw = splitFigureMarks(stem)
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
  let have = splitFigureMarks(next).length - 1
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
    answerRuled: true,
    aside: '',
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
    frame: 'none',
    layout: 'flow',
    rowLines: 4,
    numberStyle: 'dot',
    rowSize: 1,
    zhuyin: false,
  }
}

export function isChoiceType(t: QuestionType): boolean {
  return t === 'single_choice' || t === 'multi_choice'
}

function q(
  type: QuestionType,
  score: number,
  stem: string,
  choices: Array<string | { text: string; image?: ChoiceImage }> = [],
  answer = '',
): Question {
  return {
    ...createQuestion(type, score),
    stem,
    choices: choices.map((item) => {
      const text = typeof item === 'string' ? item : item.text
      const image = typeof item === 'string' ? undefined : item.image
      return { id: newId(), text, ...(image ? { image } : {}) }
    }),
    answer,
  }
}

function sampleSvg(width: number, height: number, inner: string, framed = true): Asset {
  const frame = framed
    ? `<rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="8" fill="#fffaf0" stroke="#3a2e10" stroke-width="2"/>`
    : ''
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${frame}${inner}</svg>`
  return { src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, width, height }
}

function figure(assetId: string, placement: FigurePlacement, widthRatio: number, align?: number): Figure {
  return {
    id: newId(),
    assetId,
    placement,
    widthRatio,
    ...(align != null ? { align } : {}),
  }
}

/**
 * 空白試卷用的排版目錄：四種題型，加上選項欄數、外框、底線、
 * 直式表格、配分寫法，以及圖片可以放的位置。
 */
export function createSampleExam(): ExamContent {
  const assets: Record<string, Asset> = {}
  const add = (asset: Asset) => {
    const id = newId()
    assets[id] = asset
    return id
  }
  const triangle = add(
    sampleSvg(160, 110, `<polygon points="80,22 28,92 132,92" fill="#f0c431" stroke="#3a2e10" stroke-width="2"/>`),
  )
  const plot = add(
    sampleSvg(180, 96, `<rect x="28" y="22" width="124" height="54" fill="#dbeafe" stroke="#1d4ed8" stroke-width="2"/>`),
  )
  const badge = add(sampleSvg(96, 96, `<circle cx="48" cy="48" r="28" fill="#fee2e2" stroke="#d92d20" stroke-width="3"/>`))
  const bars = add(
    sampleSvg(
      180,
      84,
      `<rect x="28" y="40" width="28" height="28" fill="#f0c431"/><rect x="68" y="24" width="28" height="44" fill="#1d4ed8"/><rect x="108" y="32" width="28" height="36" fill="#1f7a45"/>`,
    ),
  )
  const iconRed = add(sampleSvg(64, 64, `<circle cx="32" cy="32" r="22" fill="#d92d20"/>`, false))
  const iconBlue = add(sampleSvg(64, 64, `<rect x="12" y="12" width="40" height="40" rx="4" fill="#1d4ed8"/>`, false))
  const iconGreen = add(sampleSvg(64, 64, `<polygon points="32,8 56,54 8,54" fill="#1f7a45"/>`, false))
  const pic = (assetId: string, widthRatio: number): ChoiceImage => ({ assetId, widthRatio })

  const single = createSection('單選題', 'single_choice')
  single.defaultScore = 4
  single.instruction = '選項可排成四欄、兩欄或一欄，也可以在選項放圖。'
  single.questions = [
    {
      ...q('single_choice', 4, '下列哪一個數是{{#d92d20}}質數{{/}}？', ['21', '27', '29', '33'], 'C'),
      choiceLayout: 4,
    },
    {
      ...q(
        'single_choice',
        4,
        '若一個長方形的長是 12 公分、寬是 5 公分，它的周長是多少？',
        ['17 公分', '24 公分', '34 公分', '60 公分'],
        'C',
      ),
      choiceLayout: 2,
    },
    {
      ...q(
        'single_choice',
        4,
        '下列哪一個敘述是正確的？',
        [
          '所有的質數都是奇數。',
          '兩個奇數相加，和一定是偶數。',
          '一個數只要能被 2 整除，就一定是 4 的倍數。',
          '0 是最小的正整數。',
        ],
        'B',
      ),
      choiceLayout: 1,
      bodyStyle: { bold: true },
    },
    {
      ...q('single_choice', 4, '哪一個選項是圓形？', [
        { text: '', image: pic(iconRed, 0.85) },
        { text: '', image: pic(iconBlue, 0.85) },
        { text: '三角形', image: pic(iconGreen, 0.7) },
        '只有文字、沒有圖',
      ], 'A'),
      choiceLayout: 2,
    },
  ]

  const multi = createSection('多選題', 'multi_choice')
  multi.defaultScore = 4
  multi.frame = 'body'
  multi.instruction = '外框只圍住題目，標題留在框外。圖放在選項後面。'
  multi.questions = [
    {
      ...q('multi_choice', 4, '下列哪些是偶數？', ['2', '5', '8', '11'], 'A、C'),
      choiceLayout: 4,
    },
    {
      ...q('multi_choice', 4, '看完選項後，圖在選項的下面。哪些長條比較高？', ['左', '中', '右'], 'B'),
      figures: [figure(bars, 'afterChoices', 0.55)],
      choiceLayout: 4,
    },
  ]

  const fill = createSection('填充題', 'fill_blank')
  fill.defaultScore = 2
  fill.scoreMode = 'blank'
  fill.blankScore = 2
  fill.instruction = '（　　）和底線各算一格，每格分數相同，各題格數可以不同。'
  fill.questions = [
    q('fill_blank', 2, '3 的平方是（　　）。', [], '9'),
    q('fill_blank', 2, '長 8 公分、寬 3 公分的長方形，周長是＿＿＿＿公分，面積是＿＿＿＿平方公分。', [], '22；24'),
    {
      ...q('fill_blank', 2, '觀察圖形。\n［圖］\n這個三角形的底是＿＿＿＿公分。', [], '8'),
      figures: [figure(triangle, 'middle', 0.46, 0)],
    },
  ]

  const essay = createSection('問答題', 'short_answer')
  essay.defaultScore = 8
  essay.frame = 'all'
  essay.headingStyle = { fontSize: 20 }
  essay.instruction = '標題和題目框在一起。作答區可以畫底線，也可以只留白。各題分數不同時，會寫在題號後面。'
  essay.questions = [
    {
      ...q('short_answer', 6, '小明買了 3 枝筆和 2 本筆記本共花了 110 元，一枝筆 20 元。一本筆記本多少元？'),
      answerLines: 3,
    },
    {
      ...q('short_answer', 6, '用自己的話說說，什麼是質數？'),
      answerLines: 3,
      answerRuled: false,
    },
    {
      ...q('short_answer', 10, '圖在題目右側。請說明這個圓形記號可能代表什麼，並寫出一個例子。'),
      answerLines: 3,
      figures: [figure(badge, 'right', 0.55)],
    },
    {
      ...q('short_answer', 8, '圖在題目下方。請依照圖中的長方形，寫出周長怎麼算。'),
      answerLines: 3,
      figures: [figure(plot, 'below', 0.62)],
    },
  ]

  const table = createSection('直式計算', 'short_answer')
  table.defaultScore = 5
  table.layout = 'rows'
  table.rowLines = 3
  table.numberStyle = 'paren'
  table.keepTogether = 'whole'
  table.instruction = '每一題一列。(1) 右側留驗算，(2) 與 (3) 並排，(4) 這一列比較高。'
  table.questions = [
    { ...q('short_answer', 5, '36 × 4 ='), aside: '驗算：' },
    { ...q('short_answer', 5, '70 − 28 ='), pairNext: true },
    q('short_answer', 5, '15 + 9 ='),
    { ...q('short_answer', 5, '128 ÷ 4 ='), rowLines: 6 },
  ]

  return {
    numbering: 'perSection',
    sections: [single, multi, fill, essay, table],
    assets,
    footer: { ...createDefaultFooter(), continueOn: true, endOn: true },
  }
}

export function createEmptyExam(): ExamContent {
  return { numbering: 'continuous', sections: [], assets: {}, footer: createDefaultFooter() }
}

const QUESTION_TYPES = Object.keys(QUESTION_TYPE_LABEL) as QuestionType[]
const FIGURE_PLACEMENTS: FigurePlacement[] = ['below', 'middle', 'right', 'afterChoices']

function clampScore(n: unknown, fallback: number): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : fallback
  return Math.min(100, Math.max(0, Math.round(v)))
}

function clampRowLines(n: unknown): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? Math.round(n) : 4
  return Math.min(12, Math.max(2, v))
}

function clampQuestionRowLines(n: unknown): number | undefined {
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return undefined
  return Math.min(20, Math.max(2, Math.round(n)))
}

/** 直式表格這一列要幾行。小題有另設就用小題的，否則每一題都用大題的「每列至少」。 */
export function questionRowLines(section: Section, q: Question): number {
  const custom = clampQuestionRowLines(q.rowLines)
  return custom ?? clampRowLines(section.rowLines)
}

/** 右側欄預設佔這一列內容寬的百分比 */
export const ASIDE_WIDTH_DEFAULT = 38
export const ASIDE_WIDTH_MIN = 15
export const ASIDE_WIDTH_MAX = 75

export function clampAsideWidth(n: unknown): number | undefined {
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return undefined
  return Math.min(ASIDE_WIDTH_MAX, Math.max(ASIDE_WIDTH_MIN, Math.round(n)))
}

/** 這一列右側欄佔內容寬的百分比。沒另設就用預設。 */
export function questionAsideWidth(q: Question): number {
  return clampAsideWidth(q.asideWidth) ?? ASIDE_WIDTH_DEFAULT
}

/** 右側欄左緣距內容左緣的距離。rightPercent 是右側欄佔內容寬的百分比。兩側都留得下文字。 */
export function asideLeftEdge(inner: number, rightPercent: number): number {
  const wanted = Math.round((inner * (100 - rightPercent)) / 100)
  const minSide = 36
  if (inner <= minSide * 2) return Math.max(8, Math.round(inner / 2))
  return Math.min(inner - minSide, Math.max(minSide, wanted))
}

function normalizeFooter(raw: unknown, legacyNotices: unknown): ExamFooter {
  const base = createDefaultFooter()
  if (raw && typeof raw === 'object') {
    const f = raw as Partial<ExamFooter>
    return {
      continueOn: f.continueOn === true,
      endOn: f.endOn === true,
      continueText: typeof f.continueText === 'string' && f.continueText.trim() ? f.continueText : base.continueText,
      endText: typeof f.endText === 'string' && f.endText.trim() ? f.endText : base.endText,
    }
  }
  const footer = { ...base }
  if (!Array.isArray(legacyNotices)) return footer
  for (const item of legacyNotices) {
    if (!item || typeof item !== 'object') continue
    const text = typeof (item as Notice).text === 'string' ? (item as Notice).text : ''
    if (!text.trim()) continue
    if (text.includes('作答結束')) {
      footer.endOn = true
      footer.endText = text
    } else {
      footer.continueOn = true
      footer.continueText = text
    }
  }
  return footer
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
    footer: normalizeFooter(r.footer, (r as { notices?: unknown }).notices),
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
        frame: s.frame === 'body' || s.frame === 'all' ? s.frame : 'none',
        layout: s.layout === 'rows' ? 'rows' : 'flow',
        rowLines: clampRowLines(s.rowLines),
        rowSize: s.rowSize === 2 || s.rowSize === 'all' ? s.rowSize : 1,
        numberStyle: s.numberStyle === 'paren' ? 'paren' : 'dot',
        zhuyin: s.zhuyin === true,
        headingStyle: normalizeFontOverride(s.headingStyle),
        instructionStyle: normalizeFontOverride(s.instructionStyle),
        questions: (Array.isArray(s.questions) ? s.questions : []).map((item) => {
          const type = QUESTION_TYPES.includes(item.type) ? item.type : 'single_choice'
          const blanks =
            typeof item.blanks === 'number' && Number.isFinite(item.blanks)
              ? Math.min(30, Math.max(0, Math.round(item.blanks)))
              : undefined
          const rowLines = clampQuestionRowLines(item.rowLines)
          const asideWidth = clampAsideWidth(item.asideWidth)
          const question: Question = {
            ...createQuestion(type, 0),
            ...item,
            type,
            blanks,
            answerRuled: item.answerRuled === false ? false : true,
            aside: typeof item.aside === 'string' ? item.aside : '',
            pairNext: item.pairNext === true,
            zhuyin: item.zhuyin === true ? true : item.zhuyin === false ? false : undefined,
            bodyStyle: normalizeFontOverride(item.bodyStyle),
            choices: (Array.isArray(item.choices) ? item.choices : []).map((c) =>
              c.image && !assets[c.image.assetId] ? { id: c.id, text: c.text } : c,
            ),
            figures: (Array.isArray(item.figures) ? item.figures : [])
              .map((f) => normalizeFigure(f, assets))
              .filter((f): f is Figure => !!f),
          }
          if (rowLines == null) delete question.rowLines
          else question.rowLines = rowLines
          if (asideWidth == null) delete question.asideWidth
          else question.asideWidth = asideWidth
          return question
        }),
      }
    }),
  }
}
