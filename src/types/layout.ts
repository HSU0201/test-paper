import type { Box } from '../editor/bounds'
import { plainText } from '../editor/richText'

/** 頁首欄位角色；custom 為使用者自行新增 */
export type HeaderRole =
  | 'schoolName'
  | 'examTitle'
  | 'subject'
  | 'classInfo'
  | 'seatNo'
  | 'studentName'
  | 'examDate'
  | 'duration'
  | 'totalScore'
  | 'teacher'
  | 'parentSign'
  | 'custom'

export type HeaderAlign = 'left' | 'center' | 'right'

/**
 * 頁首上的單一欄位。水平位置以內容區寬度比例儲存（換紙張、橫直向時自動縮放），
 * 垂直位置以 px 儲存（相對於頁首區頂端）。
 */
export type HeaderItem = {
  id: string
  role: HeaderRole
  label: string
  value: string
  showLabel: boolean
  visible: boolean
  xr: number
  wr: number
  y: number
  fontSize: number
  bold: boolean
  align: HeaderAlign
  fill: string
}

export type HeaderLayout = {
  /** 頁首區高度（px） */
  height: number
  /** 頁首下方分隔線 */
  rule: boolean
  /** 每頁都印頁首；否則只印第一頁 */
  repeat: boolean
  items: HeaderItem[]
}

/** auto：直向左右分欄、橫向上下分欄 */
export type ColumnSplit = 'auto' | 'vertical' | 'horizontal'

export type ColumnLayout = {
  count: 1 | 2
  split: ColumnSplit
  gap: number
  /** 第一欄佔比例（0.3–0.7） */
  ratio: number
  divider: boolean
}

export type SpacingRange = { nominal: number; min: number }

export type SpacingSettings = {
  lineHeight: SpacingRange
  questionGap: SpacingRange
  sectionGap: SpacingRange
  /** 內容快溢出時自動在 nominal 與 min 之間壓縮 */
  allowSqueeze: boolean
}

export type PageMargin = { top: number; right: number; bottom: number; left: number }

export type PaperLayout = {
  margin: PageMargin
  header: HeaderLayout
  columns: ColumnLayout
  spacing: SpacingSettings
}

export const HEADER_ROLE_LABEL: Record<HeaderRole, string> = {
  schoolName: '學校名稱',
  examTitle: '試卷名稱',
  subject: '科目',
  classInfo: '班級',
  seatNo: '座號',
  studentName: '姓名',
  examDate: '日期',
  duration: '作答時間',
  totalScore: '滿分',
  teacher: '出題者',
  parentSign: '家長簽名',
  custom: '自訂欄位',
}

type Seed = Omit<HeaderItem, 'id' | 'label' | 'fill'> & { label?: string }

const DEFAULT_ITEMS: Seed[] = [
  { role: 'schoolName', value: '臺中市烏日區中興國民小學', showLabel: false, visible: true, xr: 0, wr: 1, y: 0, fontSize: 20, bold: true, align: 'center' },
  { role: 'examTitle', value: '115 學年度第一學期二年級數學第一次定期評量', showLabel: false, visible: true, xr: 0, wr: 1, y: 0, fontSize: 20, bold: true, align: 'center' },
  { role: 'teacher', label: '出題者', value: '陳大師 老師', showLabel: true, visible: true, xr: 0.02, wr: 0.24, y: 40, fontSize: 16, bold: false, align: 'left' },
  { role: 'classInfo', value: '二年甲班', showLabel: false, visible: true, xr: 0.28, wr: 0.12, y: 40, fontSize: 16, bold: false, align: 'left' },
  { role: 'studentName', value: '', showLabel: true, visible: true, xr: 0.42, wr: 0.27, y: 40, fontSize: 16, bold: false, align: 'left' },
  { role: 'parentSign', label: '家長簽名', value: '', showLabel: true, visible: true, xr: 0.71, wr: 0.27, y: 40, fontSize: 16, bold: false, align: 'left' },
  { role: 'subject', value: '數學', showLabel: true, visible: false, xr: 0.02, wr: 0.18, y: 74, fontSize: 16, bold: false, align: 'left' },
  { role: 'seatNo', value: '', showLabel: true, visible: false, xr: 0.22, wr: 0.16, y: 74, fontSize: 16, bold: false, align: 'left' },
  { role: 'examDate', value: '', showLabel: true, visible: false, xr: 0.4, wr: 0.22, y: 74, fontSize: 16, bold: false, align: 'left' },
  { role: 'duration', value: '', showLabel: true, visible: false, xr: 0.64, wr: 0.18, y: 74, fontSize: 16, bold: false, align: 'left' },
  { role: 'totalScore', value: '', showLabel: true, visible: false, xr: 0.84, wr: 0.14, y: 74, fontSize: 16, bold: false, align: 'left' },
]

