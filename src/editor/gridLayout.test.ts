import { describe, expect, it } from 'vitest'

import { createQuestion, createSection, type ExamContent } from '../types/exam'
import { layoutExam, type MeasureFn } from './flowLayout'
import { buildGridWord, gridCells, gridMetrics } from './gridLayout'
import { initialEditorState } from './reducer'

const body = { fontSize: 16, fill: '#000000' }

describe('gridCells', () => {
  it('依注音標記決定每格要寫什麼，標點不算格', () => {
    expect(gridCells('{{yb:鯉|ㄌㄧˇ}}{{y:魚|ㄩˊ}}，鰓')).toEqual([
      { han: '鯉', reading: 'ㄌㄧˇ', face: 'box' },
      { han: '魚', reading: 'ㄩˊ', face: 'char' },
      { han: '鰓', reading: '', face: 'blank' },
    ])
  })
})

describe('buildGridWord', () => {
  it('留白的字只放在答案圖層', () => {
    const built = buildGridWord('{{yb:夏|ㄒㄧㄚˋ}}{{yn:天|ㄊㄧㄢ}}', '1.', body, false)
    const han = built.runs.filter((r) => r.key.startsWith('han-'))
    const zy = built.runs.filter((r) => r.key.startsWith('zy-'))
    expect(han.map((r) => [r.text, !!r.answer])).toEqual([
      ['夏', true],
      ['天', false],
    ])
    expect(zy.map((r) => [r.text, !!r.answer])).toEqual([
      ['ㄒ\nㄧ\nㄚ', false],
      ['ㄊ\nㄧ\nㄢ', true],
    ])
  })

  it('輕聲寫在注音上方，田字格是虛線', () => {
    const built = buildGridWord('{{y:的|˙ㄉㄜ}}', '2.', body, true)
    expect(built.runs.find((r) => r.key === 'zy-0')?.text).toBe('˙\nㄉ\nㄜ')
    expect(built.runs.some((r) => r.key.startsWith('tone-'))).toBe(false)
    expect(built.rules.filter((r) => r.dash).length).toBe(2)
  })

  it('高度是題號加上每個字一格', () => {
    const g = gridMetrics(16)
    expect(buildGridWord('{{y:去|ㄑㄩˋ}}{{y:年|ㄋㄧㄢˊ}}{{y:夏|ㄒㄧㄚˋ}}', '1.', body, false).height).toBe(g.numH + g.cellH * 3 + 2)
  })
})

describe('注音格排版', () => {
  const measure: MeasureFn = (text, _w, style, lh) => ({ height: Math.max(1, text.split('\n').length) * style.fontSize * lh, naturalWidth: 10 })
  const exam = (): ExamContent => {
    const s = createSection('國字注音', 'fill_blank')
    s.layout = 'grid'
    s.questions = Array.from({ length: 10 }, () => ({ ...createQuestion('fill_blank', 1), stem: '{{yb:日|ㄖˋ}}{{yn:光|ㄍㄨㄤ}}' }))
    return { numbering: 'continuous', sections: [s], assets: {}, footer: undefined as never }
  }
  const styles = { heading: body, instruction: body, body }
  const spacing = initialEditorState().layout.spacing

  it('直書（橫向紙）：語詞由右往左排成一直行一直行', () => {
    const frames = [{ x: 0, y: 0, w: 1000, h: 600 }]
    const r = layoutExam(exam(), () => frames, styles, spacing, measure, true)
    const qs = r.blocks.filter((b) => b.ref.kind === 'question')
    expect(qs).toHaveLength(10)
    for (let i = 1; i < qs.length; i++) expect(qs[i].box.x).toBeLessThan(qs[i - 1].box.x)
    expect(r.warnings.some((w) => w.type === 'oversize')).toBe(false)
  })

  it('橫書（直向紙）：一列放得下幾個就並排幾個', () => {
    const frames = [{ x: 0, y: 0, w: 400, h: 1000 }]
    const r = layoutExam(exam(), () => frames, styles, spacing, measure, false)
    const qs = r.blocks.filter((b) => b.ref.kind === 'question')
    const g = gridMetrics(16)
    const perRow = Math.floor((400 + g.gap) / (g.cellW + g.gap))
    expect(new Set(qs.slice(0, perRow).map((b) => b.box.y)).size).toBe(1)
    expect(qs[perRow].box.y).toBeGreaterThan(qs[0].box.y)
    for (const b of qs) expect(b.box.x + g.cellW).toBeLessThanOrEqual(400)
  })
})
