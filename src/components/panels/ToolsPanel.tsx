import { useCallback, useEffect, useMemo, useState } from 'react'

import { blueprintCsv, crossTable, hasBlueprintData, percent, questionRows } from '../../editor/blueprint'
import { documentBaseName, downloadJson, serializeDocument, toLoadAction } from '../../editor/documentIO'
import { useEditor } from '../../editor/EditorContext'
import { findQuestion } from '../../editor/examReducer'
import {
  deleteLibraryItem,
  type LibraryItem,
  listLibrary,
  onLibraryChange,
  saveLibraryItem,
} from '../../editor/persist'
import { type PaperTemplate, templateOf } from '../../editor/reducer'
import { plainText } from '../../editor/richText'
import { makeRetakeExam, makeShuffledExam, usedAssets } from '../../editor/variants'
import { type DocBlock, renderDocPages, saveCanvasPdf } from '../../export/docPdf'
import { answerBlocks, blueprintBlocks } from '../../export/reports'
import type { EditorState } from '../../types/document'
import { mergeTextLevelPreset } from '../../types/document'
import { type Asset, type ExamContent, questionNumbers, type Section, sectionHeading } from '../../types/exam'
import { Icon, PanelSection, Segmented, Switch } from '../ui'

type SectionData = { section: Section; assets: Record<string, Asset> }

function formatDate(at: number): string {
  const d = new Date(at)
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}

/** 讀出題庫某一類的清單，題庫有變動時自動更新 */
function useLibrary<T>(kind: 'section' | 'template') {
  const [items, setItems] = useState<LibraryItem<T>[] | null>(null)
  const reload = useCallback(() => {
    listLibrary<T>(kind).then(setItems, () => setItems([]))
  }, [kind])
  useEffect(() => {
    reload()
    return onLibraryChange(reload)
  }, [reload])
  return items
}

/** 大題右側的「存到題庫」 */
export function SaveToLibraryButton({ section }: { section: Section }) {
  const { state } = useEditor()
  const [done, setDone] = useState(false)
  const index = state.exam.sections.findIndex((s) => s.id === section.id)
  return (
    <button
      type="button"
      className="btn btn--ghost"
      title="之後在左側「工具」的「我的題庫」可以插入到別份試卷"
      onClick={() => {
        const name = window.prompt('題庫裡要叫什麼名字？', plainText(section.title) || '未命名大題')
        if (name == null) return
        const data: SectionData = { section, assets: usedAssets(state.exam.assets, section.questions) }
        saveLibraryItem<SectionData>({
          kind: 'section',
          name: name.trim() || '未命名大題',
          note: `${index >= 0 ? sectionHeading(section, index).split('、')[0] + '、' : ''}${section.questions.length} 題`,
          data,
        }).then(
          () => {
            setDone(true)
            window.setTimeout(() => setDone(false), 2000)
          },
          () => window.alert('存不進題庫。瀏覽器可能關掉了網站資料，請換一個瀏覽器或關掉無痕模式。'),
        )
      }}
    >
      <Icon name="library" />
      {done ? '已存入題庫' : '存到題庫'}
    </button>
  )
}

