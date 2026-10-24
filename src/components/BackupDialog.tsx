import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { AnimatePresence, motion } from 'motion/react'

import { documentBaseName, downloadJson, readDocumentFile, serializeDocument, toLoadAction } from '../editor/documentIO'
import { useEditor } from '../editor/EditorContext'
import { loadSnapshot, MAX_SNAPSHOTS, SNAPSHOT_EVERY_MINUTES } from '../editor/persist'
import { easeOut } from '../motion/presets'
import { MotionDialog } from './MotionDialog'

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function formatWhen(at: number) {
  const d = new Date(at)
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fileStamp(at: number) {
  const d = new Date(at)
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`
}

export function BackupDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, dispatch, snapshots, backupNow, reloadSnapshots } = useEditor()
  const openRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const baseName = documentBaseName(state)

  useEffect(() => {
    if (!open) return
    void reloadSnapshots()
  }, [open, reloadSnapshots])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const downloadCurrent = () => {
    downloadJson(`${baseName}.json`, serializeDocument(state))
  }

  const downloadAt = async (at: number) => {
    const draft = await loadSnapshot(at)
    if (!draft) {
      window.alert('這份備份讀取失敗，可能已被瀏覽器清掉。')
      void reloadSnapshots()
      return
    }
    downloadJson(`${baseName}_備份_${fileStamp(at)}.json`, draft.doc)
  }

  const restoreAt = async (at: number) => {
    const draft = await loadSnapshot(at)
    if (!draft) {
      window.alert('這份備份讀取失敗，可能已被瀏覽器清掉。')
      void reloadSnapshots()
      return
    }
    const action = toLoadAction(draft.doc)
    if (!action) {
      window.alert('這份備份的格式無法還原。')
      return
    }
    const when = formatWhen(at)
    if (!window.confirm(`還原「${when}」這份備份？\n目前試卷會先自動留一份備份，還原後也可以按復原回到剛才的內容。`)) return
    dispatch(action)
  }

  const mount = document.querySelector('.editor-root')
  if (!mount) return null

  return createPortal(
    <AnimatePresence>
      {open ? (
    <MotionDialog key="backup" className="backup-dialog" titleId="backup-dialog-title" onClose={onClose}>
        <h3 id="backup-dialog-title" className="text-level-dialog__title">
          備份與還原
        </h3>
        <p className="text-level-dialog__intro">
          正在寫的內容大約一秒內會自動暫存，關掉分頁前也會再寫一次。另外每 {SNAPSHOT_EVERY_MINUTES}{' '}
          分鐘會多留一份備份（最多 {MAX_SNAPSHOTS} 份），按「清空」或「開啟」其他檔案之前也會先備份。這些備份只在這台瀏覽器；若要換電腦，或怕清除網站資料後不見，請下載
          JSON，之後可以再匯入。
        </p>
        <div className="backup-dialog__actions">
          <button type="button" className="btn btn--ghost" onClick={downloadCurrent}>
            下載目前試卷
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => openRef.current?.click()}>
            匯入 JSON
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
              if (!file) return
              if (!window.confirm('匯入會取代目前試卷。目前內容會先自動留一份備份。')) return
              readDocumentFile(file, dispatch)
            }}
          />
          <button
            type="button"
            className="btn btn--primary"
            disabled={busy}
            onClick={() => {
              setBusy(true)
              void backupNow().then((at) => {
                setBusy(false)
                if (at == null) window.alert('備份失敗。請改用「下載目前試卷」存到電腦。')
              })
            }}
          >
            {busy ? '備份中…' : '立即備份'}
          </button>
        </div>
        <h4 className="backup-dialog__list-title">本機備份</h4>
        {snapshots.length === 0 ? (
          <motion.p
            className="backup-dialog__empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2, ease: easeOut }}
          >
            還沒有備份。繼續編輯約 {SNAPSHOT_EVERY_MINUTES} 分鐘後會自動留下第一份，也可以按「立即備份」。
          </motion.p>
        ) : (
          <ul className="backup-dialog__list">
            {snapshots.map((at, index) => (
              <motion.li
                key={at}
                className="backup-dialog__row"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, delay: Math.min(index * 0.03, 0.15), ease: easeOut }}
              >
                <span className="backup-dialog__time">
                  {formatWhen(at)}
                  {index === 0 ? <span className="backup-dialog__tag">最新</span> : null}
                </span>
                <button type="button" className="btn btn--ghost" onClick={() => void restoreAt(at)}>
                  還原
                </button>
                <button type="button" className="btn btn--ghost" onClick={() => void downloadAt(at)}>
                  下載
                </button>
              </motion.li>
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
