import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { AnimatePresence } from 'motion/react'

import { useEditor } from '../editor/EditorContext'
import type { ImportProgress, WordImportResult } from '../import/importWord'
import { MotionDialog } from './MotionDialog'
import { Segmented } from './ui'

type Mode = 'replace' | 'append'

function FilePick({
  label,
  hint,
  file,
  onPick,
  disabled,
}: {
  label: string
  hint: string
  file: File | null
  onPick: (file: File | null) => void
  disabled: boolean
}) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div className="import-word__pick">
      <div className="import-word__pick-head">
        <span className="import-word__pick-label">{label}</span>
        <span className="import-word__pick-hint">{hint}</span>
      </div>
      <div className="import-word__pick-row">
        <button type="button" className="btn btn--ghost" disabled={disabled} onClick={() => ref.current?.click()}>
          選擇檔案
        </button>
        <span className={file ? 'import-word__file' : 'import-word__file is-empty'} title={file?.name}>
          {file ? file.name : '尚未選擇'}
        </span>
        {file ? (
          <button type="button" className="text-btn" disabled={disabled} onClick={() => onPick(null)}>
            移除
          </button>
        ) : null}
      </div>
      <input
        ref={ref}
        type="file"
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="visually-hidden"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const picked = e.target.files?.[0] ?? null
          e.target.value = ''
          if (picked) onPick(picked)
        }}
      />
    </div>
  )
}

function progressText(p: ImportProgress | null): string {
  if (!p) return '準備中…'
  if (p.stage === 'read') return '讀取 Word 檔…'
  if (p.stage === 'images') return `轉換圖片 ${p.done}/${p.total}…`
  return '整理題目…'
}

export function ImportWordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { dispatch, state } = useEditor()
  const [questionFile, setQuestionFile] = useState<File | null>(null)
  const [answerFile, setAnswerFile] = useState<File | null>(null)
  const [mode, setMode] = useState<Mode>('replace')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<ImportProgress | null>(null)
  const [result, setResult] = useState<WordImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, busy])

  // 換了檔案就要重新轉換
  const pickQuestion = (f: File | null) => {
    setQuestionFile(f)
    setResult(null)
    setError(null)
  }
  const pickAnswer = (f: File | null) => {
    setAnswerFile(f)
    setResult(null)
    setError(null)
  }

  const convert = () => {
    if (!questionFile) return
    setBusy(true)
    setError(null)
    setResult(null)
    setProgress(null)
    import('../import/importWord')
      .then(({ importWordExam }) => importWordExam(questionFile, answerFile, setProgress))
      .then(setResult)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : '匯入失敗，請確認檔案是 Word（.docx）。'))
      .finally(() => setBusy(false))
  }

  const apply = () => {
    if (!result) return
    dispatch({
      type: 'IMPORT_EXAM',
      sections: result.sections,
      assets: result.assets,
      mode,
      title: result.title || undefined,
    })
    setResult(null)
    setQuestionFile(null)
    setAnswerFile(null)
    onClose()
  }

  const hasContent = state.exam.sections.length > 0
  const mount = document.querySelector('.editor-root')
  if (!mount) return null

  return createPortal(
    <AnimatePresence>
      {open ? (
        <MotionDialog key="import-word" className="import-word" titleId="import-word-title" onClose={busy ? () => undefined : onClose}>
          <h3 id="import-word-title" className="text-level-dialog__title">
            匯入 Word 考卷
          </h3>
          <p className="text-level-dialog__intro">
            把廠商的 Word 考卷轉成這裡的大題與小題，再用本編輯器的版面重新排版。大題要寫成「一、選擇題：每格 0.3
            分」，小題要用 Word 的自動編號。一併選解析卷的話，會把「答案：」對回每一題。
          </p>

          <FilePick label="題目卷" hint="必選" file={questionFile} onPick={pickQuestion} disabled={busy} />
          <FilePick label="解析卷" hint="可省略，用來帶入答案" file={answerFile} onPick={pickAnswer} disabled={busy} />

          <div className="import-word__mode">
            <span className="import-word__pick-label">放進試卷的方式</span>
            <Segmented<Mode>
              label="放進試卷的方式"
              value={mode}
              onChange={setMode}
              options={[
                { value: 'replace', label: '取代目前題目' },
                { value: 'append', label: '加在最後面' },
              ]}
            />
            {mode === 'replace' && hasContent ? (
              <p className="import-word__note">目前的題目會被取代。取代前會自動留一份備份，也可以按復原找回。</p>
            ) : null}
          </div>

          {busy ? (
            <p className="import-word__status" role="status">
              {progressText(progress)}
            </p>
          ) : null}
          {error ? (
            <p className="import-word__error" role="alert">
              {error}
            </p>
          ) : null}
          {result ? (
            <div className="import-word__result" role="status">
              <p className="import-word__summary">
                找到 {result.sections.length} 個大題、{result.questionCount} 題、{result.imageCount} 張圖。
              </p>
              {result.warnings.length ? (
                <ul className="import-word__warnings">
                  {result.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              ) : (
                <p className="import-word__ok">沒有需要注意的地方。</p>
              )}
            </div>
          ) : null}

          <div className="text-level-dialog__footer">
            <button
              type="button"
              className="text-level-dialog__btn text-level-dialog__btn--ghost"
              disabled={busy}
              onClick={onClose}
            >
              取消
            </button>
            {result ? (
              <button type="button" className="text-level-dialog__btn text-level-dialog__btn--primary" onClick={apply}>
                放進試卷
              </button>
            ) : (
              <button
                type="button"
                className="text-level-dialog__btn text-level-dialog__btn--primary"
                disabled={!questionFile || busy}
                onClick={convert}
              >
                {busy ? '轉換中…' : '開始轉換'}
              </button>
            )}
          </div>
        </MotionDialog>
      ) : null}
    </AnimatePresence>,
    mount,
  )
}