function LibraryTools() {
  const { state, dispatch } = useEditor()
  const items = useLibrary<SectionData>('section')
  const sel = state.selectedBlock
  const afterId =
    sel?.kind === 'section' ? sel.id : sel?.kind === 'question' ? findQuestion(state.exam, sel.id)?.section.id : undefined
  return (
    <PanelSection
      title="我的題庫"
      collapsible
      storeKey="tools-library"
      description="在大題右側按「存到題庫」，就能在任何一份試卷插入同樣的大題。題庫存在這台電腦的這個瀏覽器裡。"
    >
      {items == null ? <p className="panel-section__desc">讀取中…</p> : null}
      {items?.length === 0 ? <p className="tools-empty">題庫還是空的。先點一個大題，再按右側的「存到題庫」。</p> : null}
      <ul className="tools-list">
        {items?.map((item) => (
          <li key={item.id} className="tools-list__item">
            <div className="tools-list__text">
              <strong>{item.name}</strong>
              <span>
                {item.note}・{formatDate(item.savedAt)}
              </span>
            </div>
            <button
              type="button"
              className="text-btn"
              title={afterId ? '插在目前選取的大題後面' : '接在試卷最後'}
              onClick={() =>
                dispatch({ type: 'INSERT_SECTIONS', sections: [item.data.section], assets: item.data.assets, afterId })
              }
            >
              插入
            </button>
            <button
              type="button"
              className="icon-btn"
              title="從題庫刪除"
              onClick={() => {
                if (window.confirm(`從題庫刪除「${item.name}」？已經插入試卷的題目不受影響。`)) void deleteLibraryItem(item.id)
              }}
            >
              <Icon name="trash" />
            </button>
          </li>
        ))}
      </ul>
    </PanelSection>
  )
}

function TemplateTools() {
  const { state, dispatch } = useEditor()
  const items = useLibrary<PaperTemplate>('template')
  return (
    <PanelSection
      title="頁首範本"
      collapsible
      storeKey="tools-template"
      description="把學校名稱、班級座號欄、家長簽名欄的位置，連同紙張、分欄和字級存起來。新試卷套用後只要改試卷名稱。"
      actions={
        <button
          type="button"
          className="text-btn"
          onClick={() => {
            const school = state.layout.header.items.find((it) => it.role === 'schoolName')?.value ?? ''
            const name = window.prompt('範本名稱', plainText(school) || '我的範本')
            if (name == null) return
            void saveLibraryItem<PaperTemplate>({
              kind: 'template',
              name: name.trim() || '我的範本',
              note: `${state.layout.columns.count} 欄・${state.pageWidth > state.pageHeight ? '橫向' : '直向'}`,
              data: templateOf(state),
            })
          }}
        >
          ＋ 存成範本
        </button>
      }
    >
      {items?.length === 0 ? <p className="tools-empty">還沒有範本。頁首排好後按「存成範本」。</p> : null}
      <ul className="tools-list">
        {items?.map((item) => (
          <li key={item.id} className="tools-list__item">
            <div className="tools-list__text">
              <strong>{item.name}</strong>
              <span>
                {item.note}・{formatDate(item.savedAt)}
              </span>
            </div>
            <button
              type="button"
              className="text-btn"
              onClick={() => {
                if (window.confirm(`套用「${item.name}」？頁首、紙張、分欄和字級會換掉，題目與試卷名稱不變。可以按復原回來。`))
                  dispatch({ type: 'APPLY_TEMPLATE', template: item.data })
              }}
            >
              套用
            </button>
            <button
              type="button"
              className="icon-btn"
              title="刪除範本"
              onClick={() => {
                if (window.confirm(`刪除範本「${item.name}」？`)) void deleteLibraryItem(item.id)
              }}
            >
              <Icon name="trash" />
            </button>
          </li>
        ))}
      </ul>
    </PanelSection>
  )
}

