/** A4 邏輯像素（約 96 DPI） */
export const A4_WIDTH = 794
export const A4_HEIGHT = 1123

/** 「新增文字」區塊的預設字級（px） */
export const DEFAULT_NEW_TEXT_FONT_SIZE = 18

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
}

export type TextObject = BaseObject & {
  type: 'text'
  x: number
  y: number
  width: number
  text: string
  fontSize: number
  fontFamily: string
  fill: string
  fontStyle: FontStyle
  align: TextAlign
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

export type EditorState = {
  version: 1
  pageWidth: number
  pageHeight: number
  objects: CanvasObject[]
  selectedId: string | null
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
