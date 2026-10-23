import { Group, Image as KonvaImage, Line, Rect, Text } from 'react-konva'
import type { EditorAction } from '../editor/reducer'
import type { FlowImage, FlowRun, PlacedBlock } from '../editor/flowLayout'
import { FLOW_WRAP, measureText } from '../editor/konvaMeasure'
import { layoutRichLines } from '../editor/richText'
import type { Asset, BlockRef } from '../types/exam'
import { EDITOR_FLAG, EDITOR_SELECTION } from '../editor/theme'
import { EDITOR_ONLY_NAME } from './PaperLayoutLayer'
import { useHtmlImage } from './useHtmlImage'

type ExamFlowLayerProps = {
  blocks: PlacedBlock[]
  assets: Record<string, Asset>
  selected: BlockRef | null
  /** 有版面提示（標題被移動、超出欄高）的區塊 */
  flagged: Set<string>
  interactive: boolean
  dispatch: (a: EditorAction) => void
  fontFamily: string
}

function FigureImage({ im, asset }: { im: FlowImage; asset: Asset | undefined }) {
  const el = useHtmlImage(asset?.src)
  if (!el) {
    return <Rect x={im.x} y={im.y} width={im.w} height={im.h} fill="#f1f5f9" listening={false} />
  }
  return <KonvaImage image={el} x={im.x} y={im.y} width={im.w} height={im.h} listening={false} />
}

type StemSlot = { index: number; x: number; y: number }

/** 題幹每一行（直排則每個字）的接點。index 0 是題幹最前面，最後一個是題幹結尾 */
function stemSlots(blocks: PlacedBlock[], questionId: string): StemSlot[] {
  const runs = blocks
    .filter((b) => b.ref.kind === 'question' && b.ref.id === questionId)
    .flatMap((b) => b.runs)
    .filter((r) => r.key === 'stem' || r.key.startsWith('stem-'))
  const slots: StemSlot[] = []
  let index = 0
  let origin = false
  for (const r of runs) {
    const step = Math.max(1, r.style.fontSize * r.lineHeight)
    if (r.vertical) {
      const n = r.text ? r.text.split('\n').length : 0
      const skip = Math.min(r.stemFrom ?? 0, n)
      if (!origin && n > skip) {
        slots.push({ index: index++, x: r.x + r.width / 2, y: r.y + skip * step })
        origin = true
      }
      for (let i = skip; i < n; i++) slots.push({ index: index++, x: r.x + r.width / 2, y: r.y + (i + 1) * step })
    } else {
      const n = r.lineCount ?? Math.max(1, Math.round((r.height ?? step) / step))
      if (!origin) {
        slots.push({ index: index++, x: r.x, y: r.y })
        origin = true
      }
      for (let i = 0; i < n; i++) slots.push({ index: index++, x: r.x, y: r.y + (i + 1) * step })
    }
  }
  return slots
}

function nearestSlot(slots: StemSlot[], x: number, y: number, vertical: boolean): StemSlot {
  let best = slots[0]
  let bestD = Infinity
  for (const s of slots) {
    const dy = s.y - y
    const dx = vertical ? s.x - x : 0
    const d = dx * dx + dy * dy
    if (d < bestD) {
      best = s
      bestD = d
    }
  }
  return best
}

function DraggableFigure({
  im,
  asset,
  questionId,
  blocks,
  dispatch,
}: {
  im: FlowImage
  asset: Asset | undefined
  questionId: string
  blocks: PlacedBlock[]
  dispatch: (a: EditorAction) => void
}) {
  const el = useHtmlImage(asset?.src)
  const vertical = blocks.some(
    (b) => b.ref.kind === 'question' && b.ref.id === questionId && b.runs.some((r) => r.vertical),
  )
  const onDragEnd = (node: { x: () => number; y: () => number; position: (p: { x: number; y: number }) => void }) => {
    const x = node.x()
    const y = node.y()
    node.position({ x: im.x, y: im.y })
    if (Math.abs(x - im.x) < 4 && Math.abs(y - im.y) < 4) return
    const slots = stemSlots(blocks, questionId)
    if (slots.length < 2) return
    const hit = nearestSlot(slots, x + im.w / 2, y, vertical)
    const last = slots[slots.length - 1].index
    if (hit.index === last) {
      if (im.anchor === 'middle') {
        dispatch({ type: 'UPDATE_FIGURE', questionId, figureId: im.key, patch: { placement: 'below' } })
      }
      return
    }
    if (im.anchor === 'middle' && im.afterLine === hit.index) return
    dispatch({
      type: 'UPDATE_FIGURE',
      questionId,
      figureId: im.key,
      patch: { placement: 'middle', afterLine: hit.index },
    })
  }
  const shared = {
    x: im.x,
    y: im.y,
    width: im.w,
    height: im.h,
    draggable: true,
    dragBoundFunc: vertical ? undefined : (pos: { x: number; y: number }) => ({ x: im.x, y: pos.y }),
    onMouseDown: (e: { cancelBubble: boolean }) => {
      e.cancelBubble = true
      dispatch({ type: 'SELECT_BLOCK', ref: { kind: 'question', id: questionId } })
    },
    onDragStart: (e: { cancelBubble: boolean }) => {
      e.cancelBubble = true
      dispatch({ type: 'SELECT_BLOCK', ref: { kind: 'question', id: questionId } })
    },
    onDragEnd: (e: { target: { x: () => number; y: () => number; position: (p: { x: number; y: number }) => void } }) =>
      onDragEnd(e.target),
    onMouseEnter: (e: { target: { getStage: () => { container: () => HTMLElement } | null } }) => {
      const c = e.target.getStage()?.container()
      if (c) c.style.cursor = vertical ? 'move' : 'ns-resize'
    },
    onMouseLeave: (e: { target: { getStage: () => { container: () => HTMLElement } | null } }) => {
      const c = e.target.getStage()?.container()
      if (c) c.style.cursor = ''
    },
  }
  if (!el) return <Rect {...shared} fill="#f1f5f9" stroke="#94a3b8" strokeWidth={1} />
  return <KonvaImage {...shared} image={el} />
}