const HEADER_TEXT_COLOR = '#000000'

export function createHeaderItem(seed: Seed): HeaderItem {
  return {
    id: crypto.randomUUID(),
    label: seed.label ?? HEADER_ROLE_LABEL[seed.role],
    fill: HEADER_TEXT_COLOR,
    ...seed,
  }
}

export function createCustomHeaderItem(y: number): HeaderItem {
  return createHeaderItem({
    role: 'custom',
    label: '得分',
    value: '',
    showLabel: true,
    visible: true,
    xr: 0.7,
    wr: 0.3,
    y,
    fontSize: 14,
    bold: false,
    align: 'right',
  })
}

export function createDefaultHeader(): HeaderLayout {
  return { height: 74, rule: true, repeat: false, items: DEFAULT_ITEMS.map(createHeaderItem) }
}

const TITLE_BAND_ROLES = new Set<HeaderRole>(['schoolName', 'examTitle'])

/**
 * 學校名稱與試卷名稱同一列、幾乎整行寬時，合成一行置中標題。
 * 把寬度拉到 85% 以下，或拖離同一列，就恢復各自排版。字級與粗體仍各自生效。
 */
export function titleBandItems(items: HeaderItem[]): HeaderItem[] | null {
  const mates = items.filter((it) => it.visible && TITLE_BAND_ROLES.has(it.role))
  if (!mates.length) return null
  const y0 = mates[0].y
  if (!mates.every((it) => Math.abs(it.y - y0) <= 4 && it.wr >= 0.85)) return null
  const order: HeaderRole[] = ['schoolName', 'examTitle']
  return [...mates].sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role))
}

/** 舊版預設文字。還原版型或升級舊檔時，沒改過的欄位才換成現在的範例 */
const LEGACY_HEADER_VALUE: Partial<Record<HeaderRole, string>> = {
  schoolName: '○○市立○○國民中學',
  examTitle: '115 學年度第一學期 第一次段考',
  subject: '數學',
  teacher: '○○○ 老師',
}

const LEGACY_HEADER_LABEL: Partial<Record<HeaderRole, string>> = {
  teacher: '出題老師',
}

/** 還沒有家長簽名，或仍是第一版橫排座標時，套上目前的頁首位置 */
function headerNeedsBannerPlacement(header: HeaderLayout): boolean {
  if (!header.items.some((it) => it.role === 'parentSign')) return true
  const teacher = header.items.find((it) => it.role === 'teacher')
  const name = header.items.find((it) => it.role === 'studentName')
  const school = header.items.find((it) => it.role === 'schoolName')
  const title = header.items.find((it) => it.role === 'examTitle')
  const oldInfoRow = teacher?.y === 38 && teacher.xr === 0.02 && teacher.wr === 0.26 && name?.xr === 0.43 && name.wr === 0.24
  const smallTitle = school?.fontSize === 16 && !school.bold && title?.fontSize === 16 && !title.bold && school.y === 10
  const overflowTitle = school?.fontSize === 22 && school.bold && title?.fontSize === 22 && title.bold && school.y === 0
  return oldInfoRow || smallTitle || overflowTitle
}

/** 套用目前的頁首位置，已改過的文字與自訂欄位保留 */
export function withDefaultHeaderPlacement(old: HeaderLayout): HeaderLayout {
  const defaults = createDefaultHeader()
  const items = defaults.items.map((d) => {
    const prev = old.items.find((it) => it.role === d.role)
    if (!prev) return d
    const legacyValue = LEGACY_HEADER_VALUE[d.role]
    const valueIsLegacy = legacyValue !== undefined ? prev.value === legacyValue : prev.value.trim() === ''
    const value = valueIsLegacy ? d.value : prev.value
    const label =
      prev.label === d.label || prev.label === HEADER_ROLE_LABEL[d.role] || prev.label === LEGACY_HEADER_LABEL[d.role]
        ? d.label
        : prev.label
    const visible = d.visible || (!valueIsLegacy && prev.visible)
    return { ...d, id: prev.id, value, label, visible }
  })
  const customs = old.items.filter((it) => it.role === 'custom')
  const placed = [...items, ...customs]
  const bottom = placed
    .filter((it) => it.visible)
    .reduce((max, it) => Math.max(max, it.y + Math.ceil(it.fontSize * 1.4) + 6), defaults.height)
  return {
    height: Math.min(400, Math.max(defaults.height, Math.ceil(bottom))),
    rule: old.rule,
    repeat: old.repeat,
    items: placed,
  }
}

