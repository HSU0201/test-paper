import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { AnimatePresence, motion } from 'motion/react'

import { useEditor } from '../editor/EditorContext'
import type { ImportProgress, WordImportResult } from '../import/importExam'
import type { Asset, Section } from '../types/exam'
import { MotionDialog } from './MotionDialog'
import { Icon, Segmented } from './ui'

type Mode = 'replace' | 'append'

const ACCEPT = '.docx,.pdf,image/*,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf'

function filesLabel(files: File[]): string {
  if (files.length === 1) return files[0].name
  const names = files.map((f) => f.name).join('、')
  return `${files.length} 個檔案：${names}`
}

function FilePick({
  label,
  hint,
  files,
  onPick,
  disabled,
}: {
  label: string
  hint: string
  files: File[]
  onPick: (files: File[]) => void
  disabled: boolean
}) {
  const ref = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const filled = files.length > 0
  const dropClass = ['import-word__drop', filled ? 'is-filled' : '', dragging ? 'is-dragging' : '']
    .filter(Boolean)
    .join(' ')
  return (
    <div className="import-word__pick">
      <div className="import-word__pick-head">
        <span className="import-word__pick-label">{label}</span>
        <span className="import-word__pick-hint">{hint}</span>
      </div>
      <div className="import-word__pick-row">
        <button
          type="button"
          className={dropClass}
          disabled={disabled}
          onClick={() => ref.current?.click()}
          onDragOver={(e) => {
            if (disabled) return
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            if (disabled) return
            const dropped = [...(e.dataTransfer.files ?? [])]
            if (dropped.length) onPick(dropped)
          }}
        >
          <span className="import-word__drop-icon" aria-hidden>
            <Icon name={filled && !files.some((f) => /\.docx$/i.test(f.name)) ? 'image' : 'word'} />
          </span>
          <span className="import-word__drop-text">
            <span className="import-word__drop-title" title={filled ? filesLabel(files) : undefined}>
              {filled ? filesLabel(files) : '點這裡選擇檔案'}
            </span>
            <span className="import-word__drop-sub">
              {filled ? '已選好，點一下可以換別的檔案' : 'Word、PDF 或照片都可以，也能直接拖曳進來'}
            </span>
          </span>
        </button>
        {filled ? (
          <button type="button" className="text-btn" disabled={disabled} onClick={() => onPick([])}>
            移除
          </button>
        ) : null}
      </div>
      <input
        ref={ref}
        type="file"
        multiple
        accept={ACCEPT}
        className="visually-hidden"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const picked = [...(e.target.files ?? [])]
          e.target.value = ''
          if (picked.length) onPick(picked)
        }}
      />
    </div>
  )
}

/** 題幹的一行預覽 */
function stemPreview(stem: string): string {
  const text = stem.replace(/\s+/g, ' ').trim()
  return text || '（沒有題幹）'
}

/** 只留勾選的大題與小題；沒勾到的大題整個拿掉，圖片也只留用得到的 */
function pickSelected(result: WordImportResult, skipped: Set<string>) {
  const sections: Section[] = []
  for (const s of result.sections) {
    if (s.questions.length === 0) {
      if (!skipped.has(s.id)) sections.push(s)
      continue
    }
    const questions = s.questions.filter((q) => !skipped.has(q.id))
    if (questions.length) sections.push({ ...s, questions })
  }
  const used = new Set(sections.flatMap((s) => s.questions.flatMap((q) => q.figures.map((f) => f.assetId))))
  const assets: Record<string, Asset> = {}
  for (const id of used) if (result.assets[id]) assets[id] = result.assets[id]
  return { sections, assets }
}

