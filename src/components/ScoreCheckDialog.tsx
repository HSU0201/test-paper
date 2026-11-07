import { useEffect } from 'react'
import { createPortal } from 'react-dom'

import { AnimatePresence } from 'motion/react'

import { useEditor } from '../editor/EditorContext'
import type { ScoreCheck } from '../editor/scoreCheck'
import { MotionDialog } from './MotionDialog'
import { requestReveal } from './shell/revealBlock'
import { NumberField } from './ui'

export function ScoreCheckDialog({ open, check, onClose }: { open: boolean; check: ScoreCheck; onClose: () => void }) {
  const { dispatch } = useEditor()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const errors = check.issues.filter((i) => i.level === 'error').length
  const warns = check.issues.length - errors
  const mount = document.querySelector('.editor-root')
  if (!mount) return null

  return createPortal(
    <AnimatePresence>
      {open ? (
        <MotionDialog key="score-check" className="score-check" titleId="score-check-title" onClose={onClose}>
          <h3 id="score-check-title" className="text-level-dialog__title">
            配分檢查
          </h3>
          <div className="score-check__head">
            <div className="score-check__total">
              <strong>{check.total}</strong>
              <span>目前總分</span>
            </div>
            <NumberField
              label="滿分"
              value={check.fullScore}
              min={1}
              step={1}
              suffix="分"
              onChange={(v) => dispatch({ type: 'SET_FULL_SCORE', value: v > 0 ? v : undefined })}
            />
          </div>
          {check.issues.length ? (
            <>
              <p className="score-check__summary">
                {errors ? `${errors} 個一定要改` : ''}
                {errors && warns ? '，' : ''}
                {warns ? `${warns} 個請看一下` : ''}。
              </p>
              <ul className="score-check__list">
                {check.issues.map((issue, index) => (
                  <li key={index} className={`score-check__item is-${issue.level}`}>
                    <span>{issue.text}</span>
                    {issue.ref ? (
                      <button
                        type="button"
                        className="text-btn"
                        onClick={() => {
                          const ref = issue.ref!
                          dispatch({ type: 'SELECT_BLOCK', ref })
                          requestReveal(ref.id)
                          onClose()
                        }}
                      >
                        查看
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="score-check__ok">總分等於滿分，每一題都有分數和答案。</p>
          )}
          <div className="text-level-dialog__footer">
            <button type="button" className="text-level-dialog__btn text-level-dialog__btn--ghost" onClick={onClose}>
              關閉
            </button>
          </div>
        </MotionDialog>
      ) : null}
    </AnimatePresence>,
    mount,
  )
}
