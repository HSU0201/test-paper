/**
 * 把 Word 圖片常用的 EMF（Windows 增強型中繼檔）畫到 canvas 上。
 * 瀏覽器不認得 EMF，只好自己逐筆讀繪圖指令。只做廠商考卷會用到的指令：
 * 點陣圖、文字、線條、多邊形、貝茲曲線、路徑、裁切與座標轉換。不認得的指令略過。
 */

type Matrix = [number, number, number, number, number, number]

type Pen = { kind: 'pen'; color: string; width: number; style: number; cosmetic: boolean }
type Brush = { kind: 'brush'; color: string | null }
type Font = { kind: 'font'; height: number; weight: number; italic: boolean; face: string; escapement: number }
type GdiObject = Pen | Brush | Font

/** 裁切範圍：每一層是一組 canvas 座標的多邊形，層與層取交集 */
type Clip = { x: number; y: number }[][][]

type DcState = {
  windowOrg: { x: number; y: number }
  world: Matrix
  pen: Pen | null
  brush: Brush | null
  font: Font | null
  textColor: string
  bkColor: string
  bkMode: number
  textAlign: number
  fillRule: CanvasFillRule
  pos: { x: number; y: number }
  clip: Clip
}

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0]

const BLACK_PEN: Pen = { kind: 'pen', color: '#000000', width: 0, style: 0, cosmetic: true }

const STOCK: Record<number, GdiObject | null> = {
  0x80000000: { kind: 'brush', color: '#ffffff' },
  0x80000001: { kind: 'brush', color: '#c0c0c0' },
  0x80000002: { kind: 'brush', color: '#808080' },
  0x80000003: { kind: 'brush', color: '#404040' },
  0x80000004: { kind: 'brush', color: '#000000' },
  0x80000005: { kind: 'brush', color: null },
  0x80000006: { kind: 'pen', color: '#ffffff', width: 0, style: 0, cosmetic: true },
  0x80000007: BLACK_PEN,
  0x80000008: { kind: 'pen', color: '#000000', width: 0, style: 5, cosmetic: true },
  0x8000000d: { kind: 'font', height: 16, weight: 400, italic: false, face: '', escapement: 0 },
  0x80000011: { kind: 'font', height: 16, weight: 400, italic: false, face: '', escapement: 0 },
}

const PS_NULL = 5
const BS_NULL = 1
const TA_UPDATECP = 1
const TA_RIGHT = 2
const TA_CENTER = 6
const TA_BOTTOM = 8
const TA_BASELINE = 24
const ETO_OPAQUE = 2
const ETO_PDY = 0x2000

/** a 之後再套 b（列向量乘法，和 GDI 的 XFORM 相同） */
function multiply(a: Matrix, b: Matrix): Matrix {
  return [
    a[0] * b[0] + a[1] * b[2],
    a[0] * b[1] + a[1] * b[3],
    a[2] * b[0] + a[3] * b[2],
    a[2] * b[1] + a[3] * b[3],
    a[4] * b[0] + a[5] * b[2] + b[4],
    a[4] * b[1] + a[5] * b[3] + b[5],
  ]
}

function colorRef(view: DataView, at: number): string {
  const r = view.getUint8(at)
  const g = view.getUint8(at + 1)
  const b = view.getUint8(at + 2)
  return `rgb(${r},${g},${b})`
}

function utf16(view: DataView, at: number, chars: number): string {
  let s = ''
  for (let i = 0; i < chars; i++) {
    if (at + i * 2 + 2 > view.byteLength) break
    const code = view.getUint16(at + i * 2, true)
    if (code === 0) break
    s += String.fromCharCode(code)
  }
  return s
}

export type EmfHeader = {
  /** 圖的範圍，裝置座標 */
  bounds: { left: number; top: number; right: number; bottom: number }
}

export function isEmf(buf: ArrayBuffer): boolean {
  if (buf.byteLength < 88) return false
  const view = new DataView(buf)
  // EMR_HEADER 且簽章是 " EMF"
  return view.getUint32(0, true) === 1 && view.getUint32(40, true) === 0x464d4520
}

export function readEmfHeader(buf: ArrayBuffer): EmfHeader {
  const view = new DataView(buf)
  return {
    bounds: {
      left: view.getInt32(8, true),
      top: view.getInt32(12, true),
      right: view.getInt32(16, true),
      bottom: view.getInt32(20, true),
    },
  }
}

