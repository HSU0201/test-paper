import type { FrameRef, LayoutWarning } from './flowLayout'
import { questionNumbers, sectionHeading, type BlockRef, type ExamContent } from '../types/exam'

function frameName(f: FrameRef, frames: number): string {
  const col = frames === 2 ? (f.frame === 0 ? '第一欄' : '第二欄') : ''
  return `第 ${f.page + 1} 頁${col}`
}

function blockName(exam: ExamContent, ref: BlockRef): string {
  if (ref.kind === 'section') {
    const i = exam.sections.findIndex((s) => s.id === ref.id)
    return i >= 0 ? sectionHeading(exam.sections[i], i) : '大題'
  }
  const n = questionNumbers(exam).get(ref.id)
  return n ? `第 ${n} 題` : '題目'
}

export type WarningView = { key: string; tone: 'info' | 'warn'; text: string; target: BlockRef | null }

export function describeWarnings(warnings: LayoutWarning[], exam: ExamContent, frames: number): WarningView[] {
  return warnings.map((w, i) => {
    switch (w.type) {
      case 'squeezed':
        return {
          key: `sq-${i}`,
          tone: 'info',
          text:
            w.savedPages > 0
              ? `已自動壓縮行距與間距（行高 ${w.lineHeight}），少用 ${w.savedPages} 頁`
              : `已自動壓縮行距與間距（行高 ${w.lineHeight}），避免標題被推到下一欄`,
          target: null,
        }
      case 'headMoved': {
        const ref: BlockRef = { kind: 'section', id: w.sectionId }
        return {
          key: `hm-${i}`,
          tone: 'info',
          text: `${blockName(exam, ref)} 的標題避免單獨留在${frameName(w.from, frames)}底部，已連同題目移到${frameName(w.to, frames)}`,
          target: ref,
        }
      }
      case 'oversize':
        return {
          key: `os-${i}`,
          tone: 'warn',
          text: `${blockName(exam, w.ref)} 比一整欄還高，會超出第 ${w.page + 1} 頁；請縮小圖片或拆成兩題`,
          target: w.ref,
        }
    }
  })
}
