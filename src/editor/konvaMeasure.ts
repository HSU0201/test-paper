import Konva from 'konva'

import type { MeasureFn, TextStyle } from './flowLayout'
import { fontStyleFor } from './richText'

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
  const fontStyle = fontStyleFor(!!style.bold, style.italic ? 'i' : '')
  const key = `${fontFamily}|${width}|${style.fontSize}|${fontStyle}|${lineHeight}|${text}`
  const hit = cache.get(key)
  if (hit) return hit
  probe ??= new Konva.Text({ wrap: FLOW_WRAP })
  probe.setAttrs({
    text,
    fontFamily,
    fontSize: style.fontSize,
    fontStyle,
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

/**
 * 一行文字裡，這個字的墨水中心離文字框頂端多遠。
 * 演算法跟 Konva 畫字時一樣：以 M 的字框決定基準線，再取實際筆畫的中心。
 */
export function lineInkCenter(
  fontFamily: string,
  sample: string,
  style: TextStyle,
  lineHeight: number,
): number {
  const step = style.fontSize * lineHeight
  probe ??= new Konva.Text({ wrap: FLOW_WRAP })
  probe.setAttrs({
    text: sample || 'M',
    fontFamily,
    fontSize: style.fontSize,
    fontStyle: fontStyleFor(!!style.bold, style.italic ? 'i' : ''),
    lineHeight,
  })
  if (Konva.legacyTextRendering) return step / 2
  const font = probe.measureSize('M')
  const ink = probe.measureSize(sample || 'M')
  const ascent = font.fontBoundingBoxAscent ?? font.actualBoundingBoxAscent ?? style.fontSize
  const descent = font.fontBoundingBoxDescent ?? font.actualBoundingBoxDescent ?? 0
  const inkAscent = ink.actualBoundingBoxAscent ?? ascent
  const inkDescent = ink.actualBoundingBoxDescent ?? 0
  const baseline = (ascent - descent) / 2 + step / 2
  return baseline - (inkAscent - inkDescent) / 2
}

export function measureWithFont(fontFamily: string): MeasureFn {
  return (text, width, style, lineHeight) => measureText(fontFamily, text, width, style, lineHeight)
}