export function createDefaultLayout(): PaperLayout {
  return {
    margin: { top: 40, right: 44, bottom: 44, left: 44 },
    header: createDefaultHeader(),
    columns: { count: 2, split: 'auto', gap: 24, ratio: 0.5, divider: true },
    spacing: {
      lineHeight: { nominal: 1.6, min: 1.3 },
      questionGap: { nominal: 12, min: 4 },
      sectionGap: { nominal: 20, min: 8 },
      allowSqueeze: true,
    },
  }
}

/** 留白欄位的底線長度；給 boxWidth 時自動填滿欄寬（全形字寬約等於字級） */
export function headerItemText(item: HeaderItem, boxWidth?: number): string {
  const valuePlain = plainText(item.value).trim()
  const labelPlain = plainText(item.label)
  if (!item.showLabel) return item.value.trim()
  if (valuePlain) return `${item.label}：${item.value.trim()}`
  const blanks =
    boxWidth === undefined ? 6 : Math.max(2, Math.floor(boxWidth / item.fontSize - (labelPlain.length + 1) - 0.3))
  return `${item.label}：${'＿'.repeat(blanks)}`
}

export function headerItemHeight(item: HeaderItem): number {
  return Math.ceil(item.fontSize * 1.4)
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)

function normalizeRange(r: Partial<SpacingRange> | undefined, base: SpacingRange, lo: number, hi: number): SpacingRange {
  const nominal = clamp(num(r?.nominal, base.nominal), lo, hi)
  return { nominal, min: clamp(num(r?.min, base.min), lo, nominal) }
}

type LegacyHeader = Record<string, { label?: string; value?: string; visible?: boolean }>

/** 載入檔案時補齊欄位；舊版（固定頁首）會轉成可自由排版的欄位 */
export function normalizeLayout(raw: unknown): PaperLayout {
  const base = createDefaultLayout()
  if (!raw || typeof raw !== 'object') return base
  const r = raw as Partial<PaperLayout> & { headerRule?: boolean; columns?: Partial<ColumnLayout> & { leftRatio?: number } }

  let header = base.header
  const rh = r.header as Partial<HeaderLayout> | LegacyHeader | undefined
  if (rh && Array.isArray((rh as HeaderLayout).items)) {
    const h = rh as Partial<HeaderLayout>
    header = {
      height: clamp(num(h.height, base.header.height), 0, 400),
      rule: h.rule ?? true,
      repeat: h.repeat ?? false,
      items: (h.items ?? []).map((it) => ({ ...createHeaderItem({ ...DEFAULT_ITEMS[0], role: 'custom' }), ...it })),
    }
    if (headerNeedsBannerPlacement(header)) header = withDefaultHeaderPlacement(header)
  } else if (rh) {
    const legacy = rh as LegacyHeader
    header = {
      ...base.header,
      rule: r.headerRule ?? true,
      items: base.header.items.map((it) => {
        const old = legacy[it.role]
        return old ? { ...it, label: old.label ?? it.label, value: old.value ?? it.value, visible: old.visible ?? it.visible } : it
      }),
    }
  }

  const c: Partial<ColumnLayout> & { leftRatio?: number } = r.columns ?? {}
  const s = (r.spacing ?? {}) as Partial<SpacingSettings>
  return {
    margin: { ...base.margin, ...(r.margin ?? {}) },
    header,
    columns: {
      count: c.count === 1 ? 1 : 2,
      split: c.split === 'vertical' || c.split === 'horizontal' ? c.split : 'auto',
      gap: clamp(num(c.gap, base.columns.gap), 0, 120),
      ratio: clamp(num(c.ratio ?? c.leftRatio, 0.5), 0.3, 0.7),
      divider: c.divider ?? true,
    },
    spacing: {
      lineHeight: normalizeRange(s.lineHeight, base.spacing.lineHeight, 1, 3),
      questionGap: normalizeRange(s.questionGap, base.spacing.questionGap, 0, 80),
      sectionGap: normalizeRange(s.sectionGap, base.spacing.sectionGap, 0, 120),
      allowSqueeze: s.allowSqueeze ?? true,
    },
  }
}

export function resolveSplit(columns: ColumnLayout, pageW: number, pageH: number): 'vertical' | 'horizontal' {
  if (columns.split !== 'auto') return columns.split
  return pageW > pageH ? 'horizontal' : 'vertical'
}

export type LayoutRule = { key: string; x1: number; y1: number; x2: number; y2: number }

