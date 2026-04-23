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
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const t = e.target as HTMLElement
        if (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT') return
        if (state.selectedId) {
          e.preventDefault()
          dispatch({ type: 'DELETE_SELECTED' })
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dispatch, state.selectedId])

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
