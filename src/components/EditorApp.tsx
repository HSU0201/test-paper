import type Konva from 'konva'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { easeOut, fadeEase, layoutSpring, paneVariants } from '../motion/presets'
import { getTextTierLabel } from '../types/document'
import { questionNumbers, type BlockRef } from '../types/exam'
import { ContactPage } from './ContactPage'
import { StatusBar } from './StatusBar'
import { EditorProvider, useEditor } from '../editor/EditorContext'
import { Inspector } from './Inspector'
import { PaperStage } from './PaperStage'
import { TextEditOverlay } from './TextEditOverlay'
import { TopBar } from './TopBar'
import { InsertPanel } from './panels/InsertPanel'
import { OutlinePanel } from './panels/OutlinePanel'
import { SheetPanel, SheetSwitch, type SheetView } from './panels/SheetPanel'
import { Icon, type IconName } from './ui'
import './editor.css'

type SideTab = 'questions' | 'sheet' | 'decorate'

const SIDE_TABS: { id: SideTab; label: string; icon: IconName; title: string }[] = [
  { id: 'questions', label: '出題', icon: 'outline', title: '題目順序' },
  { id: 'sheet', label: '卷面', icon: 'page', title: '頁首、紙張、字級' },
  { id: 'decorate', label: '物件', icon: 'insert', title: '線條、方框、圖片與自由文字' },
]

function tabForSelection(block: BlockRef | null, selectedId: string | null): SideTab {
  if (block?.kind === 'header') return 'sheet'
  if (block) return 'questions'
  if (selectedId) return 'decorate'
  return 'questions'
}

const ZOOM_STEPS = [0.5, 0.67, 0.75, 0.9, 1, 1.25, 1.5, 2]

function isTypingTarget(target: EventTarget | null) {
  const el =
    target instanceof HTMLElement
      ? target
      : document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
  if (!el) return false
  const tag = el.tagName
  if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT') return true
  return el.isContentEditable || !!el.closest('[contenteditable="true"]')
}

function focusKeyOf(block: BlockRef | null, selectedId: string | null) {
  if (block) return `${block.kind}:${block.id}`
  if (selectedId) return `obj:${selectedId}`
  return ''
}

function tabForFocusKey(focusKey: string): SideTab {
  if (focusKey.startsWith('obj:')) return 'decorate'
  if (focusKey.startsWith('header:')) return 'sheet'
  return 'questions'
}

