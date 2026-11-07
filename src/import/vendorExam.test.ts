import { describe, expect, it } from 'vitest'

import { countAnswerBlanks } from '../types/exam'
import type { DocParagraph } from './docxParagraphs'
import { buildVendorExam, choiceIndexes, flattenAnswer, splitChoices, vendorBlankCount } from './vendorExam'

const p = (text: string, numbered = false, image?: string): DocParagraph => ({
  numbered,
  parts: image
    ? [{ kind: 'text', text }, { kind: 'image', image: { target: image } }]
    : [{ kind: 'text', text }],
})

describe('splitChoices', () => {
  it('拆出題目最後的 ①②③④', () => {
    expect(splitChoices('哪一個最大？①一　②二　③三　④四')).toEqual({ stem: '哪一個最大？', choices: ['一', '二', '三', '四'] })
  })

  it('標記重複或不從①開始就不拆', () => {
    expect(splitChoices('(１)①甲②乙 (２)①丙②丁')).toBeNull()
    expect(splitChoices('②乙③丙')).toBeNull()
    expect(splitChoices('只有①一個')).toBeNull()
  })

  it('選項中的圖片標記移回題幹', () => {
    expect(splitChoices('看圖回答［圖］①甲［圖］　②乙')).toEqual({ stem: '看圖回答［圖］［圖］', choices: ['甲', '乙'] })
  })
})

describe('choiceIndexes', () => {
  it('認得圈號與英文字母', () => {
    expect(choiceIndexes('②', 4)).toEqual([1])
    expect(choiceIndexes('①③', 4)).toEqual([0, 2])
    expect(choiceIndexes('(C)', 4)).toEqual([2])
    expect(choiceIndexes('看不懂', 4)).toEqual([])
  })
})

describe('flattenAnswer', () => {
  it('分小題的答案攤平成每格一項', () => {
    expect(flattenAnswer('(１)甲，乙；(２)高', 3)).toBe('甲，乙，高')
    expect(flattenAnswer('(１)①╳；②ˇ(２)①ˇ', 3)).toBe('╳，ˇ，ˇ')
  })

  it('數量對不上時保留原文', () => {
    expect(flattenAnswer('(２)ˇ；(３)ˇ', 4)).toBeNull()
    expect(flattenAnswer('甲', 1)).toBeNull()
  })
})

describe('vendorBlankCount', () => {
  it('說明句裡的（　）不算作答格', () => {
    expect(vendorBlankCount('請在（　）裡打ˇ：\n(　　)(１)甲\n(　　)(２)乙', '', countAnswerBlanks)).toBe(2)
    expect(vendorBlankCount('將答案填在＿＿裡：\n答：＿＿＿', '', countAnswerBlanks)).toBe(1)
  })

  it('題幹沒有空格時，看答案的項數與最大編號', () => {
    expect(vendorBlankCount('請在□中打ˇ：［圖］', '(１)ˇ；(２)ˇ；(４)ˇ', countAnswerBlanks)).toBe(4)
    expect(vendorBlankCount('請連起來：［圖］', 'ㄅ→①；ㄆ→②；ㄇ→③', countAnswerBlanks)).toBe(3)
  })
})

describe('buildVendorExam', () => {
  const questionDoc = [
    p('　　 自然測驗 '),
    p('一、選擇題：每格 0.3 分、共 0.6 分'),
    p('水的三態是？①固液氣　②只有固態', true),
    p('看圖：', true, 'media/image1.emf'),
    p('二、填充題：每題 2 分'),
    p('作答說明'),
    p('水在＿＿＿℃結冰。', true),
  ]
  const answerDoc = [
    p('一、選擇題：每格 0.3 分、共 0.6 分'),
    p('水的三態是？①固液氣　②只有固態', true),
    p('答案：①'),
    p('解析：水有三態。'),
    p('看圖：', true),
    p('答案：(１)甲；(２)乙'),
    p('二、填充題：每題 2 分'),
    p('水在＿＿＿℃結冰。', true),
    p('答案：0'),
  ]

  it('讀出標題、大題、配分與小題', () => {
    const r = buildVendorExam(questionDoc)
    expect(r.title).toBe('自然測驗')
    expect(r.sections.map((s) => s.title)).toEqual(['選擇題', '填充題'])
    expect(r.sections[0]).toMatchObject({ blankScore: 0.3, total: 0.6, eachScore: null })
    expect(r.sections[1]).toMatchObject({ eachScore: 2, instruction: '作答說明' })
    expect(r.sections[0].questions[0].choices).toEqual(['固液氣', '只有固態'])
    expect(r.sections[0].questions[1]).toMatchObject({ stem: '看圖：［圖］', images: [{ target: 'media/image1.emf' }] })
  })

  it('從解析卷帶入答案與解析', () => {
    const r = buildVendorExam(questionDoc, answerDoc)
    const [first, second] = r.sections[0].questions
    expect(first).toMatchObject({ answer: '①', explanation: '水有三態。' })
    expect(second.answer).toBe('(１)甲；(２)乙')
    expect(r.sections[1].questions[0].answer).toBe('0')
    expect(r.warnings).toEqual([])
  })

  it('沒有自動編號時改認「1.」開頭', () => {
    const r = buildVendorExam([p('一、問答'), p('1. 為什麼？'), p('2、怎麼做？')])
    expect(r.sections[0].questions.map((q) => q.stem)).toEqual(['為什麼？', '怎麼做？'])
  })

  it('找不到題目時提醒', () => {
    expect(buildVendorExam([p('只有一段文字')]).warnings[0]).toContain('沒有找到題目')
  })
})