/** BITMAPINFO 後面緊接像素時（WMF 的寫法），像素從哪裡開始 */
export function dibBitsOffset(view: DataView, bmiAt: number): number {
  const headerSize = view.getUint32(bmiAt, true)
  const bitCount = view.getUint16(bmiAt + 14, true)
  const compression = headerSize >= 20 ? view.getUint32(bmiAt + 16, true) : 0
  const clrUsed = headerSize >= 36 ? view.getUint32(bmiAt + 32, true) : 0
  let at = bmiAt + headerSize
  if (compression === 3 && headerSize === 40) at += 12
  if (bitCount <= 8) at += (clrUsed || 1 << bitCount) * 4
  return at
}

/** DIB（BITMAPINFO＋像素）轉成可以畫的圖。不支援的壓縮格式回傳 null */
export async function decodeDib(view: DataView, bmiAt: number, bitsAt: number, bitsLen: number): Promise<CanvasImageSource | null> {
  const headerSize = view.getUint32(bmiAt, true)
  const width = view.getInt32(bmiAt + 4, true)
  const rawHeight = view.getInt32(bmiAt + 8, true)
  const bitCount = view.getUint16(bmiAt + 14, true)
  const compression = headerSize >= 20 ? view.getUint32(bmiAt + 16, true) : 0
  const clrUsed = headerSize >= 36 ? view.getUint32(bmiAt + 32, true) : 0
  const height = Math.abs(rawHeight)
  const topDown = rawHeight < 0
  if (width <= 0 || height <= 0 || width * height > 40_000_000) return null

  if (compression === 4 || compression === 5) {
    const bytes = new Uint8Array(view.buffer, view.byteOffset + bitsAt, bitsLen)
    const blob = new Blob([bytes.slice()], { type: compression === 4 ? 'image/jpeg' : 'image/png' })
    return createImageBitmap(blob).catch(() => null)
  }
  if (compression !== 0 && compression !== 3) return null

  let palette: number[][] = []
  let masks: [number, number, number] | null = null
  let tableAt = bmiAt + headerSize
  if (compression === 3) {
    masks = [view.getUint32(tableAt, true), view.getUint32(tableAt + 4, true), view.getUint32(tableAt + 8, true)]
    if (headerSize === 40) tableAt += 12
  }
  if (bitCount <= 8) {
    const n = clrUsed || 1 << bitCount
    palette = Array.from({ length: n }, (_, i) => {
      const at = tableAt + i * 4
      return [view.getUint8(at + 2), view.getUint8(at + 1), view.getUint8(at)]
    })
  }

  const stride = Math.floor((width * bitCount + 31) / 32) * 4
  if (stride * height > bitsLen + stride) return null
  const out = new ImageData(width, height)
  const px = out.data
  const shiftOf = (m: number) => (m ? 31 - Math.clz32(m & -m) : 0)
  const scaleOf = (m: number) => (m ? 255 / (m >>> shiftOf(m)) : 0)
  const maskInfo = masks?.map((m) => [m, shiftOf(m), scaleOf(m)] as const)
  for (let y = 0; y < height; y++) {
    const row = bitsAt + (topDown ? y : height - 1 - y) * stride
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4
      let r: number
      let g: number
      let b: number
      if (bitCount === 24) {
        const at = row + x * 3
        if (at + 2 >= view.byteLength) continue
        b = view.getUint8(at)
        g = view.getUint8(at + 1)
        r = view.getUint8(at + 2)
      } else if (bitCount === 32 || bitCount === 16) {
        const at = row + x * (bitCount / 8)
        if (at + bitCount / 8 > view.byteLength) continue
        const v = bitCount === 32 ? view.getUint32(at, true) : view.getUint16(at, true)
        if (maskInfo) {
          ;[r, g, b] = maskInfo.map(([m, s, k]) => Math.round(((v & m) >>> s) * k))
        } else if (bitCount === 32) {
          b = v & 0xff
          g = (v >>> 8) & 0xff
          r = (v >>> 16) & 0xff
        } else {
          r = ((v >>> 10) & 0x1f) * 8.22
          g = ((v >>> 5) & 0x1f) * 8.22
          b = (v & 0x1f) * 8.22
        }
      } else if (bitCount <= 8) {
        const bit = x * bitCount
        const at = row + (bit >> 3)
        if (at >= view.byteLength) continue
        const byte = view.getUint8(at)
        const index = (byte >> (8 - bitCount - (bit & 7))) & ((1 << bitCount) - 1)
        const c = palette[index] ?? [0, 0, 0]
        ;[r, g, b] = c
      } else {
        return null
      }
      px[o] = r
      px[o + 1] = g
      px[o + 2] = b
      px[o + 3] = 255
    }
  }
  return createImageBitmap(out)
}

