import type { Box } from '../editor/bounds'
import { mergeTextLevelPreset, type TextLevelOverrides } from './document'

/** 頁首欄位角色：位置與階層由版型決定，內容與顯示與否可客製 */
export type HeaderFieldKey =
  | 'schoolName'
  | 'examTitle'
  | 'subject'
  | 'classInfo'
  | 'examDate'
  | 'duration'
  | 'totalScore'
  | 'teacher'
  | 'studentName'

/** title：整頁置中大標；subtitle：副標；infoLeft／infoRight：資訊列左右側 */
export type HeaderPlacement = 'title' | 'subtitle' | 'infoLeft' | 'infoRight'

export type HeaderField = {
  label: string
  value: string
  visible: boolean
}

type HeaderFieldDef = {
  defaultLabel: string
  defaultValue: string
  defaultVisible: boolean
  placement: HeaderPlacement
  /** 是否在畫面顯示「標籤：」前綴 */
  showLabel: boolean
  placeholder: string
}

export const HEADER_FIELD_DEFS: Record<HeaderFieldKey, HeaderFieldDef> = {
  schoolName: {
    defaultLabel: '學校名稱',
    defaultValue: '○○市立○○國民中學',
    defaultVisible: true,
    placement: 'title',
    showLabel: false,
    placeholder: '例：臺北市立○○國中',
  },
  examTitle: {
    defaultLabel: '試卷名稱',
    defaultValue: '115 學年度第一學期 第一次段考',
    defaultVisible: true,
    placement: 'subtitle',
    showLabel: false,
    placeholder: '例：第一次段考',
  },
  subject: {
    defaultLabel: '科目',
    defaultValue: '數學',
    defaultVisible: true,
    placement: 'infoLeft',
    showLabel: true,
    placeholder: '例：國文',
  },
  classInfo: {
    defaultLabel: '班級',
    defaultValue: '',
    defaultVisible: false,
    placement: 'infoLeft',
    showLabel: true,
    placeholder: '留白給學生填寫',
  },
  examDate: {
    defaultLabel: '日期',
    defaultValue: '',
    defaultVisible: false,
    placement: 'infoLeft',
    showLabel: true,
    placeholder: '例：2026/10/30',
  },
  duration: {
    defaultLabel: '作答時間',
    defaultValue: '',
    defaultVisible: false,
    placement: 'infoLeft',
    showLabel: true,
    placeholder: '例：45 分鐘',
  },
  totalScore: {
    defaultLabel: '滿分',
    defaultValue: '',
    defaultVisible: false,
    placement: 'infoLeft',
    showLabel: true,
    placeholder: '例：100 分',
  },
  studentName: {
    defaultLabel: '姓名',
    defaultValue: '',
    defaultVisible: false,
    placement: 'infoRight',
    showLabel: true,
    placeholder: '留白給學生填寫',
  },
  teacher: {
    defaultLabel: '出題老師',
    defaultValue: '○○○ 老師',
    defaultVisible: true,
    placement: 'infoRight',
    showLabel: true,
    placeholder: '例：王小明',
  },
}

export const HEADER_FIELD_ORDER: HeaderFieldKey[] = [
  'schoolName',
  'examTitle',
  'subject',
  'classInfo',
  'examDate',
  'duration',
  'totalScore',
  'studentName',
  'teacher',
]

export type ColumnLayout = {
  count: 1 | 2
  /** 欄距（px） */
  gap: number
  /** 左欄佔內容寬的比例（0.3–0.7），僅雙欄有效 */
  leftRatio: number
  divider: boolean
  showTitles: boolean
  titles: [string, string]
}

export type PageMargin = { top: number; right: number; bottom: number; left: number }

export type PaperLayout = {
  margin: PageMargin
  header: Record<HeaderFieldKey, HeaderField>
  /** 頁首下方分隔線 */
  headerRule: boolean
  columns: ColumnLayout
}