export type PageGeometry = {
  content: Box
  /** 本頁有頁首時的頁首區；橫向時在右側 */
  header: Box | null
  /** 橫向頁首：文字由上往下直排 */
  headerVertical: boolean
  /** 依閱讀順序排列的欄位 */
  frames: Box[]
  rules: LayoutRule[]
}

/** 直排時左右括號改成由上、下包住的形狀 */
const VERTICAL_BRACKETS: Record<string, string> = {
  '(': '\uFE35',
  ')': '\uFE36',
  '（': '\uFE35',
  '）': '\uFE36',
  '[': '\uFE47',
  ']': '\uFE48',
  '［': '\uFE47',
  '］': '\uFE48',
  '{': '\uFE37',
  '}': '\uFE38',
  '｛': '\uFE37',
  '｝': '\uFE38',
  '〔': '\uFE39',
  '〕': '\uFE3A',
  '【': '\uFE3B',
  '】': '\uFE3C',
  '「': '\uFE41',
  '」': '\uFE42',
  '『': '\uFE43',
  '』': '\uFE44',
  '〈': '\uFE3F',
  '〉': '\uFE40',
  '《': '\uFE3D',
  '》': '\uFE3E',
}

export function toVerticalGlyph(ch: string): string {
  return VERTICAL_BRACKETS[ch] ?? ch
}

/** 直排頁首：每個字獨立一行，閱讀方向由上往下 */
export function verticalHeaderText(text: string): string {
  return [...text].map(toVerticalGlyph).join('\n')
}

/** 計算某一頁的內容區、頁首區與欄位（排版、繪製、吸附共用） */
export function computePageGeometry(
  layout: PaperLayout,
  pageW: number,
  pageH: number,
  pageIndex: number,
): PageGeometry {
  const { margin, header, columns } = layout
  const content: Box = {
    x: margin.left,
    y: margin.top,
    w: Math.max(80, pageW - margin.left - margin.right),
    h: Math.max(80, pageH - margin.top - margin.bottom),
  }
  const rules: LayoutRule[] = []
  const hasHeader = header.height > 0 && (pageIndex === 0 || header.repeat)
  const headerVertical = hasHeader && pageW > pageH
  let headerBox: Box | null = null
  let body: Box
  if (headerVertical) {
    headerBox = {
      x: content.x + content.w - header.height,
      y: content.y,
      w: header.height,
      h: content.h,
    }
    let bodyRight = headerBox.x - 6
    if (header.rule) {
      rules.push({ key: 'header-rule', x1: bodyRight, y1: content.y, x2: bodyRight, y2: content.y + content.h })
    }
    bodyRight -= 12
    body = { x: content.x, y: content.y, w: Math.max(40, bodyRight - content.x), h: content.h }
  } else if (hasHeader) {
    headerBox = { x: content.x, y: content.y, w: content.w, h: header.height }
    let bodyTop = content.y + header.height + 6
    if (header.rule) {
      rules.push({ key: 'header-rule', x1: content.x, y1: bodyTop, x2: content.x + content.w, y2: bodyTop })
    }
    bodyTop += 12
    body = { x: content.x, y: bodyTop, w: content.w, h: Math.max(40, content.y + content.h - bodyTop) }
  } else {
    body = { ...content }
  }
  const bottom = body.y + body.h

  const frames: Box[] = []
  if (columns.count === 2) {
    const dir = resolveSplit(columns, pageW, pageH)
    if (dir === 'vertical') {
      const w0 = (body.w - columns.gap) * columns.ratio
      frames.push({ x: body.x, y: body.y, w: w0, h: body.h })
      frames.push({ x: body.x + w0 + columns.gap, y: body.y, w: body.w - columns.gap - w0, h: body.h })
      if (columns.divider) {
        const dx = body.x + w0 + columns.gap / 2
        rules.push({ key: 'col-divider', x1: dx, y1: body.y, x2: dx, y2: bottom })
      }
    } else {
      const h0 = (body.h - columns.gap) * columns.ratio
      frames.push({ x: body.x, y: body.y, w: body.w, h: h0 })
      frames.push({ x: body.x, y: body.y + h0 + columns.gap, w: body.w, h: body.h - columns.gap - h0 })
      if (columns.divider) {
        const dy = body.y + h0 + columns.gap / 2
        rules.push({ key: 'col-divider', x1: body.x, y1: dy, x2: body.x + body.w, y2: dy })
      }
    }
  } else {
    frames.push(body)
  }

  return { content, header: headerBox, headerVertical, frames, rules }
}
