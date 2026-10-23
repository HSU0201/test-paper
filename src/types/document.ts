import type { BlockRef, ExamContent } from './exam'
import type { PaperLayout } from './layout'

/** A4 邏輯像素（約 96 DPI） */
export const A4_WIDTH = 794
export const A4_HEIGHT = 1123

/** 「新增文字」區塊的預設字級（px，僅自訂階層時作為後援） */
export const DEFAULT_NEW_TEXT_FONT_SIZE = 18

/** 文字區塊內距（px），外側寬度 state.width 含左右內距 */
export const TEXT_BOX_PADDING = 6

/** 階層預設（方塊本體不填色，僅選取時以外框色區分階層） */
export type TextLevelPreset = {
  label: string
  fontSize: number
  /** 文字顏色 */
  fill: string
  /** 選取時外框顏色 */
  boxStroke: string
}

export const TEXT_LEVEL_PRESETS = {
  paper_title: {
    label: '試卷大標',
    fontSize: 24,
    fill: '#000000',
    boxStroke: '#c9a227',
  },
  section_heading: {
    label: '章節標題',
    fontSize: 18,
    fill: '#000000',
    boxStroke: '#e2b007',
  },
  question_body: {
    label: '題文／內文',
    fontSize: 16,
    fill: '#000000',
    boxStroke: '#a08a4a',
  },
  instruction: {
    label: '作答說明',
    fontSize: 14,
    fill: '#000000',
    boxStroke: '#8a5e00',
  },
}

/** 內建四種階層的 id */
export type BuiltinTextLevelKey = keyof typeof TEXT_LEVEL_PRESETS

/** 內建鍵或 `custom`（型別層級）；實際文字物件另可使用自訂階層 id 字串 */
export type TextLevel = BuiltinTextLevelKey | 'custom'

/** 使用者自訂階層（與 JSON 一併存檔） */
export type UserTextTier = TextLevelPreset & {
  id: string
}

/** 覆寫內建階層預設（字級、文字色、選取外框色、顯示名稱） */
export type TextLevelOverrides = Partial<Record<BuiltinTextLevelKey, Partial<TextLevelPreset>>>

export const TEXT_PRESET_LEVEL_KEYS = Object.keys(TEXT_LEVEL_PRESETS) as BuiltinTextLevelKey[]

export function mergeTextLevelPreset(
  level: BuiltinTextLevelKey,
  overrides: TextLevelOverrides | undefined,
): TextLevelPreset & { boxFill: 'transparent' } {
  const base = TEXT_LEVEL_PRESETS[level]
  const o = overrides?.[level] ?? {}
  return {
    label: o.label ?? base.label,
    fontSize: o.fontSize ?? base.fontSize,
    fill: o.fill ?? base.fill,
    boxStroke: o.boxStroke ?? base.boxStroke,
    boxFill: 'transparent',
  }
}

/** 常見紙張預設（皆為直向時的寬×高） */
export type PaperPresetKey = 'a4' | 'a3' | 'b5' | 'letter'

export const PAPER_PRESETS: Record<
  PaperPresetKey,
  { label: string; width: number; height: number }
> = {
  a4: { label: 'A4', width: A4_WIDTH, height: A4_HEIGHT },
  /** A3 直向約 297×420 mm */
  a3: { label: 'A3', width: 1123, height: 1587 },
  /** B5（JIS）約 182×257 mm */
  b5: { label: 'B5', width: 665, height: 949 },
  /** US Letter 8.5×11 in */
  letter: { label: 'Letter', width: 816, height: 1056 },
}

/** 由邏輯像素換算約略 mm（假設 96 DPI） */
export function pxToMm(px: number): number {
  return Math.round((px * 25.4) / 96)
}

/** 依目前寬高判斷最接近的預設（橫直皆可對應） */
export function detectPaperPreset(w: number, h: number): PaperPresetKey | 'custom' {
  const short = Math.min(w, h)
  const long = Math.max(w, h)
  for (const key of Object.keys(PAPER_PRESETS) as PaperPresetKey[]) {
    const p = PAPER_PRESETS[key]
    const ps = Math.min(p.width, p.height)
    const pl = Math.max(p.width, p.height)
    if (ps === short && pl === long) return key
  }
  return 'custom'
}

export type TextAlign = 'left' | 'center' | 'right'
export type FontStyle = 'normal' | 'bold' | 'italic' | 'bold italic'

export type BaseObject = {
  id: string
  zIndex: number
  /** 所在頁（0 起算）；舊檔沒有此欄位時視為第一頁 */
  page?: number
}

export type TextObject = BaseObject & {
  type: 'text'
  x: number
  y: number
  /** 文字區塊外寬（含 TEXT_BOX_PADDING） */
  width: number
  text: string
  fontSize: number
  fontFamily: string
  fill: string
  fontStyle: FontStyle
  align: TextAlign
  /** `custom`、內建鍵、或自訂階層 id */
  textLevel: string
  /** 一律透明，保留欄位以利舊檔相容 */
  boxFill: string
  /** 選取時外框顏色（未選取時不繪製外框） */
  boxStroke: string
}

export type LineObject = BaseObject & {
  type: 'line'
  x1: number
  y1: number
  x2: number
  y2: number
  stroke: string
  strokeWidth: number
}

export type RectObject = BaseObject & {
  type: 'rect'
  x: number
  y: number
  width: number
  height: number
  fill: string
  stroke: string
  strokeWidth: number
  cornerRadius: number
}

