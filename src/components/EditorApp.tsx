import type Konva from 'konva'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { pxToMm } from '../types/document'
import { EditorProvider, useEditor } from '../editor/EditorContext'
import { PaperStage } from './PaperStage'
import { PropertiesPanel } from './PropertiesPanel'
import { TextEditOverlay } from './TextEditOverlay'
import { Toolbar } from './Toolbar'
import './editor.css'

function EditorShell() {
  const { state, dispatch } = useEditor()
  const stageRef = useRef<Konva.Stage>(null)
  const canvasAreaRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [editingId, setEditingId] = useState<string | null>(null)

  useLayoutEffect(() => {
    const el = canvasAreaRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect()
      const pad = 32
      const sx = (r.width - pad) / state.pageWidth
      const sy = (r.height - pad) / state.pageHeight
      setScale(Math.max(0.35, Math.min(1, sx, sy)))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [state.pageWidth, state.pageHeight])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT') return
      if (e.key === 'Escape' && state.textPlacementMode) {
        e.preventDefault()
        dispatch({ type: 'CANCEL_TEXT_PLACEMENT' })
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (state.selectedId) {
          e.preventDefault()
          dispatch({ type: 'DELETE_SELECTED' })
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dispatch, state.selectedId, state.textPlacementMode])

  const handleTextDoubleClick = useCallback((id: string) => {
    setEditingId(id)
  }, [])

  return (
    <div className="editor-root">
      <Toolbar stageRef={stageRef} />
      <div className="editor-body">
        <main className="editor-canvas-area" ref={canvasAreaRef}>
          <div className="editor-canvas-inner">
            <PaperStage
              ref={stageRef}
              scale={scale}
              onTextDoubleClick={handleTextDoubleClick}
            />
            <TextEditOverlay
              editingId={editingId}
              scale={scale}
              onClose={() => setEditingId(null)}
            />
          </div>
        </main>
        <PropertiesPanel />
      </div>
      <footer className="editor-footer">
        工作區 {state.pageWidth}×{state.pageHeight} px（約 {pxToMm(state.pageWidth)}×{pxToMm(state.pageHeight)}{' '}
        mm）· 拖曳時會對齊邊緣與中心 · 雙擊文字可編輯內容
        {state.textPlacementMode ? (
          <>
            {' '}
            · <strong>放置文字模式</strong>：空白處點一下建立文字；點既有文字可取消放置並選取編輯（Esc
            或「取消放置文字」可離開）
          </>
        ) : null}
      </footer>
    </div>
  )
}

export function EditorApp() {
  return (
    <EditorProvider>
      <EditorShell />
    </EditorProvider>
  )
}
