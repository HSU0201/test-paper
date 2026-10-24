import { useMemo } from 'react'
import { Ellipse, Group, Rect, Text } from 'react-konva'

import type { PlacedBlock } from '../editor/flowLayout'
import { FLOW_WRAP } from '../editor/konvaMeasure'
import { ANSWER_INK, answerMarks } from '../export/answerMarks'
import { ANSWER_KEY_NAME } from '../export/pdfFromStage'
import type { ExamContent } from '../types/exam'

const PAD = 4

/** 平常隱藏。匯出答案卷時才顯示，不出現在編輯畫面與空白試卷。 */
export function AnswerKeyLayer({
  exam,
  blocks,
  page,
  fontFamily,
}: {
  exam: ExamContent
  blocks: PlacedBlock[]
  page: number
  fontFamily: string
}) {
  const marks = useMemo(() => answerMarks(exam, blocks, page, fontFamily), [exam, blocks, page, fontFamily])
  if (!marks.length) return null
  return (
    <Group name={ANSWER_KEY_NAME} visible={false} listening={false}>
      {marks.map((mark, index) => {
        if (mark.kind === 'ring') {
          return (
            <Group key={`ring-${index}`} listening={false}>
              <Ellipse
                x={mark.x}
                y={mark.y}
                radiusX={mark.rx}
                radiusY={mark.ry}
                stroke="#ffffff"
                strokeWidth={4}
                listening={false}
              />
              <Ellipse
                x={mark.x}
                y={mark.y}
                radiusX={mark.rx}
                radiusY={mark.ry}
                stroke={ANSWER_INK}
                strokeWidth={1.75}
                listening={false}
              />
            </Group>
          )
        }
        const inset = mark.plate ? PAD : 0
        const textW = Math.max(mark.fontSize, mark.w - inset * 2)
        return (
          <Group key={`text-${index}`} listening={false}>
            {mark.plate || mark.mask ? (
              <Rect
                x={mark.x}
                y={mark.y}
                width={Math.max(mark.w, textW + inset * 2)}
                height={mark.h}
                fill="#ffffff"
                stroke={mark.plate ? ANSWER_INK : undefined}
                strokeWidth={mark.plate ? 1 : 0}
                cornerRadius={mark.plate ? 3 : 0}
                listening={false}
              />
            ) : null}
            <Text
              x={mark.x + inset}
              y={mark.y + (mark.plate ? 2 : 0)}
              width={textW}
              text={mark.text}
              fontSize={mark.fontSize}
              fontFamily={fontFamily}
              fill={ANSWER_INK}
              align={mark.align ?? 'left'}
              lineHeight={mark.lineHeight}
              wrap={mark.vertical ? 'none' : FLOW_WRAP}
              listening={false}
            />
          </Group>
        )
      })}
    </Group>
  )
}
