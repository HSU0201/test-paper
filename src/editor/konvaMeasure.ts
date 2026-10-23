import Konva from 'konva'
import type { MeasureFn, TextStyle } from './flowLayout'

/** 以字元換行：中文句子內的空格（如「30 位」）不應成為換行點 */
export const FLOW_WRAP = 'char'

let probe: Konva.Text | null = null
const cache = new Map<string, { height: number; naturalWidth: number }>()

export function measureText(
  fontFamily: string,
  text: string,
  width: number,
  style: TextStyle,
  lineHeight: number,
) {
  const key = `${fontFamily}|${width}|${style.fontSize}|${style.bold ? 1 : 0}|${lineHeight}|${text}`
  const hit = cache.get(key)
  if (hit) return hit
  probe ??= new Konva.Text({ wrap: FLOW_WRAP })
  probe.setAttrs({
    text,
    fontFamily,
    fontSize: style.fontSize,
    fontStyle: style.bold ? 'bold' : 'normal',
    lineHeight,
    width: undefined,
  })
  const naturalWidth = probe.width()
  probe.width(width)
  const result = { height: probe.height(), naturalWidth }
  if (cache.size > 5000) cache.clear()
  cache.set(key, result)
  return result
}

export function clearMeasureCache(): void {
  cache.clear()
}

export function measureWithFont(fontFamily: string): MeasureFn {
  return (text, width, style, lineHeight) => measureText(fontFamily, text, width, style, lineHeight)
}
