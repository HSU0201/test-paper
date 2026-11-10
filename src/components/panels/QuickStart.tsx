import { useState } from 'react'

import { SAMPLE_SUBJECTS } from '../../editor/chineseSample'
import { useEditor } from '../../editor/EditorContext'
import { SECTION_PRESETS } from '../../editor/sectionPresets'
import { Icon } from '../ui'

/** 頂端「匯入考卷」對話框；側欄也能叫出來 */
export const OPEN_IMPORT_WORD = 'testpaper:open-import-word'

function PresetGrid({ afterId, onDone }: { afterId?: string; onDone?: () => void }) {
  const { dispatch } = useEditor()
  return (
    <div className="preset-grid" role="group" aria-label="選一種題型">
      {SECTION_PRESETS.map((p) => (
        <button
          key={p.id}
          type="button"
          className="preset-grid__item"
          onClick={() => {
            dispatch({ type: 'ADD_SECTION', afterId, preset: p })
            onDone?.()
          }}
        >
          <strong>{p.label}</strong>
          <span>{p.hint}</span>
        </button>
      ))}
    </div>
  )
}

/** 「新增大題」：先選題型，名稱、說明和第一題一次建好 */
export function AddSectionPicker({ afterId }: { afterId?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="outline__adds">
      <button
        type="button"
        className="outline__add-section"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Icon name={open ? 'minus' : 'plus'} />
        {open ? '收起' : '新增大題'}
      </button>
      {open ? <PresetGrid afterId={afterId} onDone={() => setOpen(false)} /> : null}
    </div>
  )
}

/** 還沒有任何題目時，告訴老師三種開始方式 */
export function StartCard() {
  const { dispatch } = useEditor()
  return (
    <div className="start-card">
      <h3 className="start-card__title">開始出一份考卷</h3>
      <ol className="start-card__steps">
        <li>選題型，新增第一個大題</li>
        <li>點題目，打字、選答案</li>
        <li>按右上角「匯出試卷」</li>
      </ol>
      <p className="start-card__label">第一個大題要出什麼？</p>
      <PresetGrid />
      <div className="start-card__or">
        <span>或是</span>
      </div>
      <button
        type="button"
        className="btn btn--ghost btn--block"
        onClick={() => window.dispatchEvent(new Event(OPEN_IMPORT_WORD))}
      >
        <Icon name="word" />
        <span className="start-card__import">
          匯入現有考卷
          <small>Word、PDF、照片</small>
        </span>
      </button>
      <div className="start-card__samples">
        <span className="start-card__samples-label">先看範例：</span>
        <span className="start-card__samples-list">
          {SAMPLE_SUBJECTS.filter((s) => s.ready).map((s) => (
            <button key={s.id} type="button" className="text-btn" onClick={() => dispatch({ type: 'LOAD_EXAMPLE', subject: s.id })}>
              {s.label}
            </button>
          ))}
        </span>
      </div>
    </div>
  )
}
