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

describe('過長的題目', () => {
  it('比一整欄還高時，切開接到下一欄，不超出版面', () => {
    const state = initialEditorState()
    const sectionId = state.exam.sections[0].id
    let slice = { exam: state.exam, selectedBlock: state.selectedBlock }
    slice = examReducer(slice, { type: 'ADD_QUESTION', sectionId })
    const id = slice.selectedBlock?.id ?? ''
    const stem = Array.from({ length: 120 }, (_, i) => `第${i + 1}行的閱讀短文內容。`).join('\n')
    slice = examReducer(slice, { type: 'UPDATE_QUESTION', id, patch: { stem } })
    const r = layout({ ...state, exam: slice.exam })
    const pieces = r.blocks.filter((b) => b.ref.id === id)
    expect(pieces.length).toBeGreaterThan(1)
    expect(r.warnings.some((w) => w.type === 'oversize' && w.ref.id === id)).toBe(false)
    for (const b of pieces) {
      const frame = computePageGeometry(state.layout, state.pageWidth, state.pageHeight, b.page).frames[b.frame]
      expect(b.box.y + b.box.h).toBeLessThanOrEqual(frame.y + frame.h + 0.5)
    }
    // 每一行都還在，沒有因為切開而遺失
    const lines = pieces.flatMap((b) => b.runs.map((run) => run.text)).join('\n')
    expect(lines).toContain('第1行')
    expect(lines).toContain('第120行')
  })
})

describe('子題號', () => {
  it('子題號靠左，內容懸掛縮排，換行也對齊在號碼後面', () => {
    const state = initialEditorState()
    expect(state.pageWidth > state.pageHeight).toBe(false)
    const sectionId = state.exam.sections[0].id
    let slice = { exam: state.exam, selectedBlock: state.selectedBlock }
    slice = examReducer(slice, { type: 'ADD_QUESTION', sectionId })
    const id = slice.selectedBlock?.id ?? ''
    const long = '很長的子題內容'.repeat(20)
    const stem = `讀完回答：\n{{n}}${long}\n{{n}}第二題`
    slice = examReducer(slice, { type: 'UPDATE_QUESTION', id, patch: { stem } })
    const runs = layout({ ...state, exam: slice.exam }).blocks.filter((b) => b.ref.id === id).flatMap((b) => b.runs)
    const labels = runs.filter((r) => r.key.startsWith('sub-'))
    expect(labels.map((r) => r.text)).toEqual(['①', '②'])
    const body = runs.find((r) => r.key === 'stem')!
    const first = runs.find((r) => r.text.startsWith('很長'))!
    const second = runs.find((r) => r.text === '第二題')!
    expect(labels[0].x).toBe(body.x)
    expect(first.x).toBeGreaterThan(labels[0].x)
    expect(second.x).toBe(first.x)
    expect(first.width).toBeLessThan(body.width)
    expect(runs.some((r) => r.text.includes('{{n}}'))).toBe(false)
  })
})

describe('小題配分', () => {
  /** 用測試的等寬量字，模擬 Konva 逐字換行後的每一行 */
  function wrapByChar(text: string, width: number, charW: number): string[] {
    const perLine = Math.max(1, Math.floor(width / charW))
    return text.split('\n').flatMap((line) => {
      const chars = [...line]
      if (!chars.length) return ['']
      const out: string[] = []
      for (let i = 0; i < chars.length; i += perLine) out.push(chars.slice(i, i + perLine).join(''))
      return out
    })
  }

  it('同一列兩題、放不下時，配分整個換行，不拆成「（2」與「分）」', () => {
    const state = initialEditorState()
    const sectionId = state.exam.sections[0].id
    let slice = { exam: state.exam, selectedBlock: state.selectedBlock }
    slice = examReducer(slice, { type: 'UPDATE_SECTION', id: sectionId, patch: { rowSize: 2, scoreMode: 'each', showQuestionScore: true } })
    const stems = ['2 x 8 = （　　）', '2 x 4 = （　　）', '3 x 4 = （　　）', '6 x 6 = （　　）', '1 公尺 = （　　）公分']
    const ids: string[] = []
    stems.forEach((stem, i) => {
      slice = examReducer(slice, { type: 'ADD_QUESTION', sectionId })
      const id = slice.selectedBlock?.id ?? ''
      ids.push(id)
      slice = examReducer(slice, { type: 'UPDATE_QUESTION', id, patch: { stem, score: i === 0 ? 3 : 2 } })
    })
    const r = layout({ ...state, exam: slice.exam })
    let checked = 0
    for (const id of ids) {
      for (const b of r.blocks.filter((x) => x.ref.id === id)) {
        for (const run of b.runs.filter((x) => x.key === 'stem')) {
          const mark = run.text.match(/（\d+ 分）/)?.[0]
          if (!mark) continue
          checked += 1
          const lines = wrapByChar(run.text, run.width, run.style.fontSize)
          expect(lines.some((line) => line.includes(mark))).toBe(true)
        }
      }
    }
    expect(checked).toBeGreaterThan(0)
  })
})
