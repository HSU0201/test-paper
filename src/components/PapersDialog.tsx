import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

import { AnimatePresence } from 'motion/react'

import { readCurrentId, writeCurrentId } from '../editor/currentPaper'
import { documentBaseName, serializeDocument, toLoadAction } from '../editor/documentIO'
import { useEditor } from '../editor/EditorContext'
import { deleteLibraryItem, type LibraryItem, listLibrary, onLibraryChange, saveLibraryItem } from '../editor/persist'
import type { EditorState } from '../types/document'
import { MotionDialog } from './MotionDialog'

type PaperDoc = ReturnType<typeof serializeDocument>

function questionCount(state: EditorState) {
  return state.exam.sections.reduce((n, s) => n + s.questions.length, 0)
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function formatWhen(at: number) {
  const d = new Date(at)
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * 把目前的試卷存進「我的考卷」。沒有題目時不存。
 * 原本就是從清單打開、名稱也沒換的，覆蓋同一份；否則另存一份。
 */
async function stashCurrent(state: EditorState, items: LibraryItem<PaperDoc>[]): Promise<string | null> {
  if (!state.exam.sections.length) return null
  const name = documentBaseName(state)
  const currentId = readCurrentId()
  const same = items.find((it) => it.id === currentId && it.name === name)
  const saved = await saveLibraryItem<PaperDoc>({
    id: same?.id,
    kind: 'paper',
    name,
    note: `${state.exam.sections.length} 大題・${questionCount(state)} 題`,
    data: serializeDocument(state),
  })
  writeCurrentId(saved.id)
  return saved.id
}

/** 「我的考卷」：同時保留好幾份試卷（例如數學出到一半，先去出國語），隨時切換 */
export function PapersDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, dispatch } = useEditor()
  const [items, setItems] = useState<LibraryItem<PaperDoc>[]>([])
  const [busy, setBusy] = useState(false)

  const reload = useCallback(() => {
    listLibrary<PaperDoc>('paper').then(setItems, () => setItems([]))
  }, [])

  useEffect(() => {
    if (!open) return
    reload()
    return onLibraryChange(reload)
  }, [open, reload])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const fail = () => window.alert('存不進「我的考卷」。瀏覽器可能關掉了網站資料，請先按「儲存」下載到電腦。')

  const run = async (job: () => Promise<void>) => {
    setBusy(true)
    try {
      await job()
    } catch {
      fail()
    } finally {
      setBusy(false)
    }
  }

  const saveNow = () => run(async () => void (await stashCurrent(state, items)))

  const startNew = () =>
    run(async () => {
      await stashCurrent(state, items)
      writeCurrentId(null)
      dispatch({ type: 'RESET' })
      onClose()
    })

  const openPaper = (item: LibraryItem<PaperDoc>) =>
    run(async () => {
      const action = toLoadAction(item.data)
      if (!action) {
        window.alert('這份考卷的格式無法開啟。')
        return
      }
      if (readCurrentId() !== item.id) await stashCurrent(state, items)
      dispatch(action)
      writeCurrentId(item.id)
      onClose()
    })

  const removePaper = (item: LibraryItem<PaperDoc>) => {
    if (!window.confirm(`從「我的考卷」刪掉「${item.name}」？刪掉後無法復原。`)) return
    void deleteLibraryItem(item.id).then(() => {
      if (readCurrentId() === item.id) writeCurrentId(null)
    }, fail)
  }

  const currentId = readCurrentId()
  const currentName = documentBaseName(state)

  const mount = document.querySelector('.editor-root')
  if (!mount) return null

  return createPortal(
    <AnimatePresence>
      {open ? (
        <MotionDialog key="papers" className="backup-dialog" titleId="papers-dialog-title" onClose={onClose}>
          <h3 id="papers-dialog-title" className="text-level-dialog__title">
            我的考卷
          </h3>
          <p className="text-level-dialog__intro">
            可以同時出好幾份考卷。按「出新考卷」或打開另一份時，目前這份會先自動存進清單，之後點「打開」就能接著出。考卷存在這台瀏覽器裡；要換電腦請另外按「儲存」下載。
          </p>
          <div className="backup-dialog__actions">
            <button type="button" className="btn btn--ghost" disabled={busy || !state.exam.sections.length} onClick={() => void saveNow()}>
              存下目前這份
            </button>
            <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void startNew()}>
              出新考卷（換科目）
            </button>
          </div>
          <h4 className="backup-dialog__list-title">已存的考卷</h4>
          {items.length === 0 ? (
            <p className="backup-dialog__empty">還沒有存過。按「出新考卷」時，目前這份「{currentName}」會先存到這裡。</p>
          ) : (
            <ul className="backup-dialog__list">
              {items.map((item) => (
                <li key={item.id} className="backup-dialog__row">
                  <span className="backup-dialog__time">
                    {item.name}
                    {item.id === currentId ? <span className="backup-dialog__tag">編輯中</span> : null}
                    <small className="papers-dialog__note">
                      {item.note}・{formatWhen(item.savedAt)}
                    </small>
                  </span>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    disabled={busy || item.id === currentId}
                    onClick={() => void openPaper(item)}
                  >
                    打開
                  </button>
                  <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => removePaper(item)}>
                    刪除
                  </button>
                </li>
              ))}
            </ul>
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
