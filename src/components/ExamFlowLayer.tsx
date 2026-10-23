import { Group, Image as KonvaImage, Line, Rect, Text } from 'react-konva'
import type { EditorAction } from '../editor/reducer'
import type { FlowImage, PlacedBlock } from '../editor/flowLayout'
import { FLOW_FONT, FLOW_WRAP } from '../editor/konvaMeasure'
import type { Asset, BlockRef } from '../types/exam'
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
}

function FigureImage({ im, asset }: { im: FlowImage; asset: Asset | undefined }) {
  const el = useHtmlImage(asset?.src)
  if (!el) {
    return <Rect x={im.x} y={im.y} width={im.w} height={im.h} fill="#f1f5f9" listening={false} />
  }
  return <KonvaImage image={el} x={im.x} y={im.y} width={im.w} height={im.h} listening={false} />
}

/** 大題與小題由排版自動定位；點擊選取後到右側編輯，不可拖曳 */
export function ExamFlowLayer({ blocks, assets, selected, flagged, interactive, dispatch }: ExamFlowLayerProps) {
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
              <Text
                key={r.key}
                name={r.placeholder ? EDITOR_ONLY_NAME : undefined}
                x={r.x}
                y={r.y}
                width={r.width}
                height={r.height}
                text={r.text}
                fontSize={r.style.fontSize}
                fontFamily={FLOW_FONT}
                fontStyle={r.style.bold ? 'bold' : 'normal'}
                fill={r.placeholder ? '#94a3b8' : r.style.fill}
                align={r.vertical ? 'center' : 'left'}
                lineHeight={r.lineHeight}
                wrap={r.vertical ? 'none' : FLOW_WRAP}
                listening={false}
              />
            ))}
            <Rect
              name={EDITOR_ONLY_NAME}
              x={b.box.x - pad}
              y={b.box.y - pad}
              width={b.box.w + pad * 2}
              height={b.box.h + pad * 2}
              cornerRadius={4}
              fill="rgba(0,0,0,0.001)"
              stroke={isSel ? '#4f46e5' : isFlag ? '#f59e0b' : undefined}
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
