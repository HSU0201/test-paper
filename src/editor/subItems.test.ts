import { describe, expect, it } from 'vitest'

import { plainText, SUB_TOKEN } from './richText'
import { adoptTypedSubItems, countSubItems, resolveSubItems, subChunks, subLabel } from './subItems'

const N = SUB_TOKEN

describe('subLabel', () => {
  it('依樣式編號', () => {
    expect(subLabel(1, 'circled')).toBe('①')
    expect(subLabel(20, 'circled')).toBe('⑳')
    expect(subLabel(21, 'circled')).toBe('㉑')
    expect(subLabel(3, 'paren')).toBe('(3)')
    expect(subLabel(2, 'stem')).toBe('乙、')
    expect(subLabel(3, 'bopomofo')).toBe('ㄇ、')
  })
})

describe('子題號標記', () => {
  it('不印出標記本身，也不算進字數', () => {
    expect(plainText(`${N}小明`)).toBe('小明')
  })

  it('依順序換成文字', () => {
    expect(resolveSubItems(`讀完回答：\n${N}誰？\n${N}哪裡？`, 'circled')).toBe('讀完回答：\n①誰？\n②哪裡？')
    expect(countSubItems(`${N}a\n${N}b`)).toBe(2)
  })

  it('切成本文與各子題，沒有子題號的行回到本文', () => {
    const { chunks, next } = subChunks(`讀完回答：\n${N}誰？\n${N}哪裡？\n結尾\n再一行`, 'paren')
    expect(chunks).toEqual([
      { text: '讀完回答：' },
      { label: '(1)', text: '誰？' },
      { label: '(2)', text: '哪裡？' },
      { text: '結尾\n再一行' },
    ])
    expect(next).toBe(3)
  })

  it('被圖片切開的下一段接著編號', () => {
    const { chunks } = subChunks(`${N}第三題`, 'circled', 3)
    expect(chunks).toEqual([{ label: '③', text: '第三題' }])
  })

  it('子題裡的顏色在切行後仍成對', () => {
    const { chunks } = subChunks(`${N}{{#d92d20}}紅\n字{{/}}`, 'circled')
    expect(chunks).toEqual([{ label: '①', text: '{{#d92d20}}紅{{/}}' }, { text: '{{#d92d20}}字{{/}}' }])
  })
})

describe('adoptTypedSubItems', () => {
  it('把自己打的 ①② 換成自動子題號', () => {
    expect(adoptTypedSubItems('回答：\n①誰？\n② 哪裡？')).toEqual({ stem: `回答：\n${N}誰？\n${N}哪裡？`, style: 'circled' })
    expect(adoptTypedSubItems('（1）甲\n(2)乙')).toEqual({ stem: `${N}甲\n${N}乙`, style: 'paren' })
  })

  it('只有一行，或已經是自動子題號時不動', () => {
    expect(adoptTypedSubItems('①只有一個')).toBeNull()
    expect(adoptTypedSubItems(`${N}a\n${N}b`)).toBeNull()
  })
})
