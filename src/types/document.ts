/** A4 邏輯像素（約 96 DPI） */
export const A4_WIDTH = 794
export const A4_HEIGHT = 1123

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
