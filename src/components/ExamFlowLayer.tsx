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

/** 大題與小題由排版自動定位；點擊選取後到右側編輯，不可拖曳 */
export function ExamFlowLayer({ blocks, assets, selected, flagged, interactive, dispatch, fontFamily }: ExamFlowLayerProps) {
  return (
    <Group>
      {blocks.map((b) => {
        const isSel = selected?.id === b.ref.id
        const isFlag = flagged.has(b.ref.id)
        const pad = 4
        return (
          <Group key={`${b.ref.kind}:${b.ref.id}:${b.page}:${b.frame}:${Math.round(b.box.x)}`}>
            {b.rules.map((r) => (
              <Line key={r.key} points={[r.x1, r.y1, r.x2, r.y2]} stroke="#94a3b8" strokeWidth={1} listening={false} />
            ))}
            {b.images.map((im) => (
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
          </Group>
        )
      })}
    </Group>
  )
}
