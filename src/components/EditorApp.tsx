import type Konva from 'konva'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { getTextTierLabel, pxToMm } from '../types/document'
import { EditorProvider, useEditor } from '../editor/EditorContext'
import { Inspector } from './Inspector'
import { PaperStage } from './PaperStage'
import { TextEditOverlay } from './TextEditOverlay'
import { TopBar } from './TopBar'
import { InsertPanel } from './panels/InsertPanel'
import { LayoutPanel } from './panels/LayoutPanel'
import { PagePanel } from './panels/PagePanel'
import { Icon, type IconName } from './ui'
import './editor.css'

type SideTab = 'layout' | 'insert' | 'page'

const SIDE_TABS: { id: SideTab; label: string; icon: IconName }[] = [
  { id: 'layout', label: '版型', icon: 'layout' },
  { id: 'insert', label: '插入', icon: 'insert' },
  { id: 'page', label: '頁面', icon: 'page' },
]

const ZOOM_STEPS = [0.5, 0.67, 0.75, 0.9, 1, 1.25, 1.5, 2]

function EditorShell() {
  const { state, dispatch } = useEditor()
  const stageRef = useRef<Konva.Stage>(null)
  const canvasAreaRef = useRef<HTMLDivElement>(null)
  const [fitScale, setFitScale] = useState(1)
  const [zoom, setZoom] = useState<number | 'fit'>('fit')
  const [showGuides, setShowGuides] = useState(true)
  const [tab, setTab] = useState<SideTab>('layout')
  const [editingId, setEditingId] = useState<string | null>(null)
  const scale = zoom === 'fit' ? fitScale : zoom

  useLayoutEffect(() => {
    const el = canvasAreaRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect()
      const pad = 64
      const sx = (r.width - pad) / state.pageWidth
      const sy = (r.height - pad) / state.pageHeight
      setFitScale(Math.max(0.3, Math.min(1.25, sx, sy)))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [state.pageWidth, state.pageHeight])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.tagName === 'SELECT') return
      if (e.key === 'Escape') {
        if (state.textPlacementMode) dispatch({ type: 'CANCEL_TEXT_PLACEMENT' })
        else if (state.selectedId) dispatch({ type: 'SELECT', id: null })
        return
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedId) {
        e.preventDefault()
        dispatch({ type: 'DELETE_SELECTED' })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dispatch, state.selectedId, state.textPlacementMode])

  const handleTextDoubleClick = useCallback((id: string) => {
    setEditingId(id)
  }, [])

  const stepZoom = (dir: 1 | -1) => {
    const cur = scale
    const next =
      dir > 0 ? ZOOM_STEPS.find((z) => z > cur + 0.001) : [...ZOOM_STEPS].reverse().find((z) => z < cur - 0.001)
    if (next) setZoom(next)
  }

  const selected = state.selectedId ? state.objects.find((o) => o.id === state.selectedId) : null

  return (
    <div className="editor-root">
      <TopBar stageRef={stageRef} />
      <div className="editor-body">
        <nav className="side-rail" aria-label="編輯面板">
          {SIDE_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`side-rail__btn${tab === t.id ? ' is-active' : ''}`}
              aria-pressed={tab === t.id}
              onClick={() => setTab(t.id)}
            >
              <Icon name={t.icon} />
              <span>{t.label}</span>
            </button>
          ))}
        </nav>

        <section className="side-panel" aria-label={SIDE_TABS.find((t) => t.id === tab)?.label}>
          <h2 className="side-panel__title">{SIDE_TABS.find((t) => t.id === tab)?.label}</h2>
          {tab === 'layout' ? <LayoutPanel /> : tab === 'insert' ? <InsertPanel /> : <PagePanel />}
        </section>

        <main className="canvas-area" ref={canvasAreaRef}>
          {state.textPlacementMode ? (
            <div className="canvas-banner" role="status">
              點擊紙張放置「
              {getTextTierLabel(state.defaultNewTextTierId, state.textLevelOverrides, state.userTextTiers)}
              」
              <button type="button" onClick={() => dispatch({ type: 'CANCEL_TEXT_PLACEMENT' })}>
                取消 <kbd>Esc</kbd>
              </button>
            </div>
          ) : null}
          <div className="canvas-scroll">
            <div className="canvas-inner">
              <PaperStage
                ref={stageRef}
                scale={scale}
                showGuides={showGuides}
                onTextDoubleClick={handleTextDoubleClick}
              />
              <TextEditOverlay editingId={editingId} scale={scale} onClose={() => setEditingId(null)} />
            </div>
          </div>
          <div className="canvas-controls" role="toolbar" aria-label="檢視">
            <button
              type="button"
              className={`icon-btn${showGuides ? ' is-active' : ''}`}
              title="顯示版面輔助線（不會輸出到 PDF）"
              aria-pressed={showGuides}
              onClick={() => setShowGuides((v) => !v)}
            >
              <Icon name="grid" />
            </button>
            <span className="canvas-controls__sep" aria-hidden />
            <button type="button" className="icon-btn" title="縮小" onClick={() => stepZoom(-1)}>
              <Icon name="minus" />
            </button>
            <span className="canvas-controls__zoom">{Math.round(scale * 100)}%</span>
            <button type="button" className="icon-btn" title="放大" onClick={() => stepZoom(1)}>
              <Icon name="plus" />
            </button>
            <button
              type="button"
              className={`icon-btn${zoom === 'fit' ? ' is-active' : ''}`}
              title="符合視窗"
              onClick={() => setZoom('fit')}
            >
              <Icon name="fit" />
            </button>
          </div>
        </main>

        <Inspector />
      </div>
      <footer className="statusbar">
        <span>
          {state.pageWidth}×{state.pageHeight}px・約 {pxToMm(state.pageWidth)}×{pxToMm(state.pageHeight)}mm
        </span>
        <span>{state.objects.length} 個物件</span>
        {selected ? <span className="statusbar__sel">已選取 1 個物件</span> : null}
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
