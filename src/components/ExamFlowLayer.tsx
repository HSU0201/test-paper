import { memo } from 'react'
import { Group, Image as KonvaImage, Line, Rect, Text } from 'react-konva'

import type { Box } from '../editor/bounds'
import type { FlowFrame, FlowImage, FlowRun, PlacedBlock } from '../editor/flowLayout'
import { FLOW_WRAP, measureText } from '../editor/konvaMeasure'
import type { EditorAction } from '../editor/reducer'
import { fontStyleFor, layoutRichLines, type RubyFace,textDecorationFor } from '../editor/richText'
import { FRAC_SCALE, rubyPlace } from '../editor/rubyLayout'
import { snapBoxPosition, type SnapGuides } from '../editor/snap'
import { EDITOR_FLAG, EDITOR_SELECTION } from '../editor/theme'
import { needsManualWrap } from '../editor/zhuyin'
import { ANSWER_INK } from '../export/answerMarks'
import { ANSWER_KEY_NAME } from '../export/pdfFromStage'
import type { Asset, BlockRef } from '../types/exam'
import { EDITOR_ONLY_NAME } from './PaperLayoutLayer'
import { useHtmlImage } from './useHtmlImage'

type ExamFlowLayerProps = {
  blocks: PlacedBlock[]
  frames: FlowFrame[]
  assets: Record<string, Asset>
  selected: BlockRef | null
  /** 有版面提示（標題被移動、超出欄高）的區塊 */
  flagged: Set<string>
  interactive: boolean
  dispatch: (a: EditorAction) => void
  fontFamily: string
  pageW: number
  pageH: number
  /** 拖曳提示框時顯示吸附參考線 */
  setGuides: (g: SnapGuides) => void
  clearGuides: () => void
}

/**
 * 提示框可以吸附的位置：原本自動排好的位置、各欄的左右邊與中線、頁面中線，
 * 以及同頁其他提示框。原位的左右邊也算，所以只改高低時左右會自動對齊原位。
 */
