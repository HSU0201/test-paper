import { beforeAll, describe, expect, it } from 'vitest'

import { ensureZhuyin } from './hanToZhuyin'
import {
  convertAllToZhuyin,
  decoKey,
  editZhuyin,
  fontStyleFor,
  hasRubyMarkup,
  hasZhuyinMarkup,
  paintText,
  plainText,
  revertAllZhuyin,
  setNthReading,
  textDecorationFor,
} from './richText'

beforeAll(() => ensureZhuyin())

describe('樣式小工具', () => {
  it('decoKey 依固定順序組出代號', () => {
    expect(decoKey({ strike: true, bold: true })).toBe('bs')
    expect(decoKey()).toBe('')
  })

  it('fontStyleFor 合併基本粗體與局部樣式', () => {
    expect(fontStyleFor(true, 'i')).toBe('italic bold')
    expect(fontStyleFor(false, 'b')).toBe('bold')
    expect(fontStyleFor(false, '')).toBe('normal')
  })

  it('textDecorationFor 轉成 CSS 文字裝飾', () => {
    expect(textDecorationFor('us')).toBe('underline line-through')
    expect(textDecorationFor('b')).toBe('')
  })
})

describe('標記解析', () => {
  it('plainText 去掉顏色與樣式標記', () => {
    expect(plainText('{{#ff0000}}紅{{/}}字{{*b}}粗{{/*}}')).toBe('紅字粗')
  })

  it('paintText 每個字帶上顏色', () => {
    const r = paintText('{{#ff0000}}紅{{/}}黑')
    expect(r.text).toBe('紅黑')
    expect(r.colors?.[0]?.toLowerCase()).toContain('ff0000')
  })
})

describe('換成注音', () => {
  it('整段換成注音後可以換回原文', () => {
    const src = '我們去玩'
    const zy = convertAllToZhuyin(src)
    expect(hasZhuyinMarkup(zy)).toBe(true)
    expect(revertAllZhuyin(zy)).toBe(src)
  })

  it('只換選取範圍內的國字', () => {
    const zy = editZhuyin('花朵美麗', 0, 2, 'to-zhuyin')
    expect(zy).toContain('{{z:花|ㄏㄨㄚ}}')
    expect(zy).toContain('{{z:朵|')
    expect(zy.endsWith('美麗')).toBe(true)
  })

  it('沒有國字時原樣回傳', () => {
    expect(convertAllToZhuyin('abc 123')).toBe('abc 123')
    expect(hasRubyMarkup('abc')).toBe(false)
  })
})

describe('setNthReading', () => {
  it('改第 n 個注音的讀音，其他不動', () => {
    const src = '{{z:銀|ㄧㄣˊ}}{{z:行|ㄒㄧㄥˊ}}和{{y:行|ㄒㄧㄥˊ}}'
    expect(setNthReading(src, 1, 'ㄏㄤˊ')).toBe('{{z:銀|ㄧㄣˊ}}{{z:行|ㄏㄤˊ}}和{{y:行|ㄒㄧㄥˊ}}')
    expect(setNthReading(src, 2, 'ㄏㄤˊ')).toBe('{{z:銀|ㄧㄣˊ}}{{z:行|ㄒㄧㄥˊ}}和{{y:行|ㄏㄤˊ}}')
    expect(setNthReading(src, 5, 'ㄏㄤˊ')).toBe(src)
  })
})
