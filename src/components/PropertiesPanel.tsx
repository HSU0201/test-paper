import { useEditor } from '../editor/EditorContext'
import type { FontStyle, TextAlign } from '../types/document'

const FONT_PRESETS = [
  '"Microsoft JhengHei", "PingFang TC", sans-serif',
  '"Noto Sans TC", sans-serif',
  'Georgia, serif',
  'ui-monospace, Consolas, monospace',
]

export function PropertiesPanel() {
  const { state, dispatch } = useEditor()
  const selId = state.selectedId
  const obj = selId ? state.objects.find((o) => o.id === selId) : null

  if (!obj) {
    return (
      <aside className="properties-panel">
        <h2 className="properties-panel__title">屬性</h2>
        <p className="properties-panel__hint">點選畫布上的物件以編輯樣式。</p>
      </aside>
    )
  }

  if (obj.type === 'text') {
    return (
      <aside className="properties-panel">
        <h2 className="properties-panel__title">文字</h2>
        <label className="field">
          <span>字級</span>
          <input
            type="number"
            min={8}
            max={120}
            value={obj.fontSize}
            onChange={(e) =>
              dispatch({
                type: 'SET_TEXT_STYLE',
                id: obj.id,
                patch: { fontSize: Number(e.target.value) || obj.fontSize },
              })
            }
          />
        </label>
        <label className="field">
          <span>字型</span>
          <select
            value={obj.fontFamily}
            onChange={(e) =>
              dispatch({
                type: 'SET_TEXT_STYLE',
                id: obj.id,
                patch: { fontFamily: e.target.value },
              })
            }
          >
            {FONT_PRESETS.map((f) => (
              <option key={f} value={f}>
                {f.includes('JhengHei')
                  ? '微軟正黑體'
                  : f.includes('Noto')
                    ? 'Noto Sans TC'
                    : f.includes('Georgia')
                      ? '襯線體'
                      : '等寬字'}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>顏色</span>
          <input
            type="color"
            value={obj.fill.length === 7 ? obj.fill : '#111827'}
            onChange={(e) =>
              dispatch({
                type: 'SET_TEXT_STYLE',
                id: obj.id,
                patch: { fill: e.target.value },
              })
            }
          />
        </label>
        <label className="field">
          <span>樣式</span>
          <select
            value={obj.fontStyle}
            onChange={(e) =>
              dispatch({
                type: 'SET_TEXT_STYLE',
                id: obj.id,
                patch: { fontStyle: e.target.value as FontStyle },
              })
            }
          >
            <option value="normal">一般</option>
            <option value="bold">粗體</option>
            <option value="italic">斜體</option>
            <option value="bold italic">粗斜體</option>
          </select>
        </label>
        <label className="field">
          <span>對齊</span>
          <select
            value={obj.align}
            onChange={(e) =>
              dispatch({
                type: 'SET_TEXT_STYLE',
                id: obj.id,
                patch: { align: e.target.value as TextAlign },
              })
            }
          >
            <option value="left">靠左</option>
            <option value="center">置中</option>
            <option value="right">靠右</option>
          </select>
        </label>
        <label className="field">
          <span>區塊寬度</span>
          <input
            type="number"
            min={40}
            max={state.pageWidth}
            value={Math.round(obj.width)}
            onChange={(e) =>
              dispatch({
                type: 'SET_TEXT_STYLE',
                id: obj.id,
                patch: { width: Number(e.target.value) || obj.width },
              })
            }
          />
        </label>
      </aside>
    )
  }

  if (obj.type === 'line') {
    return (
      <aside className="properties-panel">
        <h2 className="properties-panel__title">線條</h2>
        <label className="field">
          <span>顏色</span>
          <input
            type="color"
            value={obj.stroke.length === 7 ? obj.stroke : '#111827'}
            onChange={(e) =>
              dispatch({
                type: 'SET_LINE_STYLE',
                id: obj.id,
                patch: { stroke: e.target.value },
              })
            }
          />
        </label>
        <label className="field">
          <span>線寬</span>
          <input
            type="number"
            min={1}
            max={24}
            value={obj.strokeWidth}
            onChange={(e) =>
              dispatch({
                type: 'SET_LINE_STYLE',
                id: obj.id,
                patch: { strokeWidth: Number(e.target.value) || obj.strokeWidth },
              })
            }
          />
        </label>
      </aside>
    )
  }

  if (obj.type === 'rect') {
    return (
      <aside className="properties-panel">
        <h2 className="properties-panel__title">矩形</h2>
        <label className="field">
          <span>填色</span>
          <input
            type="color"
            value={obj.fill === 'transparent' ? '#ffffff' : obj.fill}
            onChange={(e) =>
              dispatch({
                type: 'SET_RECT_STYLE',
                id: obj.id,
                patch: { fill: e.target.value },
              })
            }
          />
        </label>
        <label className="field">
          <span>透明填色</span>
          <input
            type="checkbox"
            checked={obj.fill === 'transparent'}
            onChange={(e) =>
              dispatch({
                type: 'SET_RECT_STYLE',
                id: obj.id,
                patch: { fill: e.target.checked ? 'transparent' : '#ffffff' },
              })
            }
          />
        </label>
        <label className="field">
          <span>框線顏色</span>
          <input
            type="color"
            value={obj.stroke.length === 7 ? obj.stroke : '#374151'}
            onChange={(e) =>
              dispatch({
                type: 'SET_RECT_STYLE',
                id: obj.id,
                patch: { stroke: e.target.value },
              })
            }
          />
        </label>
        <label className="field">
          <span>框線寬度</span>
          <input
            type="number"
            min={0}
            max={24}
            value={obj.strokeWidth}
            onChange={(e) =>
              dispatch({
                type: 'SET_RECT_STYLE',
                id: obj.id,
                patch: { strokeWidth: Number(e.target.value) },
              })
            }
          />
        </label>
        <label className="field">
          <span>圓角</span>
          <input
            type="number"
            min={0}
            max={80}
            value={obj.cornerRadius}
            onChange={(e) =>
              dispatch({
                type: 'SET_RECT_STYLE',
                id: obj.id,
                patch: { cornerRadius: Number(e.target.value) },
              })
            }
          />
        </label>
      </aside>
    )
  }

  if (obj.type === 'image') {
    return (
      <aside className="properties-panel">
        <h2 className="properties-panel__title">圖片</h2>
        <p className="properties-panel__hint">拖曳角落可縮放；拖曳本體可移動位置。</p>
      </aside>
    )
  }

  return null
}
