import { beforeAll, describe, expect, it } from 'vitest'

import { ensureZhuyin, pinyinSyllableToZhuyin, readingsFor, zhuyinReady } from './hanToZhuyin'

describe('pinyinSyllableToZhuyin', () => {
  it('轉出聲母、韻母與聲調', () => {
    expect(pinyinSyllableToZhuyin('hua1')).toBe('ㄏㄨㄚ')
    expect(pinyinSyllableToZhuyin('xiao3')).toBe('ㄒㄧㄠˇ')
    expect(pinyinSyllableToZhuyin('ge0')).toBe('˙ㄍㄜ')
    expect(pinyinSyllableToZhuyin('shi4')).toBe('ㄕˋ')
  })

  it('處理 ü、y/w 開頭與 er', () => {
    expect(pinyinSyllableToZhuyin('nü3')).toBe('ㄋㄩˇ')
    expect(pinyinSyllableToZhuyin('yi4')).toBe('ㄧˋ')
    expect(pinyinSyllableToZhuyin('wan2')).toBe('ㄨㄢˊ')
    expect(pinyinSyllableToZhuyin('er2')).toBe('ㄦˊ')
  })

  it('格式不對時回傳 null', () => {
    expect(pinyinSyllableToZhuyin('abc')).toBeNull()
    expect(pinyinSyllableToZhuyin('')).toBeNull()
  })
})

describe('readingsFor', () => {
  beforeAll(() => ensureZhuyin())

  it('詞庫載入後可同步查讀音', () => {
    expect(zhuyinReady()).toBe(true)
    expect(readingsFor('花朵美麗')).toEqual(['ㄏㄨㄚ', 'ㄉㄨㄛˇ', 'ㄇㄟˇ', 'ㄌㄧˋ'])
  })

  it('台灣常見讀法覆蓋詞庫', () => {
    expect(readingsFor('一個')).toEqual(['ㄧˋ', '˙ㄍㄜ'])
    expect(readingsFor('垃圾')).toEqual(['ㄌㄜˋ', 'ㄙㄜˋ'])
  })

  it('非國字回傳 null', () => {
    expect(readingsFor('a花1')).toEqual([null, 'ㄏㄨㄚ', null])
    expect(readingsFor('')).toEqual([])
  })
})
