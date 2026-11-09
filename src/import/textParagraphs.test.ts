import { describe, expect, it } from 'vitest'

import { cleanLine, letterChoicesToCircled, linesToParagraphs } from './textParagraphs'
import { buildVendorExam } from './vendorExam'

const texts = (lines: string[]) => linesToParagraphs(lines).map((p) => (p.parts[0].kind === 'text' ? p.parts[0].text : ''))

describe('cleanLine', () => {
  it('去掉 OCR 在中文字之間插入的空白', () => {
    expect(cleanLine('小 明 很 高 興')).toBe('小明很高興')
  })
  it('保留英文單字之間的空白', () => {
    expect(cleanLine('I am a student')).toBe('I am a student')
  })
  it('全形數字轉半形，並把「1 .」併成「1.」', () => {
    expect(cleanLine('１２ . 下列何者正確')).toBe('12. 下列何者正確')
  })
  it('PDF 裡的康熙部首（⼀、⼩）轉回一般的字，大題才認得出來', () => {
    expect(cleanLine('⼀、選擇題')).toBe('一、選擇題')
    expect(cleanLine('⼩明')).toBe('小明')
  })
  it('OCR 認成半形的中文標點改回全形，作答括號裡的空白留著', () => {
    expect(cleanLine('春天來了 , 公園裡的花兒都 ( ) 了。')).toBe('春天來了，公園裡的花兒都（ ）了。')
    expect(cleanLine('「 守株待兔 」的意思最接近哪一個 ?')).toBe('「守株待兔」的意思最接近哪一個？')
  })
  it('英文句子裡的半形標點不動', () => {
    expect(cleanLine('Hello, how are you?')).toBe('Hello, how are you?')
  })
  it('大題編號與頓號之間的空白也拿掉', () => {
    expect(cleanLine('一 、選擇題')).toBe('一、選擇題')
  })
})

describe('letterChoicesToCircled', () => {
  it('(A)(B)(C)(D) 改成 ①②③④', () => {
    expect(letterChoicesToCircled('下列何者正確？(A)甲 (B)乙 (C)丙 (D)丁')).toBe('下列何者正確？①甲 ②乙 ③丙 ④丁')
  })
  it('全形括號與全形字母也認得', () => {
    expect(letterChoicesToCircled('何者？（Ａ）甲（Ｂ）乙')).toBe('何者？①甲②乙')
  })
  it('順序不對時不改，避免改到題幹裡的引用', () => {
    expect(letterChoicesToCircled('請參考(B)的說明')).toBe('請參考(B)的說明')
    expect(letterChoicesToCircled('(A)甲 (C)丙')).toBe('(A)甲 (C)丙')
  })
})

describe('linesToParagraphs', () => {
  it('換行的題目接回同一段，題號與大題另起一段', () => {
    expect(
      texts(['一、選擇題：每題 2 分，共 4 分', '1. 小明很高興的回到', '家，心清非常好。', '2. 下列何者正確？', '(A)甲 (B)乙', '(C)丙 (D)丁']),
    ).toEqual(['一、選擇題：每題 2 分，共 4 分', '1. 小明很高興的回到家，心清非常好。', '2. 下列何者正確？ ①甲 ②乙 ③丙 ④丁'])
  })

  it('交給 vendorExam 後能拆出大題、題目、選項與配分', () => {
    const exam = buildVendorExam(
      linesToParagraphs([
        '二年級國語第一次定期評量',
        '一、選擇題：每題 2 分，共 4 分',
        '1. 下列何者正確？',
        '(A)甲 (B)乙 (C)丙 (D)丁',
        '2. 哪一個字寫錯了？(A)晴 (B)請',
        '二、填充題：每格 1 分',
        '3. 春天來了，花兒（ ）開了。',
      ]),
    )
    expect(exam.title).toBe('二年級國語第一次定期評量')
    expect(exam.sections.map((s) => s.title)).toEqual(['選擇題', '填充題'])
    expect(exam.sections[0].eachScore).toBe(2)
    expect(exam.sections[0].questions[0]).toMatchObject({ stem: '下列何者正確？', choices: ['甲', '乙', '丙', '丁'] })
    expect(exam.sections[0].questions[1].choices).toEqual(['晴', '請'])
    expect(exam.sections[1].questions[0].stem).toBe('春天來了，花兒（ ）開了。')
  })

  it('解析卷的答案行另起一段，能對回題目', () => {
    const questions = linesToParagraphs(['一、選擇題', '1. 下列何者正確？(A)甲 (B)乙'])
    const answers = linesToParagraphs(['一、選擇題', '1. 下列何者正確？(A)甲 (B)乙', '答案：(B)'])
    const exam = buildVendorExam(questions, answers)
    expect(exam.sections[0].questions[0].answer).toBe('(B)')
    expect(exam.warnings).toEqual([])
  })
})
