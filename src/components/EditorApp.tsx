import { useCallback, useRef, useState } from 'react'

import type Konva from 'konva'
import { AnimatePresence, motion } from 'motion/react'

import { EditorProvider, useEditor } from '../editor/EditorContext'
import { easeOut, fadeEase, layoutSpring, paneVariants } from '../motion/presets'
import { getTextTierLabel } from '../types/document'
import { ContactPage } from './ContactPage'
import { Inspector } from './Inspector'
import { InsertPanel } from './panels/InsertPanel'
import { OutlinePanel } from './panels/OutlinePanel'
import { SheetPanel, SheetSwitch, type SheetView } from './panels/SheetPanel'
import { PaperStage } from './PaperStage'
import { focusKeyOf, SIDE_TABS, type SideTab,tabForFocusKey, taskHint } from './shell/sideTabs'
import { useCanvasZoom } from './shell/useCanvasZoom'
import { useContactRoute } from './shell/useContactRoute'
import { useEditorHotkeys } from './shell/useEditorHotkeys'
import { StatusBar } from './StatusBar'
import { TextEditOverlay } from './TextEditOverlay'
import { TopBar } from './TopBar'
import { Icon } from './ui'

import './editor.css'

function EditorShell() {
  const { state, dispatch, pageCount, saveStatus } = useEditor()
  const focusKey = focusKeyOf(state.selectedBlock, state.selectedId)
  const stagesRef = useRef<(Konva.Stage | null)[]>([])
  const pageElsRef = useRef<(HTMLDivElement | null)[]>([])
  const { contactOpen, openContact, closeContact } = useContactRoute()
  useEditorHotkeys(contactOpen, closeContact)
  const { canvasAreaRef, canvasScrollRef, scale, zoom, setZoom, stepZoom } = useCanvasZoom(
    state.pageWidth,
    state.pageHeight,
  )
  const [tab, setTab] = useState<SideTab>(() => (focusKey ? tabForFocusKey(focusKey) : 'questions'))
  const [sheetView, setSheetView] = useState<SheetView>('header')
  const [tabDir, setTabDir] = useState(1)
  const [seenFocus, setSeenFocus] = useState(focusKey)
  if (focusKey !== seenFocus) {
    setSeenFocus(focusKey)
    if (focusKey) {
      const next = tabForFocusKey(focusKey)
      if (next !== tab) {
        const cur = SIDE_TABS.findIndex((item) => item.id === tab)
        const nxt = SIDE_TABS.findIndex((item) => item.id === next)
        setTabDir(nxt >= cur ? 1 : -1)
        setTab(next)
      }
      if (focusKey.startsWith('header:')) setSheetView('header')
    }
  }
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showGuides, setShowGuides] = useState(true)

  const selectTab = (id: SideTab) => {
    const next = SIDE_TABS.findIndex((item) => item.id === id)
    const cur = SIDE_TABS.findIndex((item) => item.id === tab)
    setTabDir(next >= cur ? 1 : -1)
    setTab(id)
  }

  const editingPage = editingId ? (state.objects.find((object) => object.id === editingId)?.page ?? 0) : -1
  const locatePage = useCallback((page: number) => {
    pageElsRef.current[page]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])
  const activeTab = SIDE_TABS.find((item) => item.id === tab)

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
            {SIDE_TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`side-rail__btn${tab === item.id ? ' is-active' : ''}`}
                aria-pressed={tab === item.id}
                title={item.title}
                onClick={() => selectTab(item.id)}
              >
                {tab === item.id ? (
                  <motion.span layoutId="side-rail-active" className="side-rail__mark" transition={layoutSpring} />
                ) : null}
                <Icon name={item.icon} />
                <span>{item.label}</span>
              </button>
            ))}
          </motion.nav>

          <motion.section
            className="side-panel"
            aria-label={activeTab?.label}
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
                  <h2 className="side-panel__title">{activeTab?.label}</h2>
                  {tab === 'sheet' ? <SheetSwitch view={sheetView} onView={setSheetView} /> : null}
                  <p className="side-panel__hint">{taskHint(tab, sheetView, state)}</p>
                  {tab === 'questions' ? <OutlinePanel /> : tab === 'sheet' ? <SheetPanel view={sheetView} /> : <InsertPanel />}
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
                    {Array.from({ length: pageCount }, (_, pageIndex) => (
                      <motion.div
                        key={pageIndex}
                        className={`canvas-page${state.activePage === pageIndex ? ' is-active' : ''}`}
                        initial={false}
                        ref={(el) => {
                          pageElsRef.current[pageIndex] = el
                        }}
                      >
                        <div className="canvas-page__label">
                          第 {pageIndex + 1} 頁 <span>/ 共 {pageCount} 頁</span>
                        </div>
                        <div className="canvas-inner">
                          <PaperStage
                            ref={(stage) => {
                              stagesRef.current[pageIndex] = stage
                            }}
                            pageIndex={pageIndex}
                            scale={scale}
                            showGuides={showGuides}
                            onTextDoubleClick={setEditingId}
                          />
                          {editingPage === pageIndex ? (
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
                onClick={() => setShowGuides((value) => !value)}
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
