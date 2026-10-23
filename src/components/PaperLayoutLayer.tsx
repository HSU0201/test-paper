import type Konva from 'konva'
import { useRef } from 'react'
import { Group, Line, Rect, Text } from 'react-konva'
import type { Box } from '../editor/bounds'
import type { EditorAction } from '../editor/reducer'
import { snapBoxPosition, type SnapGuides } from '../editor/snap'
import { measureText } from '../editor/konvaMeasure'
import { layoutRichLines, paintText, plainText } from '../editor/richText'
import { EDITOR_GUIDE } from '../editor/theme'
import { headerItemHeight, headerItemText, verticalHeaderText, type HeaderItem, type HeaderLayout, type PageGeometry } from '../types/layout'

export const EDITOR_ONLY_NAME = 'editor-only'
export const HEADER_REF_PREFIX = 'hdr:'

/** 版面骨架：內容區／欄位輔助底色、頁首分隔線、欄間分隔線 */
export function PageDecorLayer({ geometry, showGuides }: { geometry: PageGeometry; showGuides: boolean }) {
  const { content, frames, rules, header } = geometry
  return (
    <Group listening={false}>
      {showGuides ? (
        <Group name={EDITOR_ONLY_NAME}>
          <Rect x={content.x} y={content.y} width={content.w} height={content.h} stroke="#e7d39a" strokeWidth={1} dash={[6, 4]} />
          {header ? (
            <Rect x={header.x} y={header.y} width={header.w} height={header.h} fill="rgba(226,176,7,0.1)" />
          ) : null}
          {frames.map((f, i) => (
            <Rect key={`frame-${i}`} x={f.x} y={f.y} width={f.w} height={f.h} fill="rgba(246,209,91,0.18)" />
          ))}
        </Group>
      ) : null}
      {rules.map((r) => (
        <Line key={r.key} points={[r.x1, r.y1, r.x2, r.y2]} stroke="#2c2416" strokeWidth={1} />
      ))}
    </Group>
  )
}

function HeaderInk({
  box,
  item,
  painted,
  vertical,
  fontFamily,
}: {
  box: Box
  item: HeaderItem
  painted: { text: string; colors?: string[] }
  vertical: boolean
  fontFamily: string
}) {
  const fontStyle = item.bold ? 'bold' : 'normal'
  const widthOf = (sample: string) =>
    measureText(fontFamily, sample, 10000, { fontSize: item.fontSize, fill: '#000000', bold: item.bold }, vertical ? 1.15 : 1)
      .naturalWidth
  if (vertical) {
    const glyphs = [...painted.text].map((ch) => verticalHeaderText(ch))
    const step = item.fontSize * 1.15
    const textH = glyphs.length * step
    const y0 = item.align === 'right' ? box.h - textH : item.align === 'center' ? (box.h - textH) / 2 : 0
    return (
      <Group listening={false}>
        {glyphs.map((g, i) => {
          const w = widthOf(g)
          return (
            <Text
              key={i}
              x={(box.w - w) / 2}
              y={y0 + i * step}
              text={g}
              fontSize={item.fontSize}
              fontFamily={fontFamily}
              fontStyle={fontStyle}
              fill={painted.colors?.[i] || '#000000'}
              listening={false}
            />
          )
        })}
      </Group>
    )
  }
  const fullW = widthOf(painted.text)
  const origin = item.align === 'center' ? Math.max(0, (box.w - fullW) / 2) : item.align === 'right' ? Math.max(0, box.w - fullW) : 0
  const pieces = layoutRichLines(painted.text, painted.colors, 100000, widthOf)
  return (
    <Group listening={false}>
      {pieces.map((p, i) => (
        <Text
          key={i}
          x={origin + p.x}
          y={p.line * item.fontSize}
          text={p.text}
          fontSize={item.fontSize}
          fontFamily={fontFamily}
          fontStyle={fontStyle}
          fill={p.color || '#000000'}
          listening={false}
        />
      ))}
    </Group>
  )
}

type HeaderItemsLayerProps = {
  header: HeaderLayout
  box: Box
  /** 橫向：頁首在右側，文字直排 */
  vertical: boolean
  pageW: number
  pageH: number
  selectedId: string | null
  interactive: boolean
  dispatch: (a: EditorAction) => void
  registerRef: (id: string) => (n: Konva.Node | null) => void
  setGuides: (g: SnapGuides) => void
  clearGuides: () => void
  fontFamily: string
}