function ReportTools() {
  const { state } = useEditor()
  const [busy, setBusy] = useState<string | null>(null)
  const rows = useMemo(() => questionRows(state.exam), [state.exam])
  const table = useMemo(() => crossTable(rows, 'unit', 'skill'), [rows])
  const filled = hasBlueprintData(rows)
  const missing = rows.filter((r) => !r.answer).length
  const base = documentBaseName(state)
  const exportDoc = (blocks: DocBlock[], name: string, label: string) => {
    setBusy(label)
    // 讓按鈕先顯示「產生中」
    window.setTimeout(() => {
      const pages = renderDocPages(blocks, state.pageWidth, state.pageHeight, state.paperFontFamily, base)
      saveCanvasPdf(pages, state.pageWidth, state.pageHeight, name)
        .catch(() => window.alert('匯出失敗，請重新整理頁面後再試一次。'))
        .finally(() => setBusy(null))
    }, 30)
  }
  return (
    <PanelSection
      title="答案表與雙向細目表"
      collapsible
      storeKey="tools-report"
      defaultOpen
      description="答案表把所有題號和答案列在一頁，改考卷時對照用。細目表依每題填的單元、能力、難易度統計。"
    >
      <div className="tools-actions">
        <button
          type="button"
          className="btn btn--ghost"
          disabled={!rows.length || busy !== null}
          onClick={() => exportDoc(answerBlocks(state), `${base}-答案表.pdf`, 'answers')}
        >
          <Icon name="pdf" />
          {busy === 'answers' ? '產生中…' : '答案表 PDF'}
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          disabled={!rows.length || busy !== null}
          onClick={() => exportDoc(blueprintBlocks(state), `${base}-雙向細目表.pdf`, 'blueprint')}
        >
          <Icon name="table" />
          {busy === 'blueprint' ? '產生中…' : '細目表 PDF'}
        </button>
      </div>
      {missing ? <p className="tools-warn">有 {missing} 題還沒填答案，答案表上會印「—」。</p> : null}
      <button
        type="button"
        className="text-btn"
        disabled={!rows.length}
        onClick={() => {
          const blob = new Blob([blueprintCsv(rows)], { type: 'text/csv;charset=utf-8' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `${base}-雙向細目表.csv`
          a.click()
          window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
        }}
      >
        下載細目表 Excel 檔（CSV），可以再自己改
      </button>
      {filled ? (
        <div className="tools-table-wrap">
          <table className="tools-table">
            <thead>
              <tr>
                <th>單元＼能力</th>
                {table.cols.map((c) => (
                  <th key={c}>{c}</th>
                ))}
                <th>配分</th>
              </tr>
            </thead>
            <tbody>
              {table.rows.map((r) => (
                <tr key={r}>
                  <th>{r}</th>
                  {table.cols.map((c) => {
                    const x = table.cell(r, c)
                    return <td key={c}>{x.count ? `${x.count}題` : ''}</td>
                  })}
                  <td>
                    {table.rowTotal(r).points}（{percent(table.rowTotal(r).points, table.total.points)}）
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="tools-empty">還沒有題目填細目。點一題，在右側最下面的「雙向細目表」填單元、能力和難易度。</p>
      )}
    </PanelSection>
  )
}

/** 換掉試卷名稱後輸出成一份新的試卷檔 */
function variantDoc(state: EditorState, exam: ExamContent, suffix: string) {
  const items = state.layout.header.items.map((it) =>
    it.role === 'examTitle' ? { ...it, value: `${plainText(it.value).trim()}${suffix}` } : it,
  )
  const next: EditorState = { ...state, exam, layout: { ...state.layout, header: { ...state.layout.header, items } } }
  return { doc: serializeDocument(next), name: `${documentBaseName(next)}` }
}

function VariantOutput({ make, label }: { make: () => { doc: ReturnType<typeof serializeDocument>; name: string } | null; label: string }) {
  const { dispatch } = useEditor()
  return (
    <div className="tools-actions">
      <button
        type="button"
        className="btn btn--ghost"
        onClick={() => {
          const out = make()
          if (out) downloadJson(`${out.name}.json`, out.doc)
        }}
      >
        <Icon name="save" />
        下載{label}檔
      </button>
      <button
        type="button"
        className="btn btn--ghost"
        onClick={() => {
          const out = make()
          if (!out) return
          if (!window.confirm(`在編輯器打開${label}？目前這份會換掉，可以按復原回來，也建議先按上方「儲存」留一份。`)) return
          const action = toLoadAction(out.doc)
          if (action) dispatch(action)
        }}
      >
        <Icon name="open" />
        直接打開{label}
      </button>
    </div>
  )
}

function VariantTools() {
  const { state } = useEditor()
  const [shuffleQuestions, setShuffleQuestions] = useState(true)
  const [shuffleChoices, setShuffleChoices] = useState(true)
  const [seed, setSeed] = useState(1)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const nums = questionNumbers(state.exam)
  const toggle = (id: string, on: boolean) =>
    setPicked((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  return (
    <>
      <PanelSection
        title="A／B 卷"
        collapsible
        storeKey="tools-ab"
        description="把每個大題裡的題目順序、選項順序打亂，另存一份 B 卷。選項用代號寫的答案會跟著改；「以上皆是」這類選項留在原位，「承上題」跟著上一題。"
      >
        <div className="ui-row">
          <span className="ui-row__label">打亂題目順序</span>
          <Switch checked={shuffleQuestions} label="打亂題目順序" onChange={setShuffleQuestions} />
        </div>
        <div className="ui-row">
          <span className="ui-row__label">打亂選項與連連看右欄</span>
          <Switch checked={shuffleChoices} label="打亂選項" onChange={setShuffleChoices} />
        </div>
        <div className="ui-row">
          <span className="ui-row__label">第 {seed} 種排法</span>
          <button type="button" className="text-btn" onClick={() => setSeed((n) => n + 1)}>
            換一種
          </button>
        </div>
        <VariantOutput
          label="B 卷"
          make={() =>
            variantDoc(
              state,
              makeShuffledExam(state.exam, `B-${seed}`, { questions: shuffleQuestions, choices: shuffleChoices }),
              '（B卷）',
            )
          }
        />
      </PanelSection>

      <PanelSection
        title="補考卷"
        collapsible
        storeKey="tools-retake"
        description="勾選要留下的題目，另存成一份新的試卷，再改數字或換題目。原卷不受影響。"
        actions={
          <button
            type="button"
            className="text-btn"
            onClick={() =>
              setPicked(
                picked.size ? new Set() : new Set(state.exam.sections.flatMap((s) => s.questions.map((q) => q.id))),
              )
            }
          >
            {picked.size ? '全部取消' : '全選'}
          </button>
        }
      >
        <div className="retake-list">
          {state.exam.sections.map((s, si) => (
            <div key={s.id} className="retake-list__section">
              <label className="retake-list__head">
                <input
                  type="checkbox"
                  checked={s.questions.length > 0 && s.questions.every((q) => picked.has(q.id))}
                  onChange={(e) => s.questions.forEach((q) => toggle(q.id, e.target.checked))}
                />
                {sectionHeading(s, si)}
              </label>
              {s.questions.map((q) => (
                <label key={q.id} className="retake-list__item">
                  <input type="checkbox" checked={picked.has(q.id)} onChange={(e) => toggle(q.id, e.target.checked)} />
                  <span>
                    {nums.get(q.id)}. {plainText(q.stem).replace(/\s+/g, ' ').slice(0, 24) || '（空白題目）'}
                  </span>
                </label>
              ))}
            </div>
          ))}
        </div>
        <p className="panel-section__desc">已選 {picked.size} 題。</p>
        <VariantOutput
          label="補考卷"
          make={() => {
            if (!picked.size) {
              window.alert('先勾選要放進補考卷的題目。')
              return null
            }
            return variantDoc(state, makeRetakeExam(state.exam, picked), '（補考）')
          }}
        />
      </PanelSection>
    </>
  )
}

type TextPreset = { id: string; label: string; heading: number; instruction: number; body: number; line: number }

const TEXT_PRESETS: TextPreset[] = [
  { id: 'normal', label: '標準', heading: 18, instruction: 14, body: 16, line: 1.6 },
  { id: 'large', label: '大字', heading: 20, instruction: 17, body: 19, line: 1.8 },
  { id: 'xlarge', label: '特大', heading: 22, instruction: 19, body: 22, line: 2 },
]

function PrintTools() {
  const { state, dispatch } = useEditor()
  const o = state.textLevelOverrides
  const sizes = {
    heading: mergeTextLevelPreset('section_heading', o).fontSize,
    instruction: mergeTextLevelPreset('instruction', o).fontSize,
    body: mergeTextLevelPreset('question_body', o).fontSize,
  }
  const line = state.layout.spacing.lineHeight.nominal
  const current = TEXT_PRESETS.find(
    (p) => p.heading === sizes.heading && p.instruction === sizes.instruction && p.body === sizes.body && p.line === line,
  )
  const apply = (heading: number, instruction: number, body: number, nominal: number) => {
    const clamp = (n: number) => Math.min(40, Math.max(10, Math.round(n)))
    const lh = Math.min(3, Math.max(1, Math.round(nominal * 10) / 10))
    dispatch({
      type: 'SET_TEXT_SCALE',
      overrides: {
        section_heading: { fontSize: clamp(heading) },
        instruction: { fontSize: clamp(instruction) },
        question_body: { fontSize: clamp(body) },
      },
      lineHeight: { nominal: lh, min: Math.min(lh, Math.max(1, Math.round((lh - 0.3) * 10) / 10)) },
    })
  }
  const step = (d: number) => apply(sizes.heading + d, sizes.instruction + d, sizes.body + d, line + d * 0.05)
  return (
    <PanelSection
      title="字級與列印"
      collapsible
      storeKey="tools-print"
      defaultOpen
      description="低年級用「大字」或「特大」：大題標題、說明、題目一起放大，行距也加寬。黑白列印時卷面會直接變成印出來的樣子。"
    >
      <div className="ui-field">
        <span className="ui-field__label">
          全卷字級（題目 {sizes.body}、行距 {line}）
        </span>
        <div className="tools-scale">
          <Segmented<string>
            label="全卷字級"
            value={current?.id ?? ''}
            options={TEXT_PRESETS.map((p) => ({ value: p.id, label: p.label }))}
            onChange={(id) => {
              const p = TEXT_PRESETS.find((x) => x.id === id)
              if (p) apply(p.heading, p.instruction, p.body, p.line)
            }}
          />
          <button type="button" className="icon-btn" title="全部縮小一級" onClick={() => step(-1)}>
            <Icon name="minus" />
          </button>
          <button type="button" className="icon-btn" title="全部放大一級" onClick={() => step(1)}>
            <Icon name="plus" />
          </button>
        </div>
      </div>
      <div className="ui-row">
        <span className="ui-row__label">黑白列印</span>
        <Switch
          checked={state.layout.print.mono}
          label="黑白列印"
          onChange={(mono) => dispatch({ type: 'SET_PRINT', patch: { mono } })}
        />
      </div>
      <p className="exam-style__follow">彩色字改成黑色粗體，圖片轉成灰階，印出來不會淡到看不見。關掉就恢復彩色。</p>
      <div className="ui-field">
        <span className="ui-field__label">匯出 PDF 時一張紙放</span>
        <Segmented<string>
          label="一張紙放幾頁"
          value={String(state.layout.print.perSheet)}
          options={[
            { value: '1', label: '1 頁' },
            { value: '2', label: '2 頁並排' },
          ]}
          onChange={(v) => dispatch({ type: 'SET_PRINT', patch: { perSheet: v === '2' ? 2 : 1 } })}
        />
      </div>
      <p className="exam-style__follow">
        2 頁並排會放在兩倍寬的紙上：A4 卷印成 A3、B5 卷印成 B4，印好對折就是一份。要印 B4 對折，請先在「卷面 → 紙張」選 B5。
      </p>
    </PanelSection>
  )
}

export function ToolsPanel() {
  return (
    <div className="side-panel__scroll">
      <ReportTools />
      <PrintTools />
      <LibraryTools />
      <TemplateTools />
      <VariantTools />
    </div>
  )
}
