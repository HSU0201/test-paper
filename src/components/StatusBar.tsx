import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { useEditor } from '../editor/EditorContext'
import { describeWarnings } from '../editor/warningText'
import { easeOut } from '../motion/presets'
import { examTotals } from '../types/exam'
import { resolveSplit } from '../types/layout'
import { APP_VERSION } from '../version'

function timeLabel(at?: number) {
  if (!at) return ''
  const d = new Date(at)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function StatusBar({ onLocate }: { onLocate: (page: number) => void }) {
  const { state, dispatch, flow, pageCount, saveStatus, snapshots, pageGeometry } = useEditor()
  const [open, setOpen] = useState(false)
  const popRef = useRef<HTMLDivElement>(null)
  const totals = examTotals(state.exam)
  const notices = describeWarnings(
    flow.warnings,
    state.exam,
    pageGeometry(0).frames.length,
    resolveSplit(state.layout.columns, state.pageWidth, state.pageHeight) === 'horizontal',
    state.pageWidth > state.pageHeight,
  )
  const warnCount = notices.filter((n) => n.tone === 'warn').length

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!popRef.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [open])

  const save =
    saveStatus.state === 'loading'
      ? '讀取暫存中…'
      : saveStatus.state === 'saving'
        ? '儲存中…'
        : saveStatus.state === 'error'
          ? '自動暫存失敗'
          : saveStatus.at
            ? `已自動暫存 ${timeLabel(saveStatus.at)}`
            : '尚未暫存'
  const backupNote = saveStatus.state !== 'loading' && snapshots.length ? ` · 備份 ${snapshots.length} 份` : ''

  const saveKey = saveStatus.state === 'saving' ? 'saving' : `${save}${backupNote}`

  return (
    <motion.footer
      className="statusbar"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, delay: 0.08, ease: easeOut }}
    >
      <span>共 {pageCount} 頁</span>
      <span>
        {totals.sections} 大題・{totals.questions} 題・總分 {totals.score}
      </span>
      {flow.squeeze > 0 ? <span className="statusbar__info">行高 {flow.lineHeight}（已壓縮）</span> : null}
      <span className="statusbar__spacer" />
      {notices.length ? (
        <div className="statusbar__notices" ref={popRef}>
          <button
            type="button"
            className={`statusbar__notice-btn${warnCount ? ' is-warn' : ''}`}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {warnCount ? '⚠' : 'ⓘ'} 版面提示 {notices.length}
          </button>
          <AnimatePresence>
            {open ? (
            <motion.div
              key="notices"
              className="notice-pop"
              role="dialog"
              aria-label="版面提示"
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.98, pointerEvents: 'none' }}
              transition={{ duration: 0.18, ease: easeOut }}
              style={{ transformOrigin: 'right bottom' }}
            >
              <ul>
                {notices.map((n, index) => (
                  <motion.li
                    key={n.key}
                    className={`notice-pop__item is-${n.tone}`}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18, delay: Math.min(index * 0.03, 0.12), ease: easeOut }}
                  >
                    <span>{n.text}</span>
                    {n.target ? (
                      <button
                        type="button"
                        className="text-btn"
                        onClick={() => {
                          const target = n.target!
                          dispatch({ type: 'SELECT_BLOCK', ref: target })
                          const page = flow.blocks.find((b) => b.ref.id === target.id)?.page
                          if (page !== undefined) onLocate(page)
                          setOpen(false)
                        }}
                      >
                        查看
                      </button>
                    ) : null}
                  </motion.li>
                ))}
              </ul>
            </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      ) : null}
      <motion.span
        key={saveKey}
        className={`statusbar__save${saveStatus.state === 'error' ? ' is-error' : ''}`}
        initial={{ opacity: 0 }}
        animate={saveStatus.state === 'saving' ? { opacity: [0.45, 1, 0.45] } : { opacity: 1 }}
        transition={
          saveStatus.state === 'saving'
            ? { duration: 1.15, repeat: Infinity, ease: 'easeInOut' }
            : { duration: 0.18 }
        }
      >
        {save}
        {backupNote}
      </motion.span>
      <span className="statusbar__version" title="應用程式版本">
        v{APP_VERSION}
      </span>
    </motion.footer>
  )
}
