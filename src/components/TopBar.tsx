import type Konva from 'konva'
import { useRef, type RefObject } from 'react'
import { useEditor } from '../editor/EditorContext'
import { documentBaseName, downloadJson, readDocumentFile, serializeDocument } from '../editor/documentIO'
import { exportStageToPdf } from '../export/pdfFromStage'
import { Icon } from './ui'

export function TopBar({ stageRef }: { stageRef: RefObject<Konva.Stage | null> }) {
  const { state, dispatch } = useEditor()
  const openRef = useRef<HTMLInputElement>(null)
  const baseName = documentBaseName(state)

  return (
    <header className="topbar">
      <div className="topbar__brand">
        <span className="topbar__logo" aria-hidden>
          卷
        </span>
        <div className="topbar__title">
          <span className="topbar__app">試卷編輯器</span>
          <span className="topbar__doc" title={baseName}>
            {baseName}
          </span>
        </div>
      </div>

      <div className="topbar__actions">
        <button type="button" className="btn btn--ghost" onClick={() => openRef.current?.click()}>
          <Icon name="open" />
          開啟
        </button>
        <input
          ref={openRef}
          type="file"
          accept="application/json,.json"
          className="visually-hidden"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) readDocumentFile(file, dispatch)
          }}
        />
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => downloadJson(`${baseName}.json`, serializeDocument(state))}
        >
          <Icon name="save" />
          儲存
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--danger"
          onClick={() => {
            if (window.confirm('確定要清空整份試卷？版型與所有物件都會重設。')) dispatch({ type: 'RESET' })
          }}
        >
          <Icon name="trash" />
          清空
        </button>
        <span className="topbar__sep" aria-hidden />
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => {
            const stage = stageRef.current
            if (stage) exportStageToPdf(stage, `${baseName}.pdf`)
          }}
        >
          <Icon name="pdf" />
          匯出 PDF
        </button>
      </div>
    </header>
  )
}
