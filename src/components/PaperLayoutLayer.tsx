import type Konva from 'konva'
import { Group, Line, Rect, Text } from 'react-konva'
import type { Box } from '../editor/bounds'
import type { EditorAction } from '../editor/reducer'
import { snapBoxPosition, type SnapGuides } from '../editor/snap'
import { headerItemHeight, headerItemText, type HeaderLayout, type PageGeometry } from '../types/layout'

export const EDITOR_ONLY_NAME = 'editor-only'
export const HEADER_REF_PREFIX = 'hdr:'

const LAYOUT_FONT = '"Microsoft JhengHei", "PingFang TC", sans-serif'

/** 版面骨架：內容區／欄位輔助底色、頁首分隔線、欄間分隔線 */
export function PageDecorLayer({ geometry, showGuides }: { geometry: PageGeometry; showGuides: boolean }) {
  const { content, frames, rules, header } = geometry
  return (
    <Group listening={false}>
      {showGuides ? (
        <Group name={EDITOR_ONLY_NAME}>
          <Rect x={content.x} y={content.y} width={content.w} height={content.h} stroke="#c7d2fe" strokeWidth={1} dash={[6, 4]} />
          {header ? (
            <Rect x={header.x} y={header.y} width={header.w} height={header.h} fill="rgba(245,158,11,0.05)" />
          ) : null}
          {frames.map((f, i) => (
            <Rect key={`frame-${i}`} x={f.x} y={f.y} width={f.w} height={f.h} fill="rgba(99,102,241,0.035)" />
          ))}
        </Group>
      ) : null}
      {rules.map((r) => (
        <Line key={r.key} points={[r.x1, r.y1, r.x2, r.y2]} stroke="#334155" strokeWidth={1} />
      ))}
    </Group>
  )
}

type HeaderItemsLayerProps = {
  header: HeaderLayout
  box: Box
  pageW: number
  pageH: number
  selectedId: string | null
  interactive: boolean
  dispatch: (a: EditorAction) => void
  registerRef: (id: string) => (n: Konva.Node | null) => void
  setGuides: (g: SnapGuides) => void
  clearGuides: () => void
}

/** 頁首欄位：可拖曳、可左右拉寬，位置吸附到內容區邊緣、中線與其他欄位 */
export function HeaderItemsLayer({
  header,
  box,
  pageW,
  pageH,
  selectedId,
  interactive,
  dispatch,
  registerRef,
  setGuides,
  clearGuides,
}: HeaderItemsLayerProps) {
  const visible = header.items.filter((it) => it.visible)
  const itemBox = (id: string): Box | null => {
    const it = header.items.find((x) => x.id === id)
    if (!it) return null
    return { x: box.x + it.xr * box.w, y: box.y + it.y, w: it.wr * box.w, h: headerItemHeight(it) }
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
        const text = headerItemText(it, b.w)
        const isPlaceholder = !text
        const isSel = selectedId === it.id
        return (
          <Group key={it.id}>
            {isSel ? (
              <Rect
                name={EDITOR_ONLY_NAME}
                x={b.x - 2}
                y={b.y - 2}
                width={b.w + 4}
                height={b.h + 4}
                stroke="#f59e0b"
                strokeWidth={1}
                dash={[4, 3]}
                listening={false}
              />
            ) : null}
            <Text
              ref={registerRef(`${HEADER_REF_PREFIX}${it.id}`) as (n: Konva.Text | null) => void}
              name={isPlaceholder ? EDITOR_ONLY_NAME : undefined}
              x={b.x}
              y={b.y}
              width={b.w}
              height={b.h}
              text={isPlaceholder ? `（${it.label}）` : text}
              fontSize={it.fontSize}
              fontFamily={LAYOUT_FONT}
              fontStyle={it.bold ? 'bold' : 'normal'}
              fill={isPlaceholder ? '#94a3b8' : it.fill}
              align={it.align}
              verticalAlign="middle"
              wrap="none"
              ellipsis
              draggable={interactive}
              listening={interactive}
              onMouseDown={(e) => {
                e.cancelBubble = true
                dispatch({ type: 'SELECT_BLOCK', ref: { kind: 'header', id: it.id } })
              }}
              onTap={() => dispatch({ type: 'SELECT_BLOCK', ref: { kind: 'header', id: it.id } })}
              onDragMove={(e) => {
                const n = e.target
                const r = snapBoxPosition({ x: n.x(), y: n.y(), w: b.w, h: b.h }, otherBoxes(it.id), pageW, pageH)
                n.position(clampToHeader(r.x, r.y, b.w, b.h))
                setGuides(r.guides)
              }}
              onDragEnd={(e) => {
                const n = e.target
                clearGuides()
                dispatch({
                  type: 'UPDATE_HEADER_ITEM',
                  id: it.id,
                  patch: { xr: (n.x() - box.x) / box.w, y: Math.round(n.y() - box.y) },
                })
              }}
              onTransformEnd={(e) => {
                const n = e.target as Konva.Text
                const w = Math.max(30, n.width() * n.scaleX())
                n.scaleX(1)
                n.scaleY(1)
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
