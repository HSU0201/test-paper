import { TEXT_BOX_PADDING, type CanvasObject } from '../types/document'

export type Box = { x: number; y: number; w: number; h: number }

export function lineSegmentBox(x1: number, y1: number, x2: number, y2: number): Box {
  const x = Math.min(x1, x2)
  const y = Math.min(y1, y2)
  const w = Math.abs(x2 - x1) || 1
  const h = Math.abs(y2 - y1) || 1
  return { x, y, w, h }
}

/** 用於吸附與對齊的軸對齊包圍盒 */
export function getBoundingBox(obj: CanvasObject): Box {
  switch (obj.type) {
    case 'text': {
      const innerW = Math.max(1, obj.width - TEXT_BOX_PADDING * 2)
      const hardLines = Math.max(1, obj.text.split('\n').length)
      const chars = obj.text.replace(/\n/g, '').length
      const approxWrap = Math.ceil((chars * obj.fontSize * 0.62) / innerW)
      const lines = Math.max(hardLines, approxWrap)
      const h = Math.max(28, lines * obj.fontSize * 1.25 + TEXT_BOX_PADDING * 2)
      return { x: obj.x, y: obj.y, w: obj.width, h }
    }
    case 'rect':
    case 'image':
      return { x: obj.x, y: obj.y, w: obj.width, h: obj.height }
    case 'line':
      return lineSegmentBox(obj.x1, obj.y1, obj.x2, obj.y2)
    default: {
      const _exhaustive: never = obj
      return _exhaustive
    }
  }
}
