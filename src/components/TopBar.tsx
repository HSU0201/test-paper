import { type RefObject,useRef, useState } from 'react'

import type Konva from 'konva'
import { motion } from 'motion/react'

import { documentBaseName, downloadJson, readDocumentFile, serializeDocument } from '../editor/documentIO'
import { useEditor } from '../editor/EditorContext'
import { exportStagesToPdf } from '../export/pdfFromStage'
import { easeOut } from '../motion/presets'
import { BackupDialog } from './BackupDialog'
import { ImportWordDialog } from './ImportWordDialog'
import { Icon } from './ui'

export function TopBar({ stagesRef }: { stagesRef: RefObject<(Konva.Stage | null)[]> }) {
  const { state, dispatch, undo, redo, canUndo, canRedo, pageCount } = useEditor()
  const openRef = useRef<HTMLInputElement>(null)
  const [backupOpen, setBackupOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [exporting, setExporting] = useState<{ answers: boolean; done: number; total: number } | null>(null)
  const baseName = documentBaseName(state)

  const runExport = (answers: boolean) => {
    const stages = (stagesRef.current ?? []).slice(0, pageCount).filter((s): s is Konva.Stage => !!s)
    if (!stages.length) return
    setExporting({ answers, done: 0, total: stages.length })
    exportStagesToPdf(stages, `${baseName}${answers ? '-答案' : ''}.pdf`, answers, (done, total) =>
      setExporting({ answers, done, total }),
    )
      .catch(() => window.alert('匯出 PDF 失敗，請重新整理頁面後再試一次。'))
      .finally(() => setExporting(null))
  }

  return (
    <motion.header
      className="topbar"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: easeOut }}
    >
      <div className="topbar__brand">
        <motion.span
          className="topbar__logo"
          aria-hidden
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: easeOut, delay: 0.05 }}
        >
          <img src="/favicon.png" alt="" />
        </motion.span>
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
        <button type="button" className="btn btn--ghost" title="把廠商的 Word 考卷轉成題目" onClick={() => setImportOpen(true)}>
          <Icon name="word" />
          匯入 Word
        </button>
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
        <span className="topbar__export">
          <button
            type="button"
            className="btn btn--primary"
            title="下載沒有答案的試卷"
            disabled={exporting !== null}
            aria-busy={exporting?.answers === false}
            onClick={() => runExport(false)}
          >
            <Icon name="pdf" />
            {exporting?.answers === false ? `匯出中 ${exporting.done}/${exporting.total}` : '匯出試卷'}
          </button>
          <button
            type="button"
            className="btn btn--answer"
            title="另存一份印上答案的試卷"
            disabled={exporting !== null}
            aria-busy={exporting?.answers === true}
            onClick={() => runExport(true)}
          >
            <Icon name="pdf" />
            {exporting?.answers === true ? `匯出中 ${exporting.done}/${exporting.total}` : '匯出答案'}
          </button>
        </span>
      </div>
      <BackupDialog open={backupOpen} onClose={() => setBackupOpen(false)} />
      <ImportWordDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </motion.header>
  )
}
