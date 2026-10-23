import { useEditor } from '../editor/EditorContext'
import { describeWarnings } from '../editor/warningText'
import type { CanvasObject } from '../types/document'
import { HEADER_ROLE_LABEL, resolveSplit } from '../types/layout'
import { BlockInspector } from './BlockInspector'
import { HeaderItemInspector } from './HeaderItemInspector'
import { PropertiesPanel } from './PropertiesPanel'
import { Icon } from './ui'

const TYPE_LABEL: Record<CanvasObject['type'], string> = {
  text: '文字',
  line: '線條',
  rect: '方框',
  image: '圖片',
}

const SHORTCUTS: [string, string][] = [
  ['Ctrl+Z', '復原'],
  ['Ctrl+Y', '重做'],
  ['雙擊文字', '編輯內容'],
  ['Delete', '刪除選取'],
  ['Esc', '取消放置'],
  ['拖曳', '自動對齊欄位與物件'],
]

export function Inspector() {
  const { state, dispatch, pageGeometry, flow, pageCount } = useEditor()
  const obj = state.selectedId ? state.objects.find((o) => o.id === state.selectedId) : null
  const block = state.selectedBlock
  const frames = pageGeometry(0).frames.length

  if (block?.kind === 'header') {
    const item = state.layout.header.items.find((it) => it.id === block.id)
    if (item) {
      return (
        <aside className="inspector" aria-label="屬性">
          <div className="inspector__head">
            <span className="inspector__badge">頁首・{item.label || HEADER_ROLE_LABEL[item.role]}</span>
            <div className="inspector__tools">
              <button
                type="button"
                className="icon-btn icon-btn--danger"
                title={item.role === 'custom' ? '刪除此欄位' : '隱藏此欄位'}
                onClick={() => dispatch({ type: 'DELETE_SELECTED' })}
              >
                <Icon name="trash" />
              </button>
            </div>
          </div>
          <HeaderItemInspector item={item} />
        </aside>
      )
    }
  }

  if (block) {
    const notes = describeWarnings(
      flow.warnings.filter((w) =>
        w.type === 'oversize' ? w.ref.id === block.id : w.type === 'headMoved' ? w.sectionId === block.id : false,
      ),
      state.exam,
      frames,
    )
    const page = flow.blocks.find((b) => b.ref.id === block.id)?.page
    return (
      <aside className="inspector" aria-label="屬性">
        <div className="inspector__head">
          <span className="inspector__badge">{block.kind === 'section' ? '大題' : '小題'}</span>
          <div className="inspector__tools">
            <button
              type="button"
              className="icon-btn icon-btn--danger"
              title={block.kind === 'section' ? '刪除大題（含所有小題）' : '刪除小題'}
              onClick={() => dispatch({ type: 'DELETE_SELECTED' })}
            >
              <Icon name="trash" />
            </button>
          </div>
        </div>
        {page !== undefined ? <p className="inspector__meta">位於第 {page + 1} 頁</p> : null}
        {notes.map((n) => (
          <p key={n.key} className={n.tone === 'warn' ? 'inspector__warn' : 'inspector__note'}>
            {n.text}
          </p>
        ))}
        <BlockInspector />
      </aside>
    )
  }

  if (!obj) {
    const counts = state.objects.reduce<Record<string, number>>((acc, o) => {
      acc[o.type] = (acc[o.type] ?? 0) + 1
      return acc
    }, {})
    return (
      <aside className="inspector" aria-label="屬性">
        <div className="inspector__empty">
          <h2 className="inspector__title">試卷總覽</h2>
          <p className="inspector__hint">
            點選紙張上的題目或左側「大綱」即可在此編輯；點頁首文字可拖曳排版，欄位與分欄請到「版型」。
          </p>
          <dl className="inspector__stats">
            <div>
              <dt>頁數</dt>
              <dd>{pageCount}</dd>
            </div>
            <div>
              <dt>分欄</dt>
              <dd>
                {frames === 2
                  ? resolveSplit(state.layout.columns, state.pageWidth, state.pageHeight) === 'vertical'
                    ? '左右雙欄'
                    : '上下雙欄'
                  : '單欄'}
              </dd>
            </div>
            {(Object.keys(TYPE_LABEL) as CanvasObject['type'][]).map((t) => (
              <div key={t}>
                <dt>{TYPE_LABEL[t]}</dt>
                <dd>{counts[t] ?? 0}</dd>
              </div>
            ))}
          </dl>
          <h3 className="inspector__subtitle">快捷操作</h3>
          <ul className="inspector__shortcuts">
            {SHORTCUTS.map(([k, v]) => (
              <li key={k}>
                <kbd>{k}</kbd>
                <span>{v}</span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    )
  }

  return (
    <aside className="inspector" aria-label="屬性">
      <div className="inspector__head">
        <span className="inspector__badge">{TYPE_LABEL[obj.type]}</span>
        <div className="inspector__tools">
          <button
            type="button"
            className="icon-btn"
            title="上移一層"
            onClick={() => dispatch({ type: 'BRING_FORWARD' })}
          >
            <Icon name="up" />
          </button>
          <button
            type="button"
            className="icon-btn"
            title="下移一層"
            onClick={() => dispatch({ type: 'SEND_BACKWARD' })}
          >
            <Icon name="down" />
          </button>
          <button
            type="button"
            className="icon-btn icon-btn--danger"
            title="刪除（Delete）"
            onClick={() => dispatch({ type: 'DELETE_SELECTED' })}
          >
            <Icon name="trash" />
          </button>
        </div>
      </div>
      <PropertiesPanel />
    </aside>
  )
}
