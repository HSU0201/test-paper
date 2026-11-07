// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import { readParagraphs, readRelationships } from './docxParagraphs'

const NS =
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
  'xmlns:v="urn:schemas-microsoft-com:vml" ' +
  'xmlns:o="urn:schemas-microsoft-com:office:office"'

const doc = (body: string) => `<?xml version="1.0"?><w:document ${NS}><w:body>${body}</w:body></w:document>`
const run = (text: string, underline = false) =>
  `<w:r>${underline ? '<w:rPr><w:u w:val="single"/></w:rPr>' : ''}<w:t xml:space="preserve">${text}</w:t></w:r>`
const numbered = '<w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>'

const rels = readRelationships(
  '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId3" Type="image" Target="media/image1.emf"/>' +
    '<Relationship Id="rId9" Type="hyperlink" Target="https://example.com" TargetMode="External"/>' +
    '</Relationships>',
)

const text = (xml: string) =>
  readParagraphs(doc(xml), rels).paragraphs.map((p) => p.parts.map((x) => (x.kind === 'text' ? x.text : '[IMG]')).join(''))

describe('readRelationships', () => {
  it('只留內部檔案', () => {
    expect([...rels.entries()]).toEqual([['rId3', 'media/image1.emf']])
  })
})

describe('readParagraphs', () => {
  it('分辨自動編號，換行變成 \\n', () => {
    const { paragraphs } = readParagraphs(
      doc(`<w:p>${run('一、選擇題')}</w:p><w:p>${numbered}${run('第一行')}<w:r><w:br/></w:r>${run('第二行')}</w:p>`),
      rels,
    )
    expect(paragraphs.map((p) => p.numbered)).toEqual([false, true])
    expect(paragraphs[1].parts).toEqual([{ kind: 'text', text: '第一行\n第二行' }])
  })

  it('只有空白的底線變成作答線，括號裡的空白照留', () => {
    expect(text(`<w:p>${run('答：')}${run('　　　', true)}${run('。')}</w:p>`)).toEqual(['答：＿＿＿。'])
    expect(text(`<w:p>${run('(')}${run('　　', true)}${run(')')}</w:p>`)).toEqual(['(　　)'])
  })

  it('有字的底線保留成底線樣式', () => {
    expect(text(`<w:p>${run('住在')}${run('臺灣', true)}</w:p>`)).toEqual(['住在{{*u}}臺灣{{/*}}'])
  })

  it('讀出 VML 圖片與尺寸，略過欄位指令', () => {
    const { paragraphs } = readParagraphs(
      doc(
        `<w:p>${run('看圖')}<w:r><w:object><v:shape style="width:144pt;height:1in"><v:imagedata r:id="rId3"/></v:shape></w:object></w:r>` +
          `<w:r><w:instrText> HYPERLINK "x"</w:instrText></w:r>${run('完')}</w:p>`,
      ),
      rels,
    )
    expect(paragraphs[0].parts).toEqual([
      { kind: 'text', text: '看圖' },
      { kind: 'image', image: { target: 'media/image1.emf', widthPt: 144, heightPt: 72 } },
      { kind: 'text', text: '完' },
    ])
  })

  it('由分節設定算出一欄的寬度', () => {
    const { layout } = readParagraphs(
      doc(
        `<w:p>${run('x')}</w:p><w:sectPr><w:pgSz w:w="12000"/><w:pgMar w:left="1000" w:right="1000"/><w:cols w:num="2" w:space="1000"/></w:sectPr>`,
      ),
      rels,
    )
    expect(layout.columnWidthPt).toBe(225)
  })
})
