/**
 * 把舊式 WMF（Windows 中繼檔）畫到 canvas 上。比 EMF 更早的格式，座標是 16 位元。
 * 只做考卷圖片會用到的指令：文字、多邊形、折線、點陣圖、筆刷與裁切。
 */
import { decodeDib, dibBitsOffset } from './emf'

type Pen = { kind: 'pen'; color: string; width: number; style: number }
type Brush = { kind: 'brush'; color: string | null }
type Font = { kind: 'font'; height: number; weight: number; italic: boolean; face: string; escapement: number; charset: number }
type GdiObject = Pen | Brush | Font | { kind: 'other' }

type DcState = {
  org: { x: number; y: number }
  ext: { x: number; y: number }
  pen: Pen
  brush: Brush
  font: Font | null
  textColor: string
  textAlign: number
  fillRule: CanvasFillRule
  pos: { x: number; y: number }
  clip: { x: number; y: number; w: number; h: number }[]
}

const PLACEABLE = 0x9ac6cdd7
const ETO_OPAQUE = 2
const ETO_CLIPPED = 4

/** 字型的字元集換成文字編碼。中文考卷多半是 Big5（136） */
function encodingOf(charset: number): string {
  if (charset === 136) return 'big5'
  if (charset === 134) return 'gbk'
  if (charset === 128) return 'shift_jis'
  if (charset === 129) return 'euc-kr'
  return 'windows-1252'
}

function decodeText(bytes: Uint8Array, charset: number): string {
  try {
    return new TextDecoder(encodingOf(charset)).decode(bytes)
  } catch {
    return new TextDecoder('windows-1252').decode(bytes)
  }
}

export function isWmf(buf: ArrayBuffer): boolean {
  if (buf.byteLength < 18) return false
  const view = new DataView(buf)
  if (view.getUint32(0, true) === PLACEABLE) return true
  const type = view.getUint16(0, true)
  const headerWords = view.getUint16(2, true)
  return (type === 1 || type === 2) && headerWords === 9
}

