import { describe, expect, it } from 'vitest'

import { documentBaseName, documentSignature, serializeDocument, toLoadAction } from './documentIO'
import { initialEditorState } from './reducer'

describe('documentSignature', () => {
  it('內容相同時簽章相同，內容不同時不同', () => {
    expect(documentSignature({ a: 1 })).toBe(documentSignature({ a: 1 }))
    expect(documentSignature({ a: 1 })).not.toBe(documentSignature({ a: 2 }))
  })

  it('長 data URL 只比長度與開頭', () => {
    const img = (tail: string) => `data:image/png;base64,${'A'.repeat(200)}${tail}`
    expect(documentSignature({ src: img('x') })).toBe(documentSignature({ src: img('y') }))
    expect(documentSignature({ src: img('x') })).not.toBe(documentSignature({ src: img('xy') }))
  })
})

describe('toLoadAction', () => {
  it('存檔可以讀回成載入動作', () => {
    const doc = serializeDocument(initialEditorState())
    const action = toLoadAction(JSON.parse(JSON.stringify(doc)))
    expect(action?.type).toBe('LOAD_DOCUMENT')
  })

  it('格式不符回傳 null', () => {
    expect(toLoadAction(null)).toBeNull()
    expect(toLoadAction('x')).toBeNull()
    expect(toLoadAction({ objects: 'nope' })).toBeNull()
  })
})

describe('documentBaseName', () => {
  it('用學校與試卷名稱組檔名，並去掉不能用的字元', () => {
    const state = initialEditorState()
    const items = state.layout.header.items.map((it) =>
      it.role === 'schoolName' ? { ...it, value: '測試/國小', visible: true } : it,
    )
    const name = documentBaseName({ ...state, layout: { ...state.layout, header: { ...state.layout.header, items } } })
    expect(name.startsWith('測試國小')).toBe(true)
    expect(name).not.toMatch(/[\\/:*?"<>|]/)
  })
})

describe('配分小數', () => {
  it('每格 0.3 分加總不會出現浮點誤差', async () => {
    const { createQuestion, createSection, examTotals, sectionScore } = await import('../types/exam')
    const s = createSection('選擇題')
    s.scoreMode = 'blank'
    s.blankScore = 0.3
    s.questions = Array.from({ length: 21 }, () => ({ ...createQuestion('single_choice', 0.3), blanks: 1 }))
    expect(sectionScore(s)).toBe(6.3)
    expect(examTotals({ numbering: 'continuous', sections: [s, s, s], assets: {}, footer: undefined as never }).score).toBe(18.9)
  })
})
