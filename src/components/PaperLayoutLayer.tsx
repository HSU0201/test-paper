import { Group, Line, Rect, Text } from 'react-konva'
import type { LayoutGeometry } from '../types/layout'

export const EDITOR_ONLY_NAME = 'editor-only'

const LAYOUT_FONT = '"Microsoft JhengHei", "PingFang TC", sans-serif'

type PaperLayoutLayerProps = {
  geometry: LayoutGeometry
  showGuides: boolean
}

/** 版型骨架：頁首、欄標題、分隔線（不可拖曳，內容由左側「版型」面板編輯） */
export function PaperLayoutLayer({ geometry, showGuides }: PaperLayoutLayerProps) {
  const { content, texts, rules, columns } = geometry
  return (
    <Group listening={false}>
      {showGuides ? (
        <Group name={EDITOR_ONLY_NAME}>
          <Rect
            x={content.x}
            y={content.y}
            width={content.w}
            height={content.h}
            stroke="#c7d2fe"
            strokeWidth={1}
            dash={[6, 4]}
          />
          {columns.map((c, i) => (
            <Rect
              key={`col-guide-${i}`}
              x={c.x}
              y={c.y}
              width={c.w}
              height={c.h}
              fill="rgba(99,102,241,0.035)"
            />
          ))}
        </Group>
      ) : null}
      {rules.map((r) => (
        <Line key={r.key} points={[r.x1, r.y1, r.x2, r.y2]} stroke="#334155" strokeWidth={1} />
      ))}
      {texts.map((t) => (
        <Text
          key={t.key}
          x={t.x}
          y={t.y}
          width={t.width}
          text={t.text}
          fontSize={t.fontSize}
          fontFamily={LAYOUT_FONT}
          fontStyle={t.bold ? 'bold' : 'normal'}
          fill={t.fill}
          align={t.align}
          wrap="none"
          ellipsis
        />
      ))}
    </Group>
  )
}