/** 頁首欄位：可拖曳、可左右拉寬，位置吸附到內容區邊緣、中線與其他欄位 */
export function HeaderItemsLayer({
  header,
  box,
  vertical,
  pageW,
  pageH,
  selectedId,
  interactive,
  dispatch,
  registerRef,
  setGuides,
  clearGuides,
  fontFamily,
}: HeaderItemsLayerProps) {
  const visible = header.items.filter((it) => it.visible)
  const inkRefs = useRef(new Map<string, Konva.Group>())
  const itemBox = (id: string): Box | null => {
    const it = header.items.find((x) => x.id === id)
    if (!it) return null
    const col = headerItemHeight(it)
    if (vertical) {
      return { x: box.x + box.w - it.y - col, y: box.y + it.xr * box.h, w: col, h: it.wr * box.h }
    }
    return { x: box.x + it.xr * box.w, y: box.y + it.y, w: it.wr * box.w, h: col }
  }
  const otherBoxes = (id: string): Box[] => [
    box,
    ...visible.filter((it) => it.id !== id).map((it) => itemBox(it.id)!),
  ]
  const clampToHeader = (x: number, y: number, w: number, h: number) => ({
    x: Math.max(box.x, Math.min(x, box.x + box.w - w)),
    y: Math.max(box.y, Math.min(y, box.y + Math.max(0, box.h - h))),
  })

  return (
    <Group>
      {visible.map((it) => {
        const b = itemBox(it.id)!
        const text = headerItemText(it, vertical ? b.h / 1.15 : b.w)
        const painted = paintText(text)
        const shown = vertical && painted.text ? verticalHeaderText(painted.text) : painted.text
        const colored = !!painted.colors?.some(Boolean)
        const isPlaceholder = !text
        const isSel = selectedId === it.id
        const syncInk = (n: Konva.Node) => {
          inkRefs.current.get(it.id)?.setAttrs({ x: n.x(), y: n.y(), scaleX: n.scaleX(), scaleY: n.scaleY() })
        }
        return (
          <Group key={it.id}>
            {isSel ? (
              <Rect
                name={EDITOR_ONLY_NAME}
                x={b.x - 2}
                y={b.y - 2}
                width={b.w + 4}
                height={b.h + 4}
                stroke={EDITOR_GUIDE}
                strokeWidth={1}
                dash={[4, 3]}
                listening={false}
              />
            ) : null}
            {colored ? (
              <Group
                ref={(n) => {
                  if (n) inkRefs.current.set(it.id, n)
                  else inkRefs.current.delete(it.id)
                }}
                x={b.x}
                y={b.y}
                listening={false}
              >
                <HeaderInk box={b} item={it} painted={painted} vertical={vertical} fontFamily={fontFamily} />
              </Group>
            ) : null}
            <Text
              ref={registerRef(`${HEADER_REF_PREFIX}${it.id}`) as (n: Konva.Text | null) => void}
              name={isPlaceholder ? EDITOR_ONLY_NAME : undefined}
              x={b.x}
              y={b.y}
              width={b.w}
              height={vertical ? b.h : undefined}
              text={isPlaceholder ? (vertical ? verticalHeaderText(plainText(it.label)) : `（${plainText(it.label)}）`) : shown}
              fontSize={it.fontSize}
              fontFamily={fontFamily}
              fontStyle={it.bold ? 'bold' : 'normal'}
              fill={isPlaceholder ? '#94a3b8' : colored ? 'rgba(0,0,0,0)' : '#000000'}
              align={vertical ? 'center' : it.align}
              verticalAlign={vertical ? (it.align === 'left' ? 'top' : it.align === 'right' ? 'bottom' : 'middle') : 'middle'}
              lineHeight={vertical ? 1.15 : 1}
              wrap="none"
              ellipsis={!vertical}
              draggable={interactive}
              listening={interactive}
              onMouseDown={(e) => {
                e.cancelBubble = true
                dispatch({ type: 'SELECT_BLOCK', ref: { kind: 'header', id: it.id } })
              }}
              onTap={() => dispatch({ type: 'SELECT_BLOCK', ref: { kind: 'header', id: it.id } })}
              onDragMove={(e) => {
                const n = e.target
                syncInk(n)
                const r = snapBoxPosition({ x: n.x(), y: n.y(), w: b.w, h: b.h }, otherBoxes(it.id), pageW, pageH)
                n.position(clampToHeader(r.x, r.y, b.w, b.h))
                syncInk(n)
                setGuides(r.guides)
              }}
              onDragEnd={(e) => {
                const n = e.target
                clearGuides()
                dispatch({
                  type: 'UPDATE_HEADER_ITEM',
                  id: it.id,
                  patch: vertical
                    ? { xr: (n.y() - box.y) / box.h, y: Math.round(box.x + box.w - n.x() - n.width()) }
                    : { xr: (n.x() - box.x) / box.w, y: Math.round(n.y() - box.y) },
                })
              }}
              onTransform={(e) => syncInk(e.target)}
              onTransformEnd={(e) => {
                const n = e.target as Konva.Text
                const sx = n.scaleX()
                const sy = n.scaleY()
                n.scaleX(1)
                n.scaleY(1)
                inkRefs.current.get(it.id)?.scale({ x: 1, y: 1 })
                if (vertical) {
                  const h = Math.max(it.fontSize * 2, n.height() * sy)
                  n.height(h)
                  dispatch({
                    type: 'UPDATE_HEADER_ITEM',
                    id: it.id,
                    patch: {
                      xr: (n.y() - box.y) / box.h,
                      wr: Math.min(1, h / box.h),
                      y: Math.round(box.x + box.w - n.x() - n.width()),
                    },
                  })
                  return
                }
                const w = Math.max(30, n.width() * sx)
                dispatch({
                  type: 'UPDATE_HEADER_ITEM',
                  id: it.id,
                  patch: { xr: (n.x() - box.x) / box.w, wr: Math.min(1, w / box.w) },
                })
              }}
              onMouseEnter={(e) => {
                const c = e.target.getStage()?.container()
                if (c) c.style.cursor = 'move'
              }}
              onMouseLeave={(e) => {
                const c = e.target.getStage()?.container()
                if (c) c.style.cursor = ''
              }}
            />
          </Group>
        )
      })}
    </Group>
  )
}