export async function renderWmf(buf: ArrayBuffer, maxSide = 1400): Promise<HTMLCanvasElement> {
  if (!isWmf(buf)) throw new Error('不是 WMF 圖檔')
  const view = new DataView(buf)
  let at = 0
  let bounds: { left: number; top: number; right: number; bottom: number } | null = null
  if (view.getUint32(0, true) === PLACEABLE) {
    bounds = {
      left: view.getInt16(6, true),
      top: view.getInt16(8, true),
      right: view.getInt16(10, true),
      bottom: view.getInt16(12, true),
    }
    at = 22
  }
  at += view.getUint16(at + 2, true) * 2

  const objects: (GdiObject | null)[] = []
  const addObject = (obj: GdiObject) => {
    const free = objects.indexOf(null)
    if (free >= 0) objects[free] = obj
    else objects.push(obj)
  }

  let dc: DcState = {
    org: { x: bounds?.left ?? 0, y: bounds?.top ?? 0 },
    ext: { x: bounds ? bounds.right - bounds.left : 1000, y: bounds ? bounds.bottom - bounds.top : 1000 },
    pen: { kind: 'pen', color: '#000000', width: 0, style: 0 },
    brush: { kind: 'brush', color: '#ffffff' },
    font: null,
    textColor: '#000000',
    textAlign: 0,
    fillRule: 'evenodd',
    pos: { x: 0, y: 0 },
    clip: [],
  }
  const stack: DcState[] = []

  // 畫布大小：有可放置標頭時用它的範圍，否則等讀到視窗範圍再決定
  const box = bounds ?? { left: 0, top: 0, right: 1000, bottom: 1000 }
  const boxW = Math.max(1, Math.abs(box.right - box.left))
  const boxH = Math.max(1, Math.abs(box.bottom - box.top))
  const scale = maxSide / Math.max(boxW, boxH)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(boxW * scale))
  canvas.height = Math.max(1, Math.round(boxH * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('無法建立畫布')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  /** 邏輯座標 → 畫布：視窗範圍對應到整張圖 */
  const sx = () => (canvas.width / (dc.ext.x || 1))
  const sy = () => (canvas.height / (dc.ext.y || 1))
  const withState = (draw: () => void) => {
    ctx.save()
    for (const r of dc.clip) {
      ctx.beginPath()
      ctx.rect(r.x, r.y, r.w, r.h)
      ctx.clip()
    }
    ctx.setTransform(sx(), 0, 0, sy(), -dc.org.x * sx(), -dc.org.y * sy())
    draw()
    ctx.restore()
  }
  const unit = () => 1 / Math.max(1e-6, Math.min(Math.abs(sx()), Math.abs(sy())))
  const stroke = () => {
    if (dc.pen.style === 5) return false
    ctx.strokeStyle = dc.pen.color
    ctx.lineWidth = Math.max(unit(), dc.pen.width || unit())
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    return true
  }
  const fill = () => {
    if (dc.brush.color == null) return false
    ctx.fillStyle = dc.brush.color
    return true
  }
  const color = (o: number) => `rgb(${view.getUint8(o)},${view.getUint8(o + 1)},${view.getUint8(o + 2)})`
  const points = (o: number, n: number) =>
    Array.from({ length: n }, (_, i) => ({ x: view.getInt16(o + i * 4, true), y: view.getInt16(o + i * 4 + 2, true) }))
  const toCanvas = (x: number, y: number) => ({ x: (x - dc.org.x) * sx(), y: (y - dc.org.y) * sy() })

  while (at + 6 <= view.byteLength) {
    const size = view.getUint32(at, true) * 2
    const fn = view.getUint16(at + 4, true)
    if (fn === 0 || size < 6 || at + size > view.byteLength) break
    const p = at + 6
    const i16 = (k: number) => view.getInt16(p + k * 2, true)
    const u16 = (k: number) => view.getUint16(p + k * 2, true)
    switch (fn) {
      case 0x020b: // SETWINDOWORG
        dc.org = { x: i16(1), y: i16(0) }
        break
      case 0x020c: // SETWINDOWEXT
        dc.ext = { x: i16(1), y: i16(0) }
        break
      case 0x0106: // SETPOLYFILLMODE
        dc.fillRule = u16(0) === 2 ? 'nonzero' : 'evenodd'
        break
      case 0x012e: // SETTEXTALIGN
        dc.textAlign = u16(0)
        break
      case 0x0209: // SETTEXTCOLOR
        dc.textColor = color(p)
        break
      case 0x001e: // SAVEDC
        stack.push({ ...dc, clip: [...dc.clip] })
        break
      case 0x0127: {
        // RESTOREDC
        let n = i16(0)
        while (n < -1 && stack.length) {
          stack.pop()
          n += 1
        }
        const prev = stack.pop()
        if (prev) dc = prev
        break
      }
      case 0x0416: {
        // INTERSECTCLIPRECT：下、右、上、左
        const a = toCanvas(i16(3), i16(2))
        const b = toCanvas(i16(1), i16(0))
        dc.clip = [...dc.clip, { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) }]
        break
      }
      case 0x02fa: // CREATEPENINDIRECT
        addObject({ kind: 'pen', style: u16(0) & 0xf, width: i16(1), color: color(p + 6) })
        break
      case 0x02fc: // CREATEBRUSHINDIRECT
        addObject({ kind: 'brush', color: u16(0) === 1 ? null : color(p + 2) })
        break
      case 0x02fb: {
        // CREATEFONTINDIRECT
        const charset = view.getUint8(p + 13)
        const raw = new Uint8Array(buf, p + 18, Math.max(0, Math.min(32, size - 24)))
        const end = raw.indexOf(0)
        addObject({
          kind: 'font',
          height: Math.abs(i16(0)) || 16,
          escapement: i16(2),
          weight: i16(4) || 400,
          italic: view.getUint8(p + 10) !== 0,
          charset,
          face: decodeText(raw.slice(0, end < 0 ? raw.length : end), charset),
        })
        break
      }
      case 0x012d: {
        // SELECTOBJECT
        const obj = objects[u16(0)]
        if (obj?.kind === 'pen') dc.pen = obj
        else if (obj?.kind === 'brush') dc.brush = obj
        else if (obj?.kind === 'font') dc.font = obj
        break
      }
      case 0x01f0: // DELETEOBJECT
        objects[u16(0)] = null
        break
      case 0x00f7: // CREATEPALETTE
      case 0x0142: // DIBCREATEPATTERNBRUSH
      case 0x06ff: // CREATEREGION
        addObject({ kind: 'other' })
        break
      case 0x0214: // MOVETO
        dc.pos = { x: i16(1), y: i16(0) }
        break
      case 0x0213: {
        // LINETO
        const from = dc.pos
        const to = { x: i16(1), y: i16(0) }
        dc.pos = to
        withState(() => {
          ctx.beginPath()
          ctx.moveTo(from.x, from.y)
          ctx.lineTo(to.x, to.y)
          if (stroke()) ctx.stroke()
        })
        break
      }
      case 0x0324: // POLYGON
      case 0x0325: {
        // POLYLINE
        const pts = points(p + 2, i16(0))
        if (pts.length < 2) break
        withState(() => {
          ctx.beginPath()
          pts.forEach((pt, k) => (k ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y)))
          if (fn === 0x0324) {
            ctx.closePath()
            if (fill()) ctx.fill(dc.fillRule)
          }
          if (stroke()) ctx.stroke()
        })
        break
      }
      case 0x0538: {
        // POLYPOLYGON
        const n = u16(0)
        const counts = Array.from({ length: n }, (_, k) => u16(1 + k))
        let o = p + 2 + n * 2
        withState(() => {
          ctx.beginPath()
          for (const c of counts) {
            points(o, c).forEach((pt, k) => (k ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y)))
            ctx.closePath()
            o += c * 4
          }
          if (fill()) ctx.fill(dc.fillRule)
          if (stroke()) ctx.stroke()
        })
        break
      }
      case 0x041b: // RECTANGLE：下、右、上、左
      case 0x0418: {
        // ELLIPSE
        const [b, r, t, l] = [i16(0), i16(1), i16(2), i16(3)]
        withState(() => {
          ctx.beginPath()
          if (fn === 0x041b) ctx.rect(l, t, r - l, b - t)
          else ctx.ellipse((l + r) / 2, (t + b) / 2, Math.abs(r - l) / 2, Math.abs(b - t) / 2, 0, 0, Math.PI * 2)
          if (fill()) ctx.fill()
          if (stroke()) ctx.stroke()
        })
        break
      }
      case 0x0a32: {
        // EXTTEXTOUT
        const y = i16(0)
        const x = i16(1)
        const len = i16(2)
        const opts = u16(3)
        let o = p + 8
        if (opts & (ETO_OPAQUE | ETO_CLIPPED)) o += 8
        const font = dc.font
        const bytes = new Uint8Array(buf, o, Math.max(0, Math.min(len, view.byteLength - o)))
        const text = decodeText(bytes, font?.charset ?? 0)
        if (!text.trim()) break
        const dxAt = o + len + (len % 2)
        const hasDx = dxAt + 2 <= at + size
        withState(() => {
          const face = font?.face ? `"${font.face}", ` : ''
          ctx.font = `${font?.italic ? 'italic ' : ''}${(font?.weight ?? 400) >= 600 ? 'bold ' : ''}${font?.height ?? 16}px ${face}"PMingLiU", "MingLiU", "Microsoft JhengHei", serif`
          ctx.fillStyle = dc.textColor
          const v = dc.textAlign & 24
          ctx.textBaseline = v === 24 ? 'alphabetic' : v === 8 ? 'bottom' : 'top'
          ctx.textAlign = 'left'
          ctx.translate(x, y)
          if (font?.escapement) ctx.rotate((-font.escapement / 10) * (Math.PI / 180))
          // Dx 是每個位元組一個寬度，雙位元組的字取第一個位元組的寬度
          const glyphs = [...text]
          let byte = 0
          let cx = 0
          const h = dc.textAlign & 6
          const total = hasDx
            ? Array.from({ length: len }, (_, k) => (dxAt + k * 2 + 2 <= at + size ? view.getInt16(dxAt + k * 2, true) : 0)).reduce((s, w) => s + w, 0)
            : ctx.measureText(text).width
          if (h === 6) cx = -total / 2
          else if (h === 2) cx = -total
          for (const g of glyphs) {
            ctx.fillText(g, cx, 0)
            const width = new TextEncoder().encode(g).length > 1 && font?.charset ? 2 : 1
            let adv = 0
            for (let k = 0; k < width; k++) {
              const off = dxAt + (byte + k) * 2
              adv += hasDx && off + 2 <= at + size ? view.getInt16(off, true) : 0
            }
            cx += hasDx ? adv : ctx.measureText(g).width
            byte += width
          }
        })
        break
      }
      case 0x0940: // DIBBITBLT
      case 0x0b41: {
        // DIBSTRETCHBLT
        const stretch = fn === 0x0b41
        const words = size / 2 - 3
        // 沒有點陣圖的版本只是用筆刷填色，例如專有名詞的底線
        const withBitmap = words > (stretch ? 11 : 9)
        if (!withBitmap) {
          const rop = view.getUint32(p, true)
          const [h, w, y, x] = stretch ? [i16(7), i16(8), i16(9), i16(10)] : [i16(5), i16(6), i16(7), i16(8)]
          const paint = rop === 0x00f00021 ? dc.brush.color : rop === 0x00000042 ? '#000000' : rop === 0x00ff0062 ? '#ffffff' : null
          if (paint) {
            withState(() => {
              ctx.fillStyle = paint
              ctx.fillRect(x, y, w, h)
            })
          }
          break
        }
        const rop = view.getUint32(p, true)
        // DIBBITBLT：來源 y、x、高、寬、目的 y、x。DIBSTRETCHBLT：來源高、寬、y、x，目的高、寬、y、x
        const srcY = stretch ? i16(4) : i16(2)
        const srcX = stretch ? i16(5) : i16(3)
        const srcH = stretch ? i16(2) : i16(4)
        const srcW = stretch ? i16(3) : i16(5)
        const dh = stretch ? i16(6) : srcH
        const dw = stretch ? i16(7) : srcW
        const dy = stretch ? i16(8) : i16(6)
        const dx = stretch ? i16(9) : i16(7)
        const bmiAt = p + (stretch ? 20 : 16)
        const bitsAt = dibBitsOffset(view, bmiAt)
        const image = await decodeDib(view, bmiAt, bitsAt, at + size - bitsAt)
        if (!image) break
        const imgH = Math.abs(view.getInt32(bmiAt + 8, true))
        const bottomUp = view.getInt32(bmiAt + 8, true) > 0
        withState(() => {
          ctx.globalCompositeOperation = rop === 0x008800c6 ? 'multiply' : rop === 0x00ee0086 ? 'lighten' : 'source-over'
          ctx.drawImage(image, srcX, bottomUp ? imgH - srcY - srcH : srcY, srcW, srcH, dx, dy, dw, dh)
        })
        break
      }
      case 0x0f43: {
        // STRETCHDIB：rop(4)、用法、來源高寬 y x、目的高寬 y x，接著 DIB
        const rop = view.getUint32(p, true)
        const srcH = i16(3)
        const srcW = i16(4)
        const srcY = i16(5)
        const srcX = i16(6)
        const dh = i16(7)
        const dw = i16(8)
        const dy = i16(9)
        const dx = i16(10)
        const bmiAt = p + 22
        const bitsAt = dibBitsOffset(view, bmiAt)
        const image = await decodeDib(view, bmiAt, bitsAt, at + size - bitsAt)
        if (!image) break
        const imgH = Math.abs(view.getInt32(bmiAt + 8, true))
        const bottomUp = view.getInt32(bmiAt + 8, true) > 0
        withState(() => {
          ctx.globalCompositeOperation = rop === 0x008800c6 ? 'multiply' : rop === 0x00ee0086 ? 'lighten' : 'source-over'
          ctx.drawImage(image, srcX, bottomUp ? imgH - srcY - srcH : srcY, srcW, srcH, dx, dy, dw, dh)
        })
        break
      }
      default:
        break
    }
    at += size
  }
  return canvas
}