export type ImageObject = BaseObject & {
  type: 'image'
  x: number
  y: number
  width: number
  height: number
  src: string
}

export type CanvasObject = TextObject | LineObject | RectObject | ImageObject

export function applyTextLevelPreset(
  level: BuiltinTextLevelKey,
  overrides?: TextLevelOverrides,
): Pick<TextObject, 'fontSize' | 'fill' | 'boxStroke' | 'boxFill'> {
  const m = mergeTextLevelPreset(level, overrides)
  return {
    fontSize: m.fontSize,
    fill: m.fill,
    boxStroke: m.boxStroke,
    boxFill: m.boxFill,
  }
}

export function isBuiltinTierId(id: string): id is BuiltinTextLevelKey {
  return (TEXT_PRESET_LEVEL_KEYS as readonly string[]).includes(id)
}

/** 是否可作為文字階層或「新增文字」預設階層 */
export function isValidTierId(id: string, userTiers: UserTextTier[] | undefined): boolean {
  if (id === 'custom') return true
  if (isBuiltinTierId(id)) return true
  return !!userTiers?.some((t) => t.id === id)
}

/** 依階層 id 取得鎖定樣式（非 `custom`）；查無則回傳 null */
export function resolveLockedTextStyle(
  levelId: string,
  overrides: TextLevelOverrides | undefined,
  userTiers: UserTextTier[] | undefined,
): Pick<TextObject, 'fontSize' | 'fill' | 'boxStroke' | 'boxFill'> | null {
  if (levelId === 'custom') return null
  if (isBuiltinTierId(levelId)) {
    return applyTextLevelPreset(levelId, overrides)
  }
  const u = userTiers?.find((t) => t.id === levelId)
  if (!u) return null
  return {
    fontSize: u.fontSize,
    fill: u.fill,
    boxStroke: u.boxStroke,
    boxFill: 'transparent',
  }
}

export function getTextTierLabel(
  levelId: string,
  overrides: TextLevelOverrides | undefined,
  userTiers: UserTextTier[] | undefined,
): string {
  if (levelId === 'custom') return '自訂'
  if (isBuiltinTierId(levelId)) return mergeTextLevelPreset(levelId, overrides).label
  return userTiers?.find((t) => t.id === levelId)?.label ?? '自訂階層'
}

export function createDefaultUserTextTier(): UserTextTier {
  return {
    id: crypto.randomUUID(),
    label: '新階層',
    fontSize: 15,
    fill: '#000000',
    boxStroke: '#a08a4a',
  }
}

export type NormalizeTextContext = {
  /** 載入檔案中宣告的自訂階層 id，避免被誤判為自訂（無階層） */
  knownCustomTierIds?: ReadonlySet<string>
}

/** 載入舊 JSON 時補齊文字方塊欄位；未知階層 id 視為 `custom` 以保留字級／顏色 */
export function normalizeCanvasObject(o: CanvasObject, ctx?: NormalizeTextContext): CanvasObject {
  if (o.type !== 'text') return o
  const t = o as TextObject & { textLevel?: string }
  const extra = ctx?.knownCustomTierIds ?? new Set<string>()
  const builtinSet = new Set<string>(TEXT_PRESET_LEVEL_KEYS)
  const raw = t.textLevel ?? 'custom'
  let level = raw
  if (raw !== 'custom' && !builtinSet.has(raw) && !extra.has(raw)) {
    level = 'custom'
  }
  if (level === 'custom') {
    return {
      ...t,
      textLevel: 'custom',
      boxFill: 'transparent',
      boxStroke: t.boxStroke ?? '#64748b',
    }
  }
  if (isBuiltinTierId(level)) {
    const preset = applyTextLevelPreset(level, undefined)
    return {
      ...t,
      textLevel: level,
      fontSize: preset.fontSize,
      fill: preset.fill,
      boxFill: preset.boxFill,
      boxStroke: preset.boxStroke,
    }
  }
  return {
    ...t,
    textLevel: level,
    boxFill: 'transparent',
    boxStroke: t.boxStroke ?? '#64748b',
  }
}

export type EditorState = {
  version: 1
  pageWidth: number
  pageHeight: number
  objects: CanvasObject[]
  selectedId: string | null
  /** 內建四種階層的欄位覆寫，與 JSON 一併存檔 */
  textLevelOverrides: TextLevelOverrides
  /** 使用者新增的階層定義 */
  userTextTiers: UserTextTier[]
  /** 按「新增文字」後、點畫布要建立文字時使用的階層 id（內建／自訂／custom） */
  defaultNewTextTierId: string
  /** 為 true 時點畫布空白處會建立文字（使用當下的 defaultNewTextTierId） */
  textPlacementMode: boolean
  /** 頁首與分欄版型 */
  layout: PaperLayout
  /** 大題／小題內容，依陣列順序排版 */
  exam: ExamContent
  /** 選取中的大題、小題或頁首欄位（與 selectedId 互斥） */
  selectedBlock: BlockRef | null
  /** 最近點選的頁面，新增線條／方框／圖片時放在這一頁 */
  activePage: number
}

export function isText(o: CanvasObject): o is TextObject {
  return o.type === 'text'
}
export function isLine(o: CanvasObject): o is LineObject {
  return o.type === 'line'
}
export function isRect(o: CanvasObject): o is RectObject {
  return o.type === 'rect'
}
export function isImage(o: CanvasObject): o is ImageObject {
  return o.type === 'image'
}
