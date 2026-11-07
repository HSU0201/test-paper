import { describe, expect, it } from 'vitest'

import { mergeTextLevelPreset } from '../types/document'
import { computePageGeometry } from '../types/layout'
import { examReducer } from './examReducer'
import { layoutExam, type MeasureFn } from './flowLayout'
import { initialEditorState } from './reducer'

/** 不靠 canvas 的量字：每個字等寬，依寬度換行 */
const measure: MeasureFn = (text, width, style, lineHeight) => {
  const charW = style.fontSize
  const lines = text.split('\n').reduce((n, line) => {
    const w = [...line].length * charW
    return n + Math.max(1, Math.ceil(w / Math.max(charW, width)))
  }, 0)
  const naturalWidth = Math.max(0, ...text.split('\n').map((l) => [...l].length * charW))
  return { height: lines * style.fontSize * lineHeight, naturalWidth }
}

function layout(state = initialEditorState()) {
  const o = state.textLevelOverrides
  const style = (level: Parameters<typeof mergeTextLevelPreset>[0]) => {
    const p = mergeTextLevelPreset(level, o)
    return { fontSize: p.fontSize, fill: '#000000', bold: p.bold }
  }
  return layoutExam(
    state.exam,
    (page) => computePageGeometry(state.layout, state.pageWidth, state.pageHeight, page).frames,
    { heading: style('section_heading'), instruction: style('instruction'), body: style('question_body') },
    state.layout.spacing,
    measure,
    state.pageWidth > state.pageHeight,
  )
}

describe('layoutExam', () => {
  it('範例卷排得出來，每個區塊都在欄位裡', () => {
    const state = initialEditorState()
    const r = layout(state)
    expect(r.pageCount).toBeGreaterThanOrEqual(1)
    expect(r.blocks.length).toBeGreaterThan(0)
    for (const b of r.blocks) {
      expect(b.page).toBeGreaterThanOrEqual(0)
      expect(b.page).toBeLessThan(r.pageCount)
    }
  })

  it('同樣的輸入得到同樣的結果', () => {
    const state = initialEditorState()
    expect(JSON.stringify(layout(state))).toBe(JSON.stringify(layout(state)))
  })

  it('題目越多，頁數不會變少', () => {
    let state = initialEditorState()
    const before = layout(state).pageCount
    const sectionId = state.exam.sections[0].id
    let slice = { exam: state.exam, selectedBlock: state.selectedBlock }
    for (let i = 0; i < 40; i++) slice = examReducer(slice, { type: 'ADD_QUESTION', sectionId })
    state = { ...state, exam: slice.exam }
    const after = layout(state).pageCount
    expect(after).toBeGreaterThanOrEqual(before)
    expect(after).toBeGreaterThan(1)
  })
})
