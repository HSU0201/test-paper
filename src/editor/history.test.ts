import { describe, expect, it } from 'vitest'

import { historyReducer, initialHistory } from './history'

const firstSectionId = (h: ReturnType<typeof initialHistory>) => h.present.exam.sections[0].id

describe('historyReducer', () => {
  it('編輯可以復原與重做', () => {
    const h0 = initialHistory()
    const id = firstSectionId(h0)
    const h1 = historyReducer(h0, { kind: 'do', action: { type: 'UPDATE_SECTION', id, patch: { title: 'A' } }, at: 0 })
    expect(h1.present.exam.sections[0].title).toBe('A')
    expect(h1.past).toHaveLength(1)

    const undone = historyReducer(h1, { kind: 'undo' })
    expect(undone.present).toBe(h0.present)
    const redone = historyReducer(undone, { kind: 'redo' })
    expect(redone.present.exam.sections[0].title).toBe('A')
  })

  it('同一欄位連續輸入合併成一步', () => {
    const h0 = initialHistory()
    const id = firstSectionId(h0)
    const typed = ['一', '一二', '一二三'].reduce(
      (h, title, i) => historyReducer(h, { kind: 'do', action: { type: 'UPDATE_SECTION', id, patch: { title } }, at: i * 200 }),
      h0,
    )
    expect(typed.past).toHaveLength(1)
    expect(historyReducer(typed, { kind: 'undo' }).present).toBe(h0.present)
  })

  it('間隔超過合併時間就分成兩步', () => {
    const h0 = initialHistory()
    const id = firstSectionId(h0)
    const a = historyReducer(h0, { kind: 'do', action: { type: 'UPDATE_SECTION', id, patch: { title: 'A' } }, at: 0 })
    const b = historyReducer(a, { kind: 'do', action: { type: 'UPDATE_SECTION', id, patch: { title: 'AB' } }, at: 5000 })
    expect(b.past).toHaveLength(2)
  })

  it('選取不進復原紀錄', () => {
    const h0 = initialHistory()
    const h1 = historyReducer(h0, { kind: 'do', action: { type: 'SET_ACTIVE_PAGE', page: 1 }, at: 0 })
    expect(h1.past).toHaveLength(0)
  })

  it('沒有東西可復原時不變', () => {
    const h0 = initialHistory()
    expect(historyReducer(h0, { kind: 'undo' })).toBe(h0)
    expect(historyReducer(h0, { kind: 'redo' })).toBe(h0)
  })
})
