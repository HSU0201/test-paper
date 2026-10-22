import { useEditor } from '../editor/EditorContext'
import type { CanvasObject } from '../types/document'
import { PropertiesPanel } from './PropertiesPanel'
import { Icon } from './ui'

const TYPE_LABEL: Record<CanvasObject['type'], string> = {
  text: '文字',
  line: '線條',
  rect: '方框',
  image: '圖片',
}

const SHORTCUTS: [string, string][] = [
  ['雙擊文字', '編輯內容'],
  ['Delete', '刪除選取'],
  ['Esc', '取消放置'],
  ['拖曳', '自動對齊欄位與物件'],
]

export function Inspector() {
  const { state, dispatch, layoutGeometry } = useEditor()
  const obj = state.selectedId ? state.objects.find((o) => o.id === state.selectedId) : null

  if (!obj) {
    const counts = state.objects.reduce<Record<string, number>>((acc, o) => {
      acc[o.type] = (acc[o.type] ?? 0) + 1
      return acc
    }, {})
    return (
      <aside className="inspector" aria-label="屬性">
        <div className="inspector__empty">
          <h2 className="inspector__title">試卷總覽</h2>
          <p className="inspector__hint">點選紙張上的物件即可在此調整樣式；頁首與分欄請到左側「版型」。</p>
          <dl className="inspector__stats">
            <div>
              <dt>分欄</dt>
              <dd>{layoutGeometry.columns.length === 2 ? '左右雙欄' : '單欄'}</dd>
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
