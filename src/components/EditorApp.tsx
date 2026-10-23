import type Konva from 'konva'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { easeOut, fadeEase, layoutSpring, paneVariants } from '../motion/presets'
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
import { FontPanel } from './panels/FontPanel'
import { Icon, type IconName } from './ui'
import './editor.css'

type SideTab = 'outline' | 'layout' | 'font' | 'insert' | 'page'

const SIDE_TABS: { id: SideTab; label: string; icon: IconName }[] = [
  { id: 'outline', label: '大綱', icon: 'outline' },
  { id: 'layout', label: '版型', icon: 'layout' },
  { id: 'font', label: '字體', icon: 'font' },
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
  const [tabDir, setTabDir] = useState(1)
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

  const selectTab = (id: SideTab) => {
    const next = SIDE_TABS.findIndex((t) => t.id === id)
    const cur = SIDE_TABS.findIndex((t) => t.id === tab)
    setTabDir(next >= cur ? 1 : -1)
    setTab(id)
  }

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
        <motion.nav
          className="side-rail"
          aria-label="編輯面板"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.32, ease: easeOut }}
        >
          {SIDE_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`side-rail__btn${tab === t.id ? ' is-active' : ''}`}
              aria-pressed={tab === t.id}
              onClick={() => selectTab(t.id)}
            >
              {tab === t.id ? (
                <motion.span layoutId="side-rail-active" className="side-rail__mark" transition={layoutSpring} />
              ) : null}
              <Icon name={t.icon} />
              <span>{t.label}</span>
            </button>
          ))}
        </motion.nav>

        <motion.section
          className="side-panel"
          aria-label={SIDE_TABS.find((t) => t.id === tab)?.label}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.32, delay: 0.04, ease: easeOut }}
        >
          <div className="side-panel__stage">
            <AnimatePresence initial={false} custom={tabDir}>
              <motion.div
                key={tab}
                className="side-panel__pane"
                custom={tabDir}
                variants={paneVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={fadeEase}
              >
                <h2 className="side-panel__title">{SIDE_TABS.find((t) => t.id === tab)?.label}</h2>
                {tab === 'outline' ? (
                  <OutlinePanel />
                ) : tab === 'layout' ? (
                  <LayoutPanel />
                ) : tab === 'font' ? (
                  <FontPanel />
                ) : tab === 'insert' ? (
                  <InsertPanel />
                ) : (
                  <PagePanel />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.section>

        <main className="canvas-area" ref={canvasAreaRef}>
          <AnimatePresence>
            {state.textPlacementMode ? (
              <motion.div
                key="place-banner"
                className="canvas-banner-slot"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={fadeEase}
              >
                <div className="canvas-banner" role="status">
                  點擊紙張放置「
                  {getTextTierLabel(state.defaultNewTextTierId, state.textLevelOverrides, state.userTextTiers)}
                  」
                  <button type="button" onClick={() => dispatch({ type: 'CANCEL_TEXT_PLACEMENT' })}>
                    取消 <kbd>Esc</kbd>
                  </button>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
          <div className="canvas-scroll">
            <AnimatePresence mode="wait">
              {saveStatus.state === 'loading' ? (
                <motion.p
                  key="loading"
                  className="canvas-loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={fadeEase}
                >
                  讀取暫存中…
                </motion.p>
              ) : (
                <motion.div key="pages" className="canvas-pages" initial={false} animate={{ opacity: 1 }}>
              {Array.from({ length: pageCount }, (_, i) => (
                <motion.div
                  key={i}
                  className={`canvas-page${state.activePage === i ? ' is-active' : ''}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.32, delay: Math.min(i * 0.045, 0.22), ease: easeOut }}
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
                </motion.div>
              ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <motion.div
            className="canvas-controls"
            role="toolbar"
            aria-label="檢視"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, delay: 0.1, ease: easeOut }}
          >
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
            <span className="canvas-controls__zoom">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={Math.round(scale * 100)}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.16, ease: easeOut }}
                >
                  {Math.round(scale * 100)}%
                </motion.span>
              </AnimatePresence>
            </span>
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
          </motion.div>
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
