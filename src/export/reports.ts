/** 答案表與雙向細目表的版面內容，交給 docPdf 畫成 PDF */
import { crossTable, percent, questionRows } from '../editor/blueprint'
import { plainText } from '../editor/richText'
import type { EditorState } from '../types/document'
import { sectionHeading } from '../types/exam'
import type { DocBlock } from './docPdf'

function examTitleOf(state: EditorState): string {
  return plainText(state.layout.header.items.find((it) => it.role === 'examTitle')?.value ?? '').trim()
}

export function answerBlocks(state: EditorState): DocBlock[] {
  const rows = questionRows(state.exam)
  const blocks: DocBlock[] = [{ kind: 'title', text: `${examTitleOf(state) || '試卷'}　答案` }]
  state.exam.sections.forEach((s, si) => {
    const list = rows.filter((r) => r.sectionIndex === si)
    if (!list.length) return
    blocks.push({ kind: 'heading', text: sectionHeading(s, si) })
    blocks.push({ kind: 'answers', cells: list.map((r) => ({ num: String(r.num), answer: r.answer })) })
  })
  return blocks
}

export function blueprintBlocks(state: EditorState): DocBlock[] {
  const rows = questionRows(state.exam)
  const table = crossTable(rows, 'unit', 'skill')
  const levels = crossTable(rows, 'level', 'level')
  const cellText = (count: number, points: number) => (count ? `${count} 題／${points} 分` : '')
  return [
    { kind: 'title', text: `${examTitleOf(state) || '試卷'}　雙向細目表` },
    { kind: 'text', text: `共 ${table.total.count} 題，${table.total.points} 分。` },
    { kind: 'heading', text: '一、單元 × 能力' },
    {
      kind: 'table',
      columns: [
        { label: '單元／目標', width: 2.2 },
        ...table.cols.map((c) => ({ label: c, width: 1.4, align: 'center' as const })),
        { label: '合計', width: 1.4, align: 'center' as const },
        { label: '比例', width: 1, align: 'center' as const },
      ],
      rows: [
        ...table.rows.map((r) => {
          const t = table.rowTotal(r)
          return [
            r,
            ...table.cols.map((c) => {
              const x = table.cell(r, c)
              return cellText(x.count, x.points)
            }),
            cellText(t.count, t.points),
            percent(t.points, table.total.points),
          ]
        }),
        [
          '合計',
          ...table.cols.map((c) => {
            const x = table.colTotal(c)
            return cellText(x.count, x.points)
          }),
          cellText(table.total.count, table.total.points),
          '100%',
        ],
      ],
      boldLast: true,
    },
    { kind: 'heading', text: '二、難易度' },
    {
      kind: 'table',
      columns: [
        { label: '難易度', width: 1 },
        { label: '題數', width: 1, align: 'center' },
        { label: '配分', width: 1, align: 'center' },
        { label: '比例', width: 1, align: 'center' },
      ],
      rows: levels.rows.map((lv) => {
        const t = levels.rowTotal(lv)
        return [lv, String(t.count), String(t.points), percent(t.points, levels.total.points)]
      }),
    },
    { kind: 'heading', text: '三、各題明細' },
    {
      kind: 'table',
      columns: [
        { label: '題號', width: 0.7, align: 'center' },
        { label: '大題', width: 2 },
        { label: '題型', width: 1, align: 'center' },
        { label: '配分', width: 0.7, align: 'center' },
        { label: '單元', width: 1.5 },
        { label: '能力', width: 1, align: 'center' },
        { label: '難易', width: 0.7, align: 'center' },
      ],
      rows: rows.map((r) => [String(r.num), r.section, r.type, String(r.points), r.unit, r.skill, r.level]),
    },
  ]
}