export function createDefaultLayout(): PaperLayout {
  const header = {} as Record<HeaderFieldKey, HeaderField>
  for (const key of HEADER_FIELD_ORDER) {
    const d = HEADER_FIELD_DEFS[key]
    header[key] = { label: d.defaultLabel, value: d.defaultValue, visible: d.defaultVisible }
  }
  return {
    margin: { top: 48, right: 48, bottom: 48, left: 48 },
    header,
    headerRule: true,
    columns: {
      count: 2,
      gap: 24,
      leftRatio: 0.5,
      divider: true,
      showTitles: false,
      titles: ['一、選擇題', '二、填充題'],
    },
  }
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

/** 載入舊檔或不完整資料時補齊版型欄位 */
export function normalizeLayout(raw: unknown): PaperLayout {
  const base = createDefaultLayout()
  if (!raw || typeof raw !== 'object') return base
  const r = raw as Partial<PaperLayout>
  const header = { ...base.header }
  for (const key of HEADER_FIELD_ORDER) {
    const f = r.header?.[key]
    if (f) header[key] = { ...header[key], ...f }
  }
  const c = { ...base.columns, ...(r.columns ?? {}) }
  return {
    margin: { ...base.margin, ...(r.margin ?? {}) },
    header,
    headerRule: r.headerRule ?? base.headerRule,
    columns: {
      ...c,
      count: c.count === 1 ? 1 : 2,
      leftRatio: clamp(Number(c.leftRatio) || 0.5, 0.3, 0.7),
      gap: clamp(Number(c.gap) || 0, 0, 120),
      titles: [c.titles?.[0] ?? '', c.titles?.[1] ?? ''],
    },
  }
}

export function headerFieldDisplay(key: HeaderFieldKey, f: HeaderField): string {
  const def = HEADER_FIELD_DEFS[key]
  const value = f.value.trim() || '＿＿＿＿＿＿'
  return def.showLabel ? `${f.label}：${value}` : value
}

export type LayoutTextRun = {
  key: string
  text: string
  x: number
  y: number
  width: number
  fontSize: number
  fill: string
  bold: boolean
  align: 'left' | 'center' | 'right'
}

export type LayoutGeometry = {
  content: Box
  texts: LayoutTextRun[]
  rules: { x1: number; y1: number; x2: number; y2: number; key: string }[]
  /** 各欄可放題目的區域（已扣除欄標題） */
  columns: Box[]
  headerBottom: number
}

const LINE = 1.4

/** 由版型與文字階層算出頁首、欄位的實際座標（畫布繪製與吸附、放置共用） */
export function computeLayoutGeometry(
  layout: PaperLayout,
  pageW: number,
  pageH: number,
  overrides: TextLevelOverrides,
): LayoutGeometry {
  const { margin, header, columns } = layout
  const titleStyle = mergeTextLevelPreset('paper_title', overrides)
  const sectionStyle = mergeTextLevelPreset('section_heading', overrides)
  const infoStyle = mergeTextLevelPreset('instruction', overrides)

  const content: Box = {
    x: margin.left,
    y: margin.top,
    w: Math.max(80, pageW - margin.left - margin.right),
    h: Math.max(80, pageH - margin.top - margin.bottom),
  }
  const texts: LayoutTextRun[] = []
  const rules: LayoutGeometry['rules'] = []
  let y = content.y

  const visibleBy = (p: HeaderPlacement) =>
    HEADER_FIELD_ORDER.filter((k) => HEADER_FIELD_DEFS[k].placement === p && header[k].visible)

  for (const [placement, style, bold] of [
    ['title', titleStyle, true],
    ['subtitle', sectionStyle, false],
  ] as const) {
    for (const key of visibleBy(placement)) {
      texts.push({
        key: `h-${key}`,
        text: headerFieldDisplay(key, header[key]),
        x: content.x,
        y,
        width: content.w,
        fontSize: style.fontSize,
        fill: style.fill,
        bold,
        align: 'center',
      })
      y += style.fontSize * LINE
    }
  }

  const infoLeft = visibleBy('infoLeft')
  const infoRight = visibleBy('infoRight')
  if (infoLeft.length || infoRight.length) {
    y += 6
    const join = (keys: HeaderFieldKey[]) => keys.map((k) => headerFieldDisplay(k, header[k])).join('　　')
    for (const [keys, align] of [
      [infoLeft, 'left'],
      [infoRight, 'right'],
    ] as const) {
      if (!keys.length) continue
      texts.push({
        key: `info-${align}`,
        text: join(keys),
        x: content.x,
        y,
        width: content.w,
        fontSize: infoStyle.fontSize,
        fill: infoStyle.fill,
        bold: false,
        align,
      })
    }
    y += infoStyle.fontSize * LINE
  }

  if (y > content.y) {
    y += 8
    if (layout.headerRule) {
      rules.push({ key: 'header-rule', x1: content.x, y1: y, x2: content.x + content.w, y2: y })
    }
    y += 12
  }
  const headerBottom = y
  const bodyBottom = content.y + content.h

  const colBoxes: Box[] = []
  if (columns.count === 2) {
    const leftW = (content.w - columns.gap) * columns.leftRatio
    const rightW = content.w - columns.gap - leftW
    colBoxes.push({ x: content.x, y, w: leftW, h: bodyBottom - y })
    colBoxes.push({ x: content.x + leftW + columns.gap, y, w: rightW, h: bodyBottom - y })
    if (columns.divider) {
      const dx = content.x + leftW + columns.gap / 2
      rules.push({ key: 'col-divider', x1: dx, y1: y, x2: dx, y2: bodyBottom })
    }
  } else {
    colBoxes.push({ x: content.x, y, w: content.w, h: bodyBottom - y })
  }

  const titleH = columns.showTitles ? sectionStyle.fontSize * LINE + 8 : 0
  const bodies = colBoxes.map((b, i) => {
    if (columns.showTitles) {
      texts.push({
        key: `col-title-${i}`,
        text: columns.titles[i] || '',
        x: b.x,
        y: b.y,
        width: b.w,
        fontSize: sectionStyle.fontSize,
        fill: sectionStyle.fill,
        bold: true,
        align: 'left',
      })
    }
    return { x: b.x, y: b.y + titleH, w: b.w, h: Math.max(0, b.h - titleH) }
  })

  return { content, texts, rules, columns: bodies, headerBottom }
}