/** 光柵運算換成 canvas 合成方式；常見的遮罩技巧（AND 後 OR）用乘與變亮近似 */
function compositeFor(rop: number): GlobalCompositeOperation | null {
  switch (rop) {
    case 0x00cc0020: // SRCCOPY
      return 'source-over'
    case 0x008800c6: // SRCAND
      return 'multiply'
    case 0x00ee0086: // SRCPAINT
      return 'lighten'
    case 0x00660046: // SRCINVERT
      return 'difference'
    case 0x00aa0029: // NOP
      return null
    default:
      return 'source-over'
  }
}

type Op = { kind: 'path'; build: (ctx: CanvasRenderingContext2D) => void }

/**
 * 畫一張 EMF。maxSide 是輸出長邊的像素，太小的圖會放大（最多 3 倍）讓列印清楚。
 */
export async function renderEmf(buf: ArrayBuffer, maxSide = 1400): Promise<HTMLCanvasElement> {
  const view = new DataView(buf)
  if (!isEmf(buf)) throw new Error('不是 EMF 圖檔')
  const { bounds } = readEmfHeader(buf)
  const devW = Math.max(1, bounds.right - bounds.left + 1)
  const devH = Math.max(1, bounds.bottom - bounds.top + 1)
  const scale = Math.min(3, Math.max(0.05, maxSide / Math.max(devW, devH)))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(devW * scale))
  canvas.height = Math.max(1, Math.round(devH * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('無法建立畫布')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  /** 裝置座標 → canvas 像素 */
  const device: Matrix = [scale, 0, 0, scale, -bounds.left * scale, -bounds.top * scale]

  const objects = new Map<number, GdiObject>()
  let dc: DcState = {
    windowOrg: { x: 0, y: 0 },
    world: IDENTITY,
    pen: BLACK_PEN,
    brush: { kind: 'brush', color: '#ffffff' },
    font: null,
    textColor: '#000000',
    bkColor: '#ffffff',
    bkMode: 2,
    textAlign: 0,
    fillRule: 'evenodd',
    pos: { x: 0, y: 0 },
    clip: [],
  }
  const stack: DcState[] = []
  const clone = (s: DcState): DcState => ({ ...s, windowOrg: { ...s.windowOrg }, pos: { ...s.pos }, clip: [...s.clip] })

  /** 邏輯座標 → canvas 的完整矩陣 */
  const full = (): Matrix => multiply(multiply(dc.world, [1, 0, 0, 1, -dc.windowOrg.x, -dc.windowOrg.y]), device)
  const toCanvas = (x: number, y: number) => {
    const m = full()
    return { x: x * m[0] + y * m[2] + m[4], y: x * m[1] + y * m[3] + m[5] }
  }
  const unitScale = () => {
    const m = full()
    return Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) || 1
  }

  const withState = (draw: () => void) => {
    ctx.save()
    for (const layer of dc.clip) {
      ctx.beginPath()
      for (const poly of layer) {
        poly.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)))
        ctx.closePath()
      }
      ctx.clip()
    }
    const m = full()
    ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5])
    draw()
    ctx.restore()
  }

  const strokeStyle = () => {
    const pen = dc.pen
    if (!pen || pen.style === PS_NULL) return false
    ctx.strokeStyle = pen.color
    const minWidth = 1 / unitScale()
    ctx.lineWidth = pen.cosmetic ? Math.max(minWidth, scale / unitScale()) : Math.max(minWidth, pen.width)
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    const style = pen.style & 0xf
    const w = ctx.lineWidth
    ctx.setLineDash(style === 1 ? [w * 3, w * 2] : style === 2 ? [w, w * 1.5] : style === 3 ? [w * 3, w * 1.5, w, w * 1.5] : [])
    return true
  }
  const fillStyle = () => {
    const brush = dc.brush
    if (!brush || brush.color == null) return false
    ctx.fillStyle = brush.color
    return true
  }

  /** 繪圖指令：在 BEGINPATH 之間只記下路徑，之外直接畫 */
  let pathOps: Op[] | null = null
  const shape = (build: (ctx: CanvasRenderingContext2D) => void, fill: boolean, stroke: boolean) => {
    if (pathOps) {
      pathOps.push({ kind: 'path', build })
      return
    }
    withState(() => {
      ctx.beginPath()
      build(ctx)
      if (fill && fillStyle()) ctx.fill(dc.fillRule)
      if (stroke && strokeStyle()) ctx.stroke()
    })
  }
  const paintPath = (fill: boolean, stroke: boolean) => {
    const ops = pathOps ?? []
    pathOps = null
    withState(() => {
      ctx.beginPath()
      for (const op of ops) op.build(ctx)
      if (fill && fillStyle()) ctx.fill(dc.fillRule)
      if (stroke && strokeStyle()) ctx.stroke()
    })
  }
  /** 路徑模式下，連續的 LINETO / POLYxxTO 要接在同一條路徑上 */
  let pathOpen = false

  const readPoints = (at: number, count: number, short: boolean) => {
    const pts: { x: number; y: number }[] = []
    for (let i = 0; i < count; i++) {
      const o = at + i * (short ? 4 : 8)
      if (o + (short ? 4 : 8) > view.byteLength) break
      pts.push(
        short
          ? { x: view.getInt16(o, true), y: view.getInt16(o + 2, true) }
          : { x: view.getInt32(o, true), y: view.getInt32(o + 4, true) },
      )
    }
    return pts
  }

  const rectPoly = (l: number, t: number, r: number, b: number) =>
    [toCanvas(l, t), toCanvas(r, t), toCanvas(r, b), toCanvas(l, b)]

  const drawImage = async (
    rop: number,
    bmiAt: number,
    bmiLen: number,
    bitsAt: number,
    bitsLen: number,
    dest: { x: number; y: number; w: number; h: number },
    src: { x: number; y: number; w: number; h: number } | null,
  ) => {
    if (!bmiLen) {
      // 沒有來源圖：用目前筆刷填滿目的範圍（PATCOPY 之類）
      if (rop === 0x00f00021 || rop === 0x00ff0062 || rop === 0x00000042) {
        withState(() => {
          ctx.fillStyle = rop === 0x00ff0062 ? '#ffffff' : rop === 0x00000042 ? '#000000' : (dc.brush?.color ?? '#ffffff')
          if (rop === 0x00f00021 && dc.brush?.color == null) return
          ctx.fillRect(dest.x, dest.y, dest.w, dest.h)
        })
      }
      return
    }
    const op = compositeFor(rop)
    if (!op) return
    const image = await decodeDib(view, bmiAt, bitsAt, bitsLen)
    if (!image) return
    const iw = 'width' in image ? Number(image.width) : 0
    const ih = 'height' in image ? Number(image.height) : 0
    const s = src ?? { x: 0, y: 0, w: iw, h: ih }
    withState(() => {
      ctx.globalCompositeOperation = op
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(image, s.x, s.y, s.w, s.h, dest.x, dest.y, dest.w, dest.h)
    })
  }

  let at = 0
  while (at + 8 <= view.byteLength) {
    const type = view.getUint32(at, true)
    const size = view.getUint32(at + 4, true)
    if (size < 8 || at + size > view.byteLength) break
    const r = at
    const i32 = (o: number) => view.getInt32(r + o, true)
    const u32 = (o: number) => view.getUint32(r + o, true)
    const f32 = (o: number) => view.getFloat32(r + o, true)
    switch (type) {
      case 10: // SETWINDOWORGEX
        dc.windowOrg = { x: i32(8), y: i32(12) }
        break
      case 18: // SETBKMODE
        dc.bkMode = u32(8)
        break
      case 19: // SETPOLYFILLMODE
        dc.fillRule = u32(8) === 2 ? 'nonzero' : 'evenodd'
        break
      case 22: // SETTEXTALIGN
        dc.textAlign = u32(8)
        break
      case 24: // SETTEXTCOLOR
        dc.textColor = colorRef(view, r + 8)
        break
      case 25: // SETBKCOLOR
        dc.bkColor = colorRef(view, r + 8)
        break
      case 27: // MOVETOEX
        dc.pos = { x: i32(8), y: i32(12) }
        if (pathOps) {
          const p = dc.pos
          pathOps.push({ kind: 'path', build: (c) => c.moveTo(p.x, p.y) })
          pathOpen = true
        }
        break
      case 30: // INTERSECTCLIPRECT
        dc.clip = [...dc.clip, [rectPoly(i32(8), i32(12), i32(16), i32(20))]]
        break
      case 75: {
        // EXTSELECTCLIPRGN：只處理 RGN_COPY（重設或換成一組矩形）
        const cb = u32(8)
        const mode = u32(12)
        if (mode === 5) {
          if (!cb) dc.clip = []
          else {
            const count = u32(16 + 8)
            const rects: { x: number; y: number }[][] = []
            for (let i = 0; i < count; i++) {
              const o = 16 + 32 + i * 16
              const [l, t, rr, b] = [i32(o), i32(o + 4), i32(o + 8), i32(o + 12)]
              // 區域是裝置座標
              const p = (x: number, y: number) => ({ x: (x - bounds.left) * scale, y: (y - bounds.top) * scale })
              rects.push([p(l, t), p(rr, t), p(rr, b), p(l, b)])
            }
            dc.clip = rects.length ? [rects] : []
          }
        }
        break
      }
      case 33: // SAVEDC
        stack.push(clone(dc))
        break
      case 34: {
        // RESTOREDC：負數表示往回幾層
        let n = i32(8)
        if (n < 0) {
          while (n < -1 && stack.length) {
            stack.pop()
            n += 1
          }
          const prev = stack.pop()
          if (prev) dc = prev
        } else if (n > 0 && n <= stack.length) {
          dc = stack[n - 1]
          stack.length = n - 1
        }
        break
      }
      case 35: // SETWORLDTRANSFORM
        dc.world = [f32(8), f32(12), f32(16), f32(20), f32(24), f32(28)]
        break
      case 36: {
        // MODIFYWORLDTRANSFORM
        const x: Matrix = [f32(8), f32(12), f32(16), f32(20), f32(24), f32(28)]
        const mode = u32(32)
        if (mode === 1) dc.world = IDENTITY
        else if (mode === 2) dc.world = multiply(x, dc.world)
        else if (mode === 3) dc.world = multiply(dc.world, x)
        else if (mode === 4) dc.world = x
        break
      }
      case 37: {
        // SELECTOBJECT
        const id = u32(8)
        const obj = id & 0x80000000 ? STOCK[id] : objects.get(id)
        if (obj?.kind === 'pen') dc.pen = obj
        else if (obj?.kind === 'brush') dc.brush = obj
        else if (obj?.kind === 'font') dc.font = obj
        break
      }
      case 38: // CREATEPEN
        objects.set(u32(8), {
          kind: 'pen',
          style: u32(12),
          width: i32(16),
          cosmetic: i32(16) <= 1,
          color: colorRef(view, r + 24),
        })
        break
      case 95: {
        // EXTCREATEPEN
        const style = u32(28)
        const brushStyle = u32(36)
        objects.set(u32(8), {
          kind: 'pen',
          style: brushStyle === BS_NULL ? PS_NULL : style,
          width: u32(32),
          cosmetic: (style & 0x10000) === 0,
          color: colorRef(view, r + 40),
        })
        break
      }
      case 39: // CREATEBRUSHINDIRECT
        objects.set(u32(8), { kind: 'brush', color: u32(12) === BS_NULL ? null : colorRef(view, r + 16) })
        break
      case 82: // EXTCREATEFONTINDIRECTW
        objects.set(u32(8), {
          kind: 'font',
          height: Math.abs(i32(12)) || 16,
          escapement: i32(20),
          weight: i32(28) || 400,
          italic: view.getUint8(r + 32) !== 0,
          face: utf16(view, r + 40, 32).replace(/^@/, ''),
        })
        break
      case 40: // DELETEOBJECT
        objects.delete(u32(8))
        break
      case 59: // BEGINPATH
        pathOps = []
        pathOpen = false
        break
      case 60: // ENDPATH
        break
      case 61: // CLOSEFIGURE
        pathOps?.push({ kind: 'path', build: (c) => c.closePath() })
        break
      case 62: // FILLPATH
        paintPath(true, false)
        break
      case 63: // STROKEANDFILLPATH
        paintPath(true, true)
        break
      case 64: // STROKEPATH
        paintPath(false, true)
        break
      case 68: // ABORTPATH
        pathOps = null
        break
      case 54: {
        // LINETO
        const from = dc.pos
        const to = { x: i32(8), y: i32(12) }
        dc.pos = to
        if (pathOps) {
          const open = pathOpen
          pathOps.push({
            kind: 'path',
            build: (c) => {
              if (!open) c.moveTo(from.x, from.y)
              c.lineTo(to.x, to.y)
            },
          })
          pathOpen = true
        } else shape((c) => (c.moveTo(from.x, from.y), c.lineTo(to.x, to.y)), false, true)
        break
      }
      case 3: // POLYGON
      case 86: // POLYGON16
      case 4: // POLYLINE
      case 87: {
        // POLYLINE16
        const pts = readPoints(r + 28, u32(24), type > 80)
        if (pts.length < 2) break
        const closed = type === 3 || type === 86
        shape(
          (c) => {
            pts.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)))
            if (closed) c.closePath()
          },
          closed,
          true,
        )
        break
      }
      case 6: // POLYLINETO
      case 89: {
        // POLYLINETO16
        const pts = readPoints(r + 28, u32(24), type > 80)
        const from = dc.pos
        const continues = pathOps !== null && pathOpen
        const build = (c: CanvasRenderingContext2D) => {
          if (!continues) c.moveTo(from.x, from.y)
          pts.forEach((p) => c.lineTo(p.x, p.y))
        }
        if (pts.length) dc.pos = pts[pts.length - 1]
        if (pathOps) {
          pathOps.push({ kind: 'path', build })
          pathOpen = true
        } else shape(build, false, true)
        break
      }
      case 2: // POLYBEZIER
      case 85: {
        // POLYBEZIER16
        const pts = readPoints(r + 28, u32(24), type > 80)
        if (pts.length < 4) break
        shape(
          (c) => {
            c.moveTo(pts[0].x, pts[0].y)
            for (let i = 1; i + 2 < pts.length; i += 3) {
              c.bezierCurveTo(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, pts[i + 2].x, pts[i + 2].y)
            }
          },
          false,
          true,
        )
        break
      }
      case 5: // POLYBEZIERTO
      case 88: {
        // POLYBEZIERTO16
        const pts = readPoints(r + 28, u32(24), type > 80)
        const from = dc.pos
        const continues = pathOps !== null && pathOpen
        const build = (c: CanvasRenderingContext2D) => {
          if (!continues) c.moveTo(from.x, from.y)
          for (let i = 0; i + 2 < pts.length; i += 3) {
            c.bezierCurveTo(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, pts[i + 2].x, pts[i + 2].y)
          }
        }
        if (pts.length) dc.pos = pts[pts.length - 1]
        if (pathOps) {
          pathOps.push({ kind: 'path', build })
          pathOpen = true
        } else shape(build, false, true)
        break
      }
      case 8: // POLYPOLYGON
      case 91: // POLYPOLYGON16
      case 7: // POLYPOLYLINE
      case 90: {
        // POLYPOLYLINE16
        const n = u32(24)
        const total = u32(28)
        const counts = Array.from({ length: n }, (_, i) => u32(32 + i * 4))
        const pts = readPoints(r + 32 + n * 4, total, type > 80)
        const closed = type === 8 || type === 91
        shape(
          (c) => {
            let k = 0
            for (const count of counts) {
              const poly = pts.slice(k, k + count)
              k += count
              poly.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)))
              if (closed) c.closePath()
            }
          },
          closed,
          true,
        )
        break
      }
      case 43: {
        // RECTANGLE
        const [l, t, rr, b] = [i32(8), i32(12), i32(16), i32(20)]
        shape((c) => c.rect(l, t, rr - l, b - t), true, true)
        break
      }
      case 42: {
        // ELLIPSE
        const [l, t, rr, b] = [i32(8), i32(12), i32(16), i32(20)]
        shape((c) => c.ellipse((l + rr) / 2, (t + b) / 2, Math.abs(rr - l) / 2, Math.abs(b - t) / 2, 0, 0, Math.PI * 2), true, true)
        break
      }
      case 76: {
        // BITBLT
        await drawImage(
          u32(40),
          r + u32(84),
          u32(88),
          r + u32(92),
          u32(96),
          { x: i32(24), y: i32(28), w: i32(32), h: i32(36) },
          null,
        )
        break
      }
      case 77: {
        // STRETCHBLT
        await drawImage(
          u32(40),
          r + u32(84),
          u32(88),
          r + u32(92),
          u32(96),
          { x: i32(24), y: i32(28), w: i32(32), h: i32(36) },
          { x: i32(44), y: i32(48), w: i32(100), h: i32(104) },
        )
        break
      }
      case 81: {
        // STRETCHDIBITS
        const bmiAt = r + u32(48)
        const rawH = view.getInt32(bmiAt + 8, true)
        const imgH = Math.abs(rawH)
        const sx = i32(32)
        const sy = i32(36)
        const sw = i32(40)
        const sh = i32(44)
        // 由下往上存的 DIB，來源 y 從左下角算起
        const srcY = rawH > 0 ? imgH - sy - sh : sy
        await drawImage(
          u32(68),
          bmiAt,
          u32(52),
          r + u32(56),
          u32(60),
          { x: i32(24), y: i32(28), w: i32(72), h: i32(76) },
          { x: sx, y: srcY, w: sw, h: sh },
        )
        break
      }
      case 84: // EXTTEXTOUTW
      case 83: {
        // EXTTEXTOUTA
        const wide = type === 84
        const ref = { x: i32(36), y: i32(40) }
        const chars = u32(44)
        const offString = u32(48)
        const options = u32(52)
        const offDx = u32(72)
        const text = wide
          ? utf16(view, r + offString, chars)
          : new TextDecoder('windows-1252').decode(new Uint8Array(buf, r + offString, chars))
        const font = dc.font ?? { kind: 'font', height: 16, weight: 400, italic: false, face: '', escapement: 0 }
        if (options & ETO_OPAQUE) {
          const [l, t, rr, b] = [i32(56), i32(60), i32(64), i32(68)]
          withState(() => {
            ctx.fillStyle = dc.bkColor
            ctx.fillRect(l, t, rr - l, b - t)
          })
        }
        if (!text.trim()) break
        const step = options & ETO_PDY ? 8 : 4
        const dx = offDx
          ? Array.from(text, (_, i) => (r + offDx + i * step + 4 <= view.byteLength ? view.getInt32(r + offDx + i * step, true) : 0))
          : null
        const useCp = (dc.textAlign & TA_UPDATECP) !== 0
        const origin = useCp ? dc.pos : ref
        withState(() => {
          const family = font.face ? `"${font.face}", ` : ''
          ctx.font = `${font.italic ? 'italic ' : ''}${font.weight >= 600 ? 'bold ' : ''}${font.height}px ${family}"PMingLiU", "MingLiU", "Microsoft JhengHei", serif`
          ctx.fillStyle = dc.textColor
          const v = dc.textAlign & TA_BASELINE
          ctx.textBaseline = v === TA_BASELINE ? 'alphabetic' : v === TA_BOTTOM ? 'bottom' : 'top'
          ctx.textAlign = 'left'
          const glyphs = [...text]
          const widths = dx ?? glyphs.map((g) => ctx.measureText(g).width)
          const total = widths.reduce((s, w) => s + w, 0)
          const h = dc.textAlign & TA_CENTER
          const startX = h === TA_CENTER ? -total / 2 : h === TA_RIGHT ? -total : 0
          ctx.translate(origin.x, origin.y)
          if (font.escapement) ctx.rotate((-font.escapement / 10) * (Math.PI / 180))
          let x = startX
          glyphs.forEach((g, i) => {
            ctx.fillText(g, x, 0)
            x += widths[i] ?? 0
          })
          if (useCp) dc.pos = { x: origin.x + total, y: origin.y }
        })
        break
      }
      case 14: // EOF
        at = view.byteLength
        continue
      default:
        break
    }
    at += size
  }
  return canvas
}