function SectionCheck({
  section,
  index,
  skipped,
  setSkipped,
}: {
  section: Section
  index: number
  skipped: Set<string>
  setSkipped: (next: Set<string>) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  const ids = section.questions.length ? section.questions.map((q) => q.id) : [section.id]
  const picked = ids.filter((id) => !skipped.has(id)).length
  const all = picked === ids.length
  const some = picked > 0 && !all
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = some
  }, [some])

  const toggleAll = () => {
    const next = new Set(skipped)
    for (const id of ids) {
      if (all) next.add(id)
      else next.delete(id)
    }
    setSkipped(next)
  }
  const toggle = (id: string) => {
    const next = new Set(skipped)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSkipped(next)
  }

  return (
    <div className="import-word__pickq-section">
      <label className="import-word__check is-section">
        <input ref={ref} type="checkbox" checked={all} onChange={toggleAll} />
        <span className="import-word__check-text" title={section.title}>
          {section.title || `第 ${index + 1} 大題`}
          {section.questions.length ? `（${picked}/${section.questions.length} 題）` : ''}
        </span>
      </label>
      {section.questions.map((q, qi) => {
        const preview = stemPreview(q.stem)
        return (
          <label key={q.id} className="import-word__check is-question">
            <input type="checkbox" checked={!skipped.has(q.id)} onChange={() => toggle(q.id)} />
            <span className="import-word__check-text" title={preview}>
              {qi + 1}. {preview}
            </span>
          </label>
        )
      })}
    </div>
  )
}

function progressText(p: ImportProgress | null): string {
  if (!p) return '準備中…'
  const page = p.total > 1 ? ` 第 ${Math.min(p.done + 1, p.total)}/${p.total} 頁` : ''
  if (p.stage === 'read') return `讀取檔案${page}…`
  if (p.stage === 'ocr') return `辨識文字${page}…`
  if (p.stage === 'images') return `轉換圖片 ${p.done}/${p.total}…`
  return '整理題目…'
}

const WORD_STEPS: { stage: ImportProgress['stage']; label: string }[] = [
  { stage: 'read', label: '讀取檔案' },
  { stage: 'images', label: '轉換圖片' },
  { stage: 'build', label: '整理題目' },
]

const TEXT_STEPS: { stage: ImportProgress['stage']; label: string }[] = [
  { stage: 'read', label: '讀取檔案' },
  { stage: 'ocr', label: '辨識文字' },
  { stage: 'build', label: '整理題目' },
]

/** 進度條百分比；逐頁或逐張圖的階段依完成比例前進，其他階段各給一小段 */
function progressPercent(p: ImportProgress | null): number {
  if (!p) return 6
  if (p.stage === 'build') return 95
  if (p.stage === 'read' && p.total <= 1) return 6
  return 10 + Math.round((p.total ? p.done / p.total : 1) * 80)
}

function ImportLoading({ progress, textMode }: { progress: ImportProgress | null; textMode: boolean }) {
  const steps = textMode ? TEXT_STEPS : WORD_STEPS
  const current = steps.findIndex((s) => s.stage === (progress?.stage ?? 'read'))
  const percent = progressPercent(progress)
  return (
    <motion.div
      className="import-word__loading"
      role="status"
      aria-live="polite"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <div className="import-word__spinner" aria-hidden />
      <p className="import-word__loading-title">正在轉換考卷</p>
      <p className="import-word__loading-text">{progressText(progress)}</p>
      <div
        className="import-word__bar"
        role="progressbar"
        aria-label="轉換進度"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div className="import-word__bar-fill" style={{ width: `${percent}%` }} />
      </div>
      <ol className="import-word__steps">
        {steps.map((s, i) => (
          <li key={s.stage} className={i < current ? 'is-done' : i === current ? 'is-active' : undefined}>
            {s.label}
          </li>
        ))}
      </ol>
      <p className="import-word__loading-hint">
        {textMode
          ? '文字辨識在這台電腦上進行，一頁約需 10～30 秒；第一次使用要先下載辨識資料。請不要關閉視窗。'
          : '圖片多的考卷需要久一點，請不要關閉視窗。'}
      </p>
    </motion.div>
  )
}

