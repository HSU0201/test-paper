import { Group, Line, Rect, Text } from 'react-konva'
import type { EditorAction } from '../editor/reducer'
import type { FlowResult } from '../editor/flowLayout'
import { FLOW_FONT, FLOW_WRAP } from '../editor/konvaMeasure'
import type { BlockRef } from '../types/exam'
import { EDITOR_ONLY_NAME } from './PaperLayoutLayer'

type ExamFlowLayerProps = {
  flow: FlowResult
  selected: BlockRef | null
  interactive: boolean
  dispatch: (a: EditorAction) => void
}

/** 大題與小題由排版自動定位；點擊選取後到右側編輯，不可拖曳 */
export function ExamFlowLayer({ flow, selected, interactive, dispatch }: ExamFlowLayerProps) {
  return (
    <Group>
      {flow.blocks.map((b) => {
        const isSel = selected?.id === b.ref.id
        const pad = 4
        return (
          <Group key={b.ref.id}>
            {b.rules.map((r) => (
              <Line
                key={r.key}
                points={[r.x1, r.y1, r.x2, r.y2]}
                stroke="#94a3b8"
                strokeWidth={1}
                listening={false}
              />
            ))}
            {b.runs.map((r) => (
              <Text
                key={r.key}
                x={r.x}
                y={r.y}
                width={r.width}
                text={r.text}
                fontSize={r.style.fontSize}
                fontFamily={FLOW_FONT}
                fontStyle={r.style.bold ? 'bold' : 'normal'}
                fill={r.text === '（請輸入題目）' ? '#94a3b8' : r.style.fill}
                lineHeight={1.5}
                wrap={FLOW_WRAP}
                listening={false}
              />
            ))}
            <Rect
              name={isSel ? EDITOR_ONLY_NAME : undefined}
              x={b.box.x - pad}
              y={b.box.y - pad}
              width={b.box.w + pad * 2}
              height={b.box.h + pad * 2}
              cornerRadius={4}
              fill="rgba(0,0,0,0.001)"
              stroke={isSel ? '#4f46e5' : undefined}
              strokeWidth={isSel ? 1.5 : 0}
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