function FlowRunText({ r, fontFamily }: { r: FlowRun; fontFamily: string }) {
  const base = r.placeholder ? '#94a3b8' : r.style.fill || '#000000'
  const fontStyle = r.style.bold ? 'bold' : 'normal'
  const step = r.style.fontSize * r.lineHeight
  if (r.vertical && r.colors?.some(Boolean)) {
    const glyphs = r.text.split('\n')
    const groups: { text: string; color: string; start: number }[] = []
    glyphs.forEach((g, i) => {
      const color = r.colors?.[i] || base
      const last = groups[groups.length - 1]
      if (last && last.color === color) last.text += `\n${g}`
      else groups.push({ text: g, color, start: i })
    })
    return (
      <Group>
        {groups.map((g) => (
          <Text
            key={g.start}
            name={r.placeholder ? EDITOR_ONLY_NAME : undefined}
            x={r.x}
            y={r.y + g.start * step}
            width={r.width}
            height={g.text.split('\n').length * step}
            text={g.text}
            fontSize={r.style.fontSize}
            fontFamily={fontFamily}
            fontStyle={fontStyle}
            fill={g.color}
            align="center"
            lineHeight={r.lineHeight}
            wrap="none"
            listening={false}
          />
        ))}
      </Group>
    )
  }
  if (!r.vertical && r.colors?.some(Boolean)) {
    const pieces = layoutRichLines(r.text, r.colors, r.width, (sample) =>
      measureText(fontFamily, sample, 10000, r.style, r.lineHeight).naturalWidth,
    )
    return (
      <Group>
        {pieces.map((p, i) => (
          <Text
            key={i}
            name={r.placeholder ? EDITOR_ONLY_NAME : undefined}
            x={r.x + p.x}
            y={r.y + p.line * step}
            text={p.text}
            fontSize={r.style.fontSize}
            fontFamily={fontFamily}
            fontStyle={fontStyle}
            fill={p.color || base}
            wrap="none"
            listening={false}
          />
        ))}
      </Group>
    )
  }
  return (
    <Text
      name={r.placeholder ? EDITOR_ONLY_NAME : undefined}
      x={r.x}
      y={r.y}
      width={r.width}
      height={r.height}
      text={r.text}
      fontSize={r.style.fontSize}
      fontFamily={fontFamily}
      fontStyle={fontStyle}
      fill={base}
      align={r.vertical ? 'center' : 'left'}
      lineHeight={r.lineHeight}
      wrap={r.vertical ? 'none' : FLOW_WRAP}
      listening={false}
    />
  )
}

/** 大題與小題由排版自動定位。題目附圖可在卷面上拖曳，改它接在題幹的哪裡 */
export function ExamFlowLayer({ blocks, assets, selected, flagged, interactive, dispatch, fontFamily }: ExamFlowLayerProps) {
  return (
    <Group>
      {blocks.map((b) => {
        const isSel = selected?.id === b.ref.id
        const isFlag = flagged.has(b.ref.id)
        const pad = 4
        const questionId = b.ref.kind === 'question' ? b.ref.id : null
        return (
          <Group key={`${b.ref.kind}:${b.ref.id}:${b.page}:${b.frame}:${Math.round(b.box.x)}`}>
            {b.rules.map((r) => (
              <Line key={r.key} points={[r.x1, r.y1, r.x2, r.y2]} stroke="#94a3b8" strokeWidth={1} listening={false} />
            ))}
            {b.images
              .filter((im) => !im.movable)
              .map((im) => (
                <FigureImage key={im.key} im={im} asset={assets[im.assetId]} />
              ))}
            {b.runs.map((r) => (
              <FlowRunText key={r.key} r={r} fontFamily={fontFamily} />
            ))}
            <Rect
              name={EDITOR_ONLY_NAME}
              x={b.box.x - pad}
              y={b.box.y - pad}
              width={b.box.w + pad * 2}
              height={b.box.h + pad * 2}
              cornerRadius={4}
              fill="rgba(0,0,0,0.001)"
              stroke={isSel ? EDITOR_SELECTION : isFlag ? EDITOR_FLAG : undefined}
              strokeWidth={isSel || isFlag ? 1.5 : 0}
              dash={[5, 3]}
              listening={interactive}
              onMouseDown={(e) => {
                e.cancelBubble = true
                dispatch({ type: 'SELECT_BLOCK', ref: b.ref })
              }}
              onTap={() => dispatch({ type: 'SELECT_BLOCK', ref: b.ref })}
              onMouseEnter={(e) => {
                const c = e.target.getStage()?.container()
                if (c) c.style.cursor = 'pointer'
              }}
              onMouseLeave={(e) => {
                const c = e.target.getStage()?.container()
                if (c) c.style.cursor = ''
              }}
            />
            {interactive && questionId
              ? b.images
                  .filter((im) => im.movable)
                  .map((im) => (
                    <DraggableFigure
                      key={im.key}
                      im={im}
                      asset={assets[im.assetId]}
                      questionId={questionId}
                      blocks={blocks}
                      dispatch={dispatch}
                    />
                  ))
              : b.images
                  .filter((im) => im.movable)
                  .map((im) => <FigureImage key={im.key} im={im} asset={assets[im.assetId]} />)}
          </Group>
        )
      })}
    </Group>
  )
}
