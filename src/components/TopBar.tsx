import { type RefObject, useEffect, useRef, useState } from 'react'

import type Konva from 'konva'
import { motion } from 'motion/react'

import { forgetCurrentPaper } from '../editor/currentPaper'
import { documentBaseName, downloadJson, readDocumentFile, serializeDocument } from '../editor/documentIO'
import { useEditor } from '../editor/EditorContext'
import { exportStagesToPdf } from '../export/pdfFromStage'
import { easeOut } from '../motion/presets'
import { BackupDialog } from './BackupDialog'
import { ImportWordDialog } from './ImportWordDialog'
import { OPEN_IMPORT_WORD } from './panels/QuickStart'
import { PapersDialog } from './PapersDialog'
import { Icon, type IconName } from './ui'

type FileActionKey = 'papers' | 'open' | 'word' | 'save' | 'backup' | 'reset'

const FILE_ACTIONS: { key: FileActionKey; icon: IconName; label: string; title: string; danger?: boolean }[] = [
  { key: 'papers', icon: 'page', label: '我的考卷', title: '同時出好幾份考卷，例如先存數學、再出國語' },
  { key: 'open', icon: 'open', label: '開啟', title: '開啟存好的試卷檔（.json）' },
  { key: 'word', icon: 'word', label: '匯入考卷', title: '把 Word、PDF 或拍照的考卷轉成題目' },
  { key: 'save', icon: 'save', label: '儲存', title: '下載試卷檔，之後可以再開啟' },
  { key: 'backup', icon: 'backup', label: '備份', title: '定時備份、下載與匯入' },
  { key: 'reset', icon: 'trash', label: '清空', title: '清空整份試卷', danger: true },
]

export function TopBar({ stagesRef }: { stagesRef: RefObject<(Konva.Stage | null)[]> }) {
  const { state, dispatch, undo, redo, canUndo, canRedo, pageCount } = useEditor()
  const openRef = useRef<HTMLInputElement>(null)
  const [backupOpen, setBackupOpen] = useState(false)
  const [papersOpen, setPapersOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!moreOpen) return
    const close = (e: PointerEvent) => {
      if (!moreRef.current?.contains(e.target as Node)) setMoreOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [moreOpen])
  const [exporting, setExporting] = useState<{ answers: boolean; done: number; total: number } | null>(null)
  const baseName = documentBaseName(state)
  useEffect(() => {
    const open = () => setImportOpen(true)
    window.addEventListener(OPEN_IMPORT_WORD, open)
    return () => window.removeEventListener(OPEN_IMPORT_WORD, open)
  }, [])

  const runExport = (answers: boolean) => {
    const stages = (stagesRef.current ?? []).slice(0, pageCount).filter((s): s is Konva.Stage => !!s)
    if (!stages.length) return
    setExporting({ answers, done: 0, total: stages.length })
    const { mono, perSheet } = state.layout.print
    exportStagesToPdf(stages, `${baseName}${answers ? '-答案' : ''}.pdf`, {
      includeAnswers: answers,
      mono,
      perSheet,
      onProgress: (done, total) => setExporting({ answers, done, total }),
    })
      .catch(() => window.alert('匯出 PDF 失敗，請重新整理頁面後再試一次。'))
      .finally(() => setExporting(null))
  }

  /** 開啟、匯入、儲存、備份、清空。電腦上排成一列；手機收進「⋯」 */
  const runFile = (key: FileActionKey) => {
    if (key === 'papers') setPapersOpen(true)
    else if (key === 'open') openRef.current?.click()
    else if (key === 'word') setImportOpen(true)
    else if (key === 'save') downloadJson(`${baseName}.json`, serializeDocument(state))
    else if (key === 'backup') setBackupOpen(true)
    else if (window.confirm('確定要清空整份試卷？題目、版型與所有物件都會重設。清空前會先留下一份備份，也可以按復原找回。')) {
      forgetCurrentPaper()
      dispatch({ type: 'RESET' })
    }
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
          <img src={`${import.meta.env.BASE_URL}favicon.png`} alt="" />
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
        <span className="topbar__secondary">
          {FILE_ACTIONS.map((a) => (
            <button
              key={a.key}
              type="button"
              className={`btn btn--ghost${a.danger ? ' btn--danger' : ''}`}
              title={a.title}
              aria-label={a.label}
              onClick={() => runFile(a.key)}
            >
              <Icon name={a.icon} />
              <span className="btn__label">{a.label}</span>
            </button>
          ))}
        </span>
        <div className="topbar__more" ref={moreRef}>
          <button
            type="button"
            className="icon-btn"
            title="開啟、儲存、匯入考卷、備份"
            aria-label="更多功能"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen(!moreOpen)}
          >
            <Icon name="more" />
          </button>
          {moreOpen ? (
            <div className="topbar__menu" role="menu">
              {FILE_ACTIONS.map((a) => (
                <button
                  key={a.key}
                  type="button"
                  role="menuitem"
                  className={a.danger ? 'is-danger' : ''}
                  onClick={() => {
                    setMoreOpen(false)
                    runFile(a.key)
                  }}
                >
                  <Icon name={a.icon} />
                  {a.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
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
            if (!file) return
            forgetCurrentPaper()
            readDocumentFile(file, dispatch)
          }}
        />
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
            {exporting?.answers === false ? (
              `匯出中 ${exporting.done}/${exporting.total}`
            ) : (
              <>
                <span className="btn__label">匯出試卷</span>
                <span className="btn__short">試卷</span>
              </>
            )}
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
            {exporting?.answers === true ? (
              `匯出中 ${exporting.done}/${exporting.total}`
            ) : (
              <>
                <span className="btn__label">匯出答案</span>
                <span className="btn__short">答案</span>
              </>
            )}
          </button>
        </span>
      </div>
      <BackupDialog open={backupOpen} onClose={() => setBackupOpen(false)} />
      <PapersDialog open={papersOpen} onClose={() => setPapersOpen(false)} />
      <ImportWordDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </motion.header>
  )
}
