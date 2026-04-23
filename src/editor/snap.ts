import type { Box } from './bounds'

const DEFAULT_THRESHOLD = 8

export type SnapGuides = {
  vertical: number[]
  horizontal: number[]
}

export type SnapBoxResult = {
  x: number
  y: number
  guides: SnapGuides
}

function collectStops(
  boxes: Box[],
  canvasW: number,
  canvasH: number,
): { vx: number[]; hy: number[] } {
  const vx = new Set<number>([0, canvasW / 2, canvasW])
  const hy = new Set<number>([0, canvasH / 2, canvasH])
  for (const b of boxes) {
    const cx = b.x + b.w / 2
    const cy = b.y + b.h / 2
    vx.add(b.x)
    vx.add(b.x + b.w)
    vx.add(cx)
    hy.add(b.y)
    hy.add(b.y + b.h)
    hy.add(cy)
  }
  return { vx: [...vx], hy: [...hy] }
}

/** 拖曳矩形（左上 x,y）時對邊緣與中心做吸附 */
export function snapBoxPosition(
  box: Box,
  otherBoxes: Box[],
  canvasW: number,
  canvasH: number,
  threshold = DEFAULT_THRESHOLD,
): SnapBoxResult {
  const { vx, hy } = collectStops(otherBoxes, canvasW, canvasH)
  let { x, y } = box
  const guides: SnapGuides = { vertical: [], horizontal: [] }

  const left = x
  const right = x + box.w
  const hCenter = x + box.w / 2
  const top = y
  const bottom = y + box.h
  const vCenter = y + box.h / 2

  let bestDx = threshold + 1
  let snapX = x
  for (const stop of vx) {
    for (const val of [left, right, hCenter] as const) {
      const d = val - stop
      if (Math.abs(d) < Math.abs(bestDx) && Math.abs(d) <= threshold) {
        bestDx = d
        snapX = x - d
      }
    }
  }
  if (Math.abs(bestDx) <= threshold) {
    x = snapX
    const snappedLeft = x
    const snappedRight = x + box.w
    const snappedMid = x + box.w / 2
    for (const stop of vx) {
      if (
        Math.abs(snappedLeft - stop) <= 0.5 ||
        Math.abs(snappedRight - stop) <= 0.5 ||
        Math.abs(snappedMid - stop) <= 0.5
      ) {
        guides.vertical.push(stop)
      }
    }
  }

  let bestDy = threshold + 1
  let snapY = y
  for (const stop of hy) {
    for (const val of [top, bottom, vCenter] as const) {
      const d = val - stop
      if (Math.abs(d) < Math.abs(bestDy) && Math.abs(d) <= threshold) {
        bestDy = d
        snapY = y - d
      }
    }
  }
  if (Math.abs(bestDy) <= threshold) {
    y = snapY
    const snappedTop = y
    const snappedBottom = y + box.h
    const snappedMid = y + box.h / 2
    for (const stop of hy) {
      if (
        Math.abs(snappedTop - stop) <= 0.5 ||
        Math.abs(snappedBottom - stop) <= 0.5 ||
        Math.abs(snappedMid - stop) <= 0.5
      ) {
        guides.horizontal.push(stop)
      }
    }
  }

  return { x, y, guides }
}

/** 線段拖曳：以包圍盒左上角為基準，維持寬高 */
export function snapLineBoxPosition(
  box: Box,
  otherBoxes: Box[],
  canvasW: number,
  canvasH: number,
  threshold = DEFAULT_THRESHOLD,
): SnapBoxResult {
  return snapBoxPosition(box, otherBoxes, canvasW, canvasH, threshold)
}