function EditorShell() {
  const { state, dispatch, undo, redo, pageCount, saveStatus } = useEditor()
  const focusKey = focusKeyOf(state.selectedBlock, state.selectedId)
  const stagesRef = useRef<(Konva.Stage | null)[]>([])
  const pageElsRef = useRef<(HTMLDivElement | null)[]>([])
  const canvasAreaRef = useRef<HTMLDivElement>(null)
  const canvasScrollRef = useRef<HTMLDivElement>(null)
  const scaleRef = useRef(1)
  const zoomAnchor = useRef<{
    pageIndex: number
    fx: number
    fy: number
    clientX: number
    clientY: number
  } | null>(null)
  const [fitScale, setFitScale] = useState(1)
  const [zoom, setZoom] = useState<number | 'fit'>('fit')
  const [showGuides, setShowGuides] = useState(true)
  const [tab, setTab] = useState<SideTab>(() => tabForSelection(state.selectedBlock, state.selectedId))
  const [sheetView, setSheetView] = useState<SheetView>('header')
  const [tabDir, setTabDir] = useState(1)
  const [seenFocus, setSeenFocus] = useState(focusKey)
  if (focusKey !== seenFocus) {
    setSeenFocus(focusKey)
    if (focusKey) {
      const next = tabForFocusKey(focusKey)
      if (next !== tab) {
        const cur = SIDE_TABS.findIndex((t) => t.id === tab)
        const nxt = SIDE_TABS.findIndex((t) => t.id === next)
        setTabDir(nxt >= cur ? 1 : -1)
        setTab(next)
      }
      if (focusKey.startsWith('header:')) setSheetView('header')
    }
  }
  const [editingId, setEditingId] = useState<string | null>(null)
  const [contactOpen, setContactOpen] = useState(() => window.location.hash === '#contact')
  const scale = zoom === 'fit' ? fitScale : zoom
  scaleRef.current = scale

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
    const sync = () => setContactOpen(window.location.hash === '#contact')
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])

  const openContact = useCallback(() => {
    if (window.location.hash !== '#contact') window.location.hash = 'contact'
    else setContactOpen(true)
  }, [])

  const closeContact = useCallback(() => {
    if (window.location.hash === '#contact') {
      const next = `${window.location.pathname}${window.location.search}`
      window.history.replaceState(null, '', next)
    }
    setContactOpen(false)
  }, [])

  useEffect(() => {
    const prev = document.title
    if (contactOpen) document.title = '聯繫開發者 — 試卷編輯器'
    return () => {
      document.title = prev
    }
  }, [contactOpen])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (contactOpen) {
        if (e.key === 'Escape') closeContact()
        return
      }
      if (isTypingTarget(e.target) || isTypingTarget(document.activeElement)) return
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
  }, [contactOpen, closeContact, dispatch, undo, redo, state.selectedId, state.selectedBlock, state.textPlacementMode])

  const handleTextDoubleClick = useCallback((id: string) => {
    setEditingId(id)
  }, [])

  const selectTab = (id: SideTab) => {
    const next = SIDE_TABS.findIndex((t) => t.id === id)
    const cur = SIDE_TABS.findIndex((t) => t.id === tab)
    setTabDir(next >= cur ? 1 : -1)
    setTab(id)
  }

  const taskHint = (() => {
    if (tab === 'sheet') {
      if (sheetView === 'header') return '學校、科目、座號、姓名。點卷上的頁首文字也會打開這裡。'
      if (sheetView === 'paper') return '紙張大小、分欄、行距與頁邊距。'
      return '全卷的字型與字級。某一題要不同，回到「出題」點那一題，在右側打開「單獨設定」。'
    }
    if (tab === 'decorate') return '固定在某一頁的文字、線條、方框、圖片。題目請在「出題」新增。'
    const block = state.selectedBlock
    if (block?.kind === 'question') {
      const num = questionNumbers(state.exam).get(block.id)
      return num ? `正在編輯第 ${num} 題。題幹、選項與配分在右側。` : '正在編輯這一題。內容在右側。'
    }
    if (block?.kind === 'section') return '正在編輯這個大題。名稱、說明與配分在右側；小題請點下面的列。'
    if (block?.kind === 'notice') return '頁尾文字在右側。'
    return '由上到下就是卷上的順序。點一題，右側就是這一題的內容。'
  })()

  const stepZoom = (dir: 1 | -1) => {
    const cur = scaleRef.current
    const next =
      dir > 0 ? ZOOM_STEPS.find((z) => z > cur + 0.001) : [...ZOOM_STEPS].reverse().find((z) => z < cur - 0.001)
    if (next) setZoom(next)
    return next
  }

  useEffect(() => {
    const el = canvasAreaRef.current
    if (!el) return
    let pending = 0
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const line = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1
      pending += e.deltaY * line
      if (Math.abs(pending) < 40) return
      const dir: 1 | -1 = pending > 0 ? -1 : 1
      pending = 0
      const cur = scaleRef.current
      const next =
        dir > 0 ? ZOOM_STEPS.find((z) => z > cur + 0.001) : [...ZOOM_STEPS].reverse().find((z) => z < cur - 0.001)
      if (!next) return
      const scroller = canvasScrollRef.current
      const hit = e.target instanceof Element ? e.target.closest('.canvas-page') : null
      const paper = hit?.querySelector('.paper-stage-wrap')
      if (scroller && hit && paper) {
        const pages = [...scroller.querySelectorAll('.canvas-page')]
        const rect = paper.getBoundingClientRect()
        if (rect.width > 0 && rect.height > 0) {
          zoomAnchor.current = {
            pageIndex: pages.indexOf(hit),
            fx: (e.clientX - rect.left) / rect.width,
            fy: (e.clientY - rect.top) / rect.height,
            clientX: e.clientX,
            clientY: e.clientY,
          }
        }
      }
      setZoom(next)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  useLayoutEffect(() => {
    const anchor = zoomAnchor.current
    const scroller = canvasScrollRef.current
    if (!anchor || !scroller || anchor.pageIndex < 0) return
    zoomAnchor.current = null
    const paper = scroller.querySelectorAll('.canvas-page')[anchor.pageIndex]?.querySelector('.paper-stage-wrap')
    if (!paper) return
    const rect = paper.getBoundingClientRect()
    scroller.scrollLeft += rect.left + anchor.fx * rect.width - anchor.clientX
    scroller.scrollTop += rect.top + anchor.fy * rect.height - anchor.clientY
  }, [scale])

  const editingPage = editingId ? (state.objects.find((o) => o.id === editingId)?.page ?? 0) : -1
  const locatePage = useCallback((page: number) => {
    pageElsRef.current[page]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  return (
    <div className="editor-root">
      {contactOpen ? <ContactPage onBack={closeContact} /> : null}
      <div className="editor-root__work" hidden={contactOpen}>
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
              title={t.title}
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
                {tab === 'sheet' ? <SheetSwitch view={sheetView} onView={setSheetView} /> : null}
                <p className="side-panel__hint">{taskHint}</p>
                {tab === 'questions' ? (
                  <OutlinePanel />
                ) : tab === 'sheet' ? (
                  <SheetPanel view={sheetView} />
                ) : (
                  <InsertPanel />
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
          <div className="canvas-scroll" ref={canvasScrollRef}>
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
            <button type="button" className="icon-btn" title="縮小（Ctrl + 滾輪）" onClick={() => stepZoom(-1)}>
              <Icon name="minus" />
            </button>
            <span className="canvas-controls__zoom" title="Ctrl + 滾輪可縮放考卷">
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
            <button type="button" className="icon-btn" title="放大（Ctrl + 滾輪）" onClick={() => stepZoom(1)}>
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
      <StatusBar onLocate={locatePage} onContact={openContact} />
      </div>
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