function noticeSnapTargets(b: PlacedBlock, blocks: PlacedBlock[], frames: FlowFrame[]): Box[] {
  const targets: Box[] = [b.home ?? b.box]
  for (const f of frames) targets.push({ x: f.x, y: f.y, w: f.w, h: f.h })
  for (const other of blocks) {
    if (other === b || other.ref.kind !== 'notice') continue
    targets.push(other.box)
  }
  return targets
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
    const step = Math.max(1, r.inkStep ?? r.style.fontSize * r.lineHeight)
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

function RubyCluster({
  x,
  y,
  step,
  fontSize,
  fontFamily,
  hanBold,
  hanDeco,
  fill,
  face,
  han,
  reading,
}: {
  x: number
  y: number
  step: number
  fontSize: number
  fontFamily: string
  hanBold: string
  hanDeco: string
  fill: string
  face: RubyFace
  han: string
  reading: string
}) {
  const place = rubyPlace(fontSize, step, face, reading)
  const adv = place.adv
  const baseY = y + place.baseY
  const sideY = y + place.sideY
  return (
    <Group x={x} y={0} listening={false}>
      {place.box ? (
        <Rect
          x={place.box.x}
          y={y + place.box.y}
          width={place.box.w}
          height={place.box.h}
          stroke={fill}
          strokeWidth={1.35}
          listening={false}
        />
      ) : face === 'char' || face === 'blank' ? (
        <Text
          x={0}
          y={baseY}
          text={han}
          fontSize={fontSize}
          fontFamily={fontFamily}
          fontStyle={fontStyleFor(hanBold === 'bold' || hanBold === 'italic bold', hanDeco)}
          textDecoration={textDecorationFor(hanDeco) || undefined}
          fill={fill}
          listening={false}
        />
      ) : null}
      {place.blank ? (
        <Rect
          x={place.blank.x}
          y={y + place.blank.y}
          width={place.blank.w}
          height={place.blank.h}
          stroke={fill}
          strokeWidth={1}
          dash={[3, 2]}
          listening={false}
        />
      ) : adv.letters.map((ch, i) => (
        <Text
          key={i}
          x={place.colX}
          y={sideY + i * adv.pitch}
          width={adv.letter * 1.15}
          height={adv.pitch}
          text={ch}
          fontSize={adv.letter}
          fontFamily={fontFamily}
          fill={fill}
          align="center"
          verticalAlign="middle"
          wrap="none"
          listening={false}
        />
      ))}
      {face !== 'blank' && adv.tone ? (
        <Text
          x={place.colX + adv.letter * 1.02}
          y={sideY + (adv.stack - adv.letter) / 2}
          width={adv.letter}
          height={adv.letter}
          text={adv.tone}
          fontSize={adv.letter * 0.92}
          fontFamily={fontFamily}
          fill={fill}
          align="left"
          verticalAlign="middle"
          wrap="none"
          listening={false}
        />
      ) : null}
    </Group>
  )
}

function FlowRunText({ r, fontFamily }: { r: FlowRun; fontFamily: string }) {
  if (r.ink?.length) {
    const step = r.inkStep ?? r.style.fontSize * r.lineHeight
    const base = r.placeholder ? '#94a3b8' : r.style.fill || '#000000'
    const fontStyle = r.style.bold ? 'bold' : 'normal'
    const lineWidth = new Map<number, number>()
    for (const p of r.ink) lineWidth.set(p.line, Math.max(lineWidth.get(p.line) ?? 0, p.x + p.width))
    const shift = (line: number) => {
      if (!r.align || r.align === 'left') return 0
      const used = lineWidth.get(line) ?? 0
      return r.align === 'center' ? Math.max(0, (r.width - used) / 2) : Math.max(0, r.width - used)
    }
    return (
      <Group listening={false}>
        {r.ink.map((p, i) => {
          const x = r.x + p.x + shift(p.line)
          const y = r.y + p.line * step
          const fill = p.color || base
          if (p.frac) {
            const fs = r.style.fontSize
            const size = fs * FRAC_SCALE
            const top = y + Math.max(0, (step - (size * 2 + fs * 0.3)) / 2)
            const barY = top + size + fs * 0.15
            const fracStyle = fontStyleFor(!!r.style.bold, p.deco || '')
            const inset = fs * 0.12
            const part = (text: string, ty: number) => (
              <Text
                x={x}
                y={ty}
                width={p.width}
                text={text}
                fontSize={size}
                fontFamily={fontFamily}
                fontStyle={fracStyle}
                fill={fill}
                align="center"
                wrap="none"
                listening={false}
              />
            )
            return (
              <Group key={i} listening={false}>
                {part(p.frac.num, top)}
                <Line
                  points={[x + inset, barY, x + p.width - inset, barY]}
                  stroke={fill}
                  strokeWidth={Math.max(1, fs * 0.06)}
                  listening={false}
                />
                {part(p.frac.den, barY + fs * 0.15)}
              </Group>
            )
          }
          if (p.ruby) {
            return (
              <RubyCluster
                key={i}
                x={x}
                y={y}
                step={step}
                fontSize={r.style.fontSize}
                fontFamily={fontFamily}
                hanBold={fontStyle}
                hanDeco={p.deco || ''}
                fill={fill}
                face={p.ruby.face}
                han={p.ruby.han}
                reading={p.ruby.reading}
              />
            )
          }
          const mark = fontStyleFor(!!r.style.bold, p.deco || '')
          return (
            <Text
              key={i}
              x={x}
              y={y}
              width={Math.max(1, p.width)}
              height={step}
              text={p.text}
              fontSize={r.style.fontSize}
              fontFamily={fontFamily}
              fontStyle={mark}
              textDecoration={textDecorationFor(p.deco || '') || undefined}
              fill={fill}
              verticalAlign="middle"
              wrap="none"
              listening={false}
            />
          )
        })}
      </Group>
    )
  }
  const base = r.placeholder ? '#94a3b8' : r.style.fill || '#000000'
  const fontStyle = r.style.bold ? 'bold' : 'normal'
  const step = r.style.fontSize * r.lineHeight
  const marked = !!r.decos?.some(Boolean)
  if (r.vertical && (r.colors?.some(Boolean) || marked)) {
    const glyphs = r.text.split('\n')
    const groups: { text: string; color: string; deco: string; start: number }[] = []
    glyphs.forEach((g, i) => {
      const color = r.colors?.[i] || base
      const deco = r.decos?.[i] || ''
      const last = groups[groups.length - 1]
      if (last && last.color === color && last.deco === deco) last.text += `\n${g}`
      else groups.push({ text: g, color, deco, start: i })
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
            fontStyle={fontStyleFor(!!r.style.bold, g.deco)}
            textDecoration={textDecorationFor(g.deco) || undefined}
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
  const manual = !r.vertical && needsManualWrap(r.text)
  if (!r.vertical && (r.colors?.some(Boolean) || marked || manual)) {
    const widthOf = (sample: string, deco = '') =>
      measureText(
        fontFamily,
        sample,
        10000,
        { ...r.style, bold: !!r.style.bold || deco.includes('b'), italic: deco.includes('i') },
        r.lineHeight,
      ).naturalWidth
    const pieces = layoutRichLines(r.text, r.colors, r.width, widthOf, r.decos)
    const lineWidth = new Map<number, number>()
    if (r.align === 'center' || r.align === 'right') {
      for (const p of pieces) {
        lineWidth.set(p.line, Math.max(lineWidth.get(p.line) ?? 0, p.x + widthOf(p.text, p.deco)))
      }
    }
    const shift = (line: number) => {
      if (!r.align || r.align === 'left') return 0
      const used = lineWidth.get(line) ?? 0
      return r.align === 'center' ? Math.max(0, (r.width - used) / 2) : Math.max(0, r.width - used)
    }
    return (
      <Group>
        {pieces.map((p, i) => (
          <Text
            key={i}
            name={r.placeholder ? EDITOR_ONLY_NAME : undefined}
            x={r.x + p.x + shift(p.line)}
            y={r.y + p.line * step}
            text={p.text}
            fontSize={r.style.fontSize}
            fontFamily={fontFamily}
            fontStyle={fontStyleFor(!!r.style.bold, p.deco)}
            textDecoration={textDecorationFor(p.deco) || undefined}
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
      align={r.align ?? (r.vertical ? 'center' : 'left')}
      lineHeight={r.lineHeight}
      wrap={r.vertical ? 'none' : FLOW_WRAP}
      listening={false}
    />
  )
}

/** 大題與小題由排版自動定位。題目附圖可在卷面上拖曳，改它接在題幹的哪裡 */
function ExamFlowLayerInner({
  blocks,
  frames,
  assets,
  selected,
  flagged,
  interactive,
  dispatch,
  fontFamily,
  pageW,
  pageH,
  setGuides,
  clearGuides,
}: ExamFlowLayerProps) {
  return (
    <Group>
      {frames.map((f) => (
        <Group key={f.key} listening={false}>
          <Rect x={f.x} y={f.y} width={f.w} height={f.h} stroke="#111111" strokeWidth={1.25} listening={false} />
          {f.rules.map((r) => (
            <Line
              key={r.key}
              points={[r.x1, r.y1, r.x2, r.y2]}
              stroke={r.stroke ?? '#111111'}
              strokeWidth={r.strokeWidth ?? 1.25}
              listening={false}
            />
          ))}
        </Group>
      ))}
      {blocks.map((b) => {
        const isSel = selected?.id === b.ref.id
        const isFlag = flagged.has(b.ref.id)
        const pad = 4
        const questionId = b.ref.kind === 'question' ? b.ref.id : null
        // 提示框（下一頁還有題目、作答結束）可以在卷面上自由拖曳
        const movable = interactive && b.ref.kind === 'notice'
        return (
          <Group
            key={`${b.ref.kind}:${b.ref.id}:${b.page}:${b.frame}:${Math.round(b.box.x)}:${Math.round(b.box.y)}`}
            draggable={movable}
            onDragStart={movable ? () => dispatch({ type: 'SELECT_BLOCK', ref: b.ref }) : undefined}
            onDragMove={
              movable
                ? (e) => {
                    const node = e.target
                    // 按住 Alt 拖曳時不吸附，可以微調到任何位置
                    if (e.evt.altKey) {
                      clearGuides()
                      return
                    }
                    const moved = { ...b.box, x: b.box.x + node.x(), y: b.box.y + node.y() }
                    const r = snapBoxPosition(moved, noticeSnapTargets(b, blocks, frames), pageW, pageH)
                    node.position({ x: r.x - b.box.x, y: r.y - b.box.y })
                    setGuides(r.guides)
                  }
                : undefined
            }
            onDragEnd={
              movable
                ? (e) => {
                    const node = e.target
                    const dx = node.x()
                    const dy = node.y()
                    clearGuides()
                    node.position({ x: 0, y: 0 })
                    if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return
                    dispatch({ type: 'MOVE_NOTICE', id: b.ref.id, dx, dy })
                  }
                : undefined
            }
          >
            {b.rules.map((r) => (
              <Line
                key={r.key}
                points={[r.x1, r.y1, r.x2, r.y2]}
                stroke={r.stroke ?? '#94a3b8'}
                strokeWidth={r.strokeWidth ?? 1}
                dash={r.dash}
                listening={false}
              />
            ))}
            {b.images
              .filter((im) => !im.movable)
              .map((im) => (
                <FigureImage key={im.key} im={im} asset={assets[im.assetId]} />
              ))}
            {b.runs
              .filter((r) => !r.answer)
              .map((r) => (
                <FlowRunText key={r.key} r={r} fontFamily={fontFamily} />
              ))}
            {b.runs.some((r) => r.answer) ? (
              // 注音格留白的字：只在匯出答案時顯示
              <Group name={ANSWER_KEY_NAME} visible={false} listening={false}>
                {b.runs
                  .filter((r) => r.answer)
                  .map((r) => (
                    <FlowRunText key={r.key} r={{ ...r, style: { ...r.style, fill: ANSWER_INK } }} fontFamily={fontFamily} />
                  ))}
              </Group>
            ) : null}
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
                // 提示框要讓事件傳到外層 Group，Konva 才會開始拖曳
                if (!movable) e.cancelBubble = true
                dispatch({ type: 'SELECT_BLOCK', ref: b.ref })
              }}
              onTap={() => dispatch({ type: 'SELECT_BLOCK', ref: b.ref })}
              onMouseEnter={(e) => {
                const c = e.target.getStage()?.container()
                if (c) c.style.cursor = movable ? 'move' : 'pointer'
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

/** 只在自己的資料變動時重畫；選取別的物件、存檔狀態改變時不必重算 */
export const ExamFlowLayer = memo(ExamFlowLayerInner)