export function ImportWordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { dispatch, state } = useEditor()
  const [questionFiles, setQuestionFiles] = useState<File[]>([])
  const [answerFiles, setAnswerFiles] = useState<File[]>([])
  const [mode, setMode] = useState<Mode>('replace')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<ImportProgress | null>(null)
  const [result, setResult] = useState<WordImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  /** 不要匯入的小題（或沒有小題的大題）id；預設全部匯入 */
  const [skipped, setSkipped] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, busy])

  // 換了檔案就要重新轉換
  const pick = (setFiles: (files: File[]) => void) => (files: File[]) => {
    setResult(null)
    // 不能匯入的檔案（例如 Word 和圖片混選）直接說明，不收進來
    void import('../import/importExam').then(({ checkFiles }) => {
      const problem = checkFiles(files)
      setError(problem)
      if (!problem) setFiles(files)
    })
  }
  const pickQuestion = pick(setQuestionFiles)
  const pickAnswer = pick(setAnswerFiles)
  const textMode = questionFiles.length > 0 && !/.docx$/i.test(questionFiles[0].name)

  const convert = () => {
    if (!questionFiles.length) return
    setBusy(true)
    setError(null)
    setResult(null)
    setProgress(null)
    setSkipped(new Set())
    import('../import/importExam')
      .then(({ importExam }) => importExam(questionFiles, answerFiles, setProgress))
      .then(setResult)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : '匯入失敗，請確認檔案是 Word、PDF 或圖片。'))
      .finally(() => setBusy(false))
  }

  const apply = () => {
    if (!result) return
    const { sections, assets } = pickSelected(result, skipped)
    if (!sections.length) return
    dispatch({
      type: 'IMPORT_EXAM',
      sections,
      assets,
      mode,
      title: result.title || undefined,
    })
    setResult(null)
    setSkipped(new Set())
    setQuestionFiles([])
    setAnswerFiles([])
    onClose()
  }

  const hasContent = state.exam.sections.length > 0
  const pickIds = result ? result.sections.flatMap((s) => (s.questions.length ? s.questions.map((q) => q.id) : [s.id])) : []
  const pickedCount = pickIds.filter((id) => !skipped.has(id)).length
  const pickedQuestions = result
    ? result.sections.reduce((n, s) => n + s.questions.filter((q) => !skipped.has(q.id)).length, 0)
    : 0
  const mount = document.querySelector('.editor-root')
  if (!mount) return null

  return createPortal(
    <AnimatePresence>
      {open ? (
        <MotionDialog key="import-word" className="import-word" titleId="import-word-title" onClose={busy ? () => undefined : onClose}>
          <h3 id="import-word-title" className="text-level-dialog__title">
            匯入考卷
          </h3>
          <p className="text-level-dialog__intro">
            把 Word、PDF 或拍照的考卷轉成這裡的大題與小題，再用本編輯器的版面重新排版。大題要寫成「一、選擇題：每格 0.3
            分」，小題用 Word 自動編號或「1.」開頭。一併選解析卷的話，會把「答案：」對回每一題。照片可以一次選多張，一張一頁。
          </p>

          <FilePick label="題目卷" hint="必選" files={questionFiles} onPick={pickQuestion} disabled={busy} />
          <FilePick label="解析卷" hint="可省略，用來帶入答案" files={answerFiles} onPick={pickAnswer} disabled={busy} />

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

          <AnimatePresence>{busy ? <ImportLoading key="loading" progress={progress} textMode={textMode} /> : null}</AnimatePresence>
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
          {result && result.sections.length ? (
            <div className="import-word__pickq">
              <div className="import-word__pickq-bar">
                <span className="import-word__pickq-count">
                  選擇要放進試卷的題目：已選 {pickedQuestions}/{result.questionCount} 題
                </span>
                <button
                  type="button"
                  className="text-btn"
                  disabled={pickedCount === pickIds.length}
                  onClick={() => setSkipped(new Set())}
                >
                  全選
                </button>
                <button
                  type="button"
                  className="text-btn"
                  disabled={pickedCount === 0}
                  onClick={() => setSkipped(new Set(pickIds))}
                >
                  全不選
                </button>
              </div>
              <div className="import-word__pickq-list">
                {result.sections.map((s, si) => (
                  <SectionCheck key={s.id} section={s} index={si} skipped={skipped} setSkipped={setSkipped} />
                ))}
              </div>
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
              <button
                type="button"
                className="text-level-dialog__btn text-level-dialog__btn--primary"
                disabled={pickedCount === 0}
                onClick={apply}
              >
                {pickedQuestions ? `放進試卷（${pickedQuestions} 題）` : '放進試卷'}
              </button>
            ) : (
              <button
                type="button"
                className="text-level-dialog__btn text-level-dialog__btn--primary"
                disabled={!questionFiles.length || busy}
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
