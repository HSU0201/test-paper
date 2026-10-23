import type Konva from 'konva'
import { useRef, useState, type RefObject } from 'react'
import { useEditor } from '../editor/EditorContext'
import { documentBaseName, downloadJson, readDocumentFile, serializeDocument } from '../editor/documentIO'
import { exportStagesToPdf } from '../export/pdfFromStage'
import { BackupDialog } from './BackupDialog'
import { Icon } from './ui'

export function TopBar({ stagesRef }: { stagesRef: RefObject<(Konva.Stage | null)[]> }) {
  const { state, dispatch, undo, redo, canUndo, canRedo, pageCount } = useEditor()
  const openRef = useRef<HTMLInputElement>(null)
  const [backupOpen, setBackupOpen] = useState(false)
  const baseName = documentBaseName(state)

  return (
    <header className="topbar">
      <div className="topbar__brand">
        <span className="topbar__logo" aria-hidden>
          <img src="/favicon.png" alt="" />
        </span>
        <div className="topbar__title">
          <span className="topbar__app">試卷編輯器</span>
          <span className="topbar__doc" title={baseName}>
            {baseName}
          </span>
        </div>
      </div>

      <div className="topbar__actions">
        <button type="button" className="icon-btn" title="復原（Ctrl+Z）" disabled={!canUndo} onClick={undo}>
          <Icon name="undo" />
        </button>
        <button type="button" className="icon-btn" title="重做（Ctrl+Y）" disabled={!canRedo} onClick={redo}>
          <Icon name="redo" />
        </button>
        <span className="topbar__sep" aria-hidden />
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
        <button type="button" className="btn btn--ghost" title="定時備份、下載與匯入" onClick={() => setBackupOpen(true)}>
          <Icon name="backup" />
          備份
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--danger"
          onClick={() => {
            if (window.confirm('確定要清空整份試卷？題目、版型與所有物件都會重設。清空前會先留下一份備份，也可以按復原找回。')) dispatch({ type: 'RESET' })
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
            const stages = (stagesRef.current ?? []).slice(0, pageCount).filter((s): s is Konva.Stage => !!s)
            exportStagesToPdf(stages, `${baseName}.pdf`)
          }}
        >
          <Icon name="pdf" />
          匯出 PDF
        </button>
      </div>
      {backupOpen ? <BackupDialog onClose={() => setBackupOpen(false)} /> : null}
    </header>
  )
}
