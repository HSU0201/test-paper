import Konva from 'konva'
import type { MeasureFn } from './flowLayout'

export const FLOW_FONT = '"Microsoft JhengHei", "PingFang TC", sans-serif'
/** 以字元換行：中文句子內的空格（如「30 位」）不應成為換行點 */
export const FLOW_WRAP = 'char'

let probe: Konva.Text | null = null
const cache = new Map<string, { height: number; naturalWidth: number }>()

/** 用離屏 Konva.Text 量測，換行規則與畫面繪製一致 */
export const measureWithKonva: MeasureFn = (text, width, style, lineHeight) => {
  const key = `${width}|${style.fontSize}|${style.bold ? 1 : 0}|${lineHeight}|${text}`
  const hit = cache.get(key)
  if (hit) return hit
  probe ??= new Konva.Text({ fontFamily: FLOW_FONT, wrap: FLOW_WRAP })
  probe.setAttrs({
    text,
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
