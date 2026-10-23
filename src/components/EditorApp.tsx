import type Konva from 'konva'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { getTextTierLabel } from '../types/document'
import { StatusBar } from './StatusBar'
import { EditorProvider, useEditor } from '../editor/EditorContext'
import { Inspector } from './Inspector'
import { PaperStage } from './PaperStage'
import { TextEditOverlay } from './TextEditOverlay'
import { TopBar } from './TopBar'
import { InsertPanel } from './panels/InsertPanel'
import { LayoutPanel } from './panels/LayoutPanel'
import { OutlinePanel } from './panels/OutlinePanel'
import { PagePanel } from './panels/PagePanel'
import { Icon, type IconName } from './ui'
import './editor.css'

type SideTab = 'outline' | 'layout' | 'insert' | 'page'

const SIDE_TABS: { id: SideTab; label: string; icon: IconName }[] = [
  { id: 'outline', label: '大綱', icon: 'outline' },
  { id: 'layout', label: '版型', icon: 'layout' },
  { id: 'insert', label: '插入', icon: 'insert' },
  { id: 'page', label: '頁面', icon: 'page' },
]

const ZOOM_STEPS = [0.5, 0.67, 0.75, 0.9, 1, 1.25, 1.5, 2]

function EditorShell() {
  const { state, dispatch, undo, redo, pageCount, saveStatus } = useEditor()
  const stagesRef = useRef<(Konva.Stage | null)[]>([])
  const pageElsRef = useRef<(HTMLDivElement | null)[]>([])
  const canvasAreaRef = useRef<HTMLDivElement>(null)
  const [fitScale, setFitScale] = useState(1)
  const [zoom, setZoom] = useState<number | 'fit'>('fit')
  const [showGuides, setShowGuides] = useState(true)
  const [tab, setTab] = useState<SideTab>('outline')
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
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        redo()
        return
      }
      if (e.key === 'Escape') {
        if (state.textPlacementMode) dispatch({ type: 'CANCEL_TEXT_PLACEMENT' })
        else if (state.selectedId) dispatch({ type: 'SELECT', id: null })
        else if (state.selectedBlock) dispatch({ type: 'SELECT_BLOCK', ref: null })
        return
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && (state.selectedId || state.selectedBlock)) {
        e.preventDefault()
        dispatch({ type: 'DELETE_SELECTED' })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dispatch, undo, redo, state.selectedId, state.selectedBlock, state.textPlacementMode])

  const handleTextDoubleClick = useCallback((id: string) => {
    setEditingId(id)
  }, [])

  const stepZoom = (dir: 1 | -1) => {
    const cur = scale
    const next =
      dir > 0 ? ZOOM_STEPS.find((z) => z > cur + 0.001) : [...ZOOM_STEPS].reverse().find((z) => z < cur - 0.001)
    if (next) setZoom(next)
  }

  const editingPage = editingId ? (state.objects.find((o) => o.id === editingId)?.page ?? 0) : -1
  const locatePage = useCallback((page: number) => {
    pageElsRef.current[page]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  return (
    <div className="editor-root">
      <TopBar stagesRef={stagesRef} />
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
          {tab === 'outline' ? (
            <OutlinePanel />
          ) : tab === 'layout' ? (
            <LayoutPanel />
          ) : tab === 'insert' ? (
            <InsertPanel />
          ) : (
            <PagePanel />
          )}
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
            {saveStatus.state === 'loading' ? <p className="canvas-loading">讀取暫存中…</p> : null}
            <div className="canvas-pages" hidden={saveStatus.state === 'loading'}>
              {Array.from({ length: pageCount }, (_, i) => (
                <div
                  key={i}
                  className={`canvas-page${state.activePage === i ? ' is-active' : ''}`}
                  ref={(el) => {
                    pageElsRef.current[i] = el
                  }}
                >
                  <div className="canvas-page__label">
                    第 {i + 1} 頁 <span>/ 共 {pageCount} 頁</span>
                  </div>
                  <div className="canvas-inner">
                    <PaperStage
                      ref={(s) => {
                        stagesRef.current[i] = s
                      }}
                      pageIndex={i}
                      scale={scale}
                      showGuides={showGuides}
                      onTextDoubleClick={handleTextDoubleClick}
                    />
                    {editingPage === i ? (
                      <TextEditOverlay editingId={editingId} scale={scale} onClose={() => setEditingId(null)} />
                    ) : null}
                  </div>
                </div>
              ))}
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
      <StatusBar onLocate={locatePage} />
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
