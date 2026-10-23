import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { EditorAction } from './reducer'
import { historyReducer, initialHistory } from './history'
import { layoutExam, type FlowResult } from './flowLayout'
import { measureWithKonva } from './konvaMeasure'
import { serializeDocument, toLoadAction } from './documentIO'
import { loadDraft, saveDraft } from './persist'
import { mergeTextLevelPreset, type EditorState } from '../types/document'
import { computePageGeometry, type PageGeometry } from '../types/layout'

export type SaveStatus = { state: 'loading' | 'idle' | 'saving' | 'saved' | 'error'; at?: number }

type EditorContextValue = {
  state: EditorState
  dispatch: (a: EditorAction) => void
  sortedObjects: EditorState['objects']
  pageGeometry: (page: number) => PageGeometry
  pageCount: number
  flow: FlowResult
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  saveStatus: SaveStatus
}

const EditorContext = createContext<EditorContextValue | null>(null)

const AUTOSAVE_DELAY_MS = 800

export function EditorProvider({ children }: { children: ReactNode }) {
  const [history, dispatchHistory] = useReducer(historyReducer, undefined, initialHistory)
  const state = history.present
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ state: 'loading' })
  const hydrated = useRef(false)

  const sortedObjects = useMemo(
    () => [...state.objects].sort((a, b) => a.zIndex - b.zIndex),
    [state.objects],
  )

  const pageGeometry = useMemo(() => {
    const first = computePageGeometry(state.layout, state.pageWidth, state.pageHeight, 0)
    const rest = state.layout.header.repeat
      ? first
      : computePageGeometry(state.layout, state.pageWidth, state.pageHeight, 1)
    return (page: number): PageGeometry => (page === 0 ? first : rest)
  }, [state.layout, state.pageWidth, state.pageHeight])

  const flow = useMemo(() => {
    const o = state.textLevelOverrides
    const heading = mergeTextLevelPreset('section_heading', o)
    const instruction = mergeTextLevelPreset('instruction', o)
    const body = mergeTextLevelPreset('question_body', o)
    return layoutExam(
      state.exam,
      (page) => pageGeometry(page).frames,
      {
        heading: { fontSize: heading.fontSize, fill: '#000000', bold: heading.bold },
        instruction: { fontSize: instruction.fontSize, fill: '#000000', bold: instruction.bold },
        body: { fontSize: body.fontSize, fill: '#000000', bold: body.bold },
      },
      state.layout.spacing,
      measureWithKonva,
      state.pageWidth > state.pageHeight,
    )
  }, [state.exam, state.textLevelOverrides, state.layout.spacing, state.pageWidth, state.pageHeight, pageGeometry])

  const pageCount = useMemo(() => {
    const objMax = state.objects.reduce((m, o) => Math.max(m, (o.page ?? 0) + 1), 0)
    return Math.max(1, flow.pageCount, objMax)
  }, [flow.pageCount, state.objects])

  useEffect(() => {
    let cancelled = false
    loadDraft().then((draft) => {
      if (cancelled) return
      const action = draft ? toLoadAction(draft.doc) : null
      if (action) dispatchHistory({ kind: 'hydrate', action })
      hydrated.current = true
      setSaveStatus(draft ? { state: 'saved', at: draft.savedAt } : { state: 'idle' })
    })
    return () => {
      cancelled = true
    }
  }, [])

  const docForSave = useMemo(
    () => serializeDocument(state),
    // 只在可存檔的內容變動時重新序列化（選取、放置模式不觸發暫存）
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.objects, state.layout, state.exam, state.pageWidth, state.pageHeight, state.textLevelOverrides, state.userTextTiers, state.defaultNewTextTierId],
  )

  useEffect(() => {
    if (!hydrated.current) return
    const timer = window.setTimeout(() => {
      setSaveStatus((s) => ({ ...s, state: 'saving' }))
      saveDraft(docForSave)
        .then((at) => setSaveStatus({ state: 'saved', at }))
        .catch(() => setSaveStatus({ state: 'error' }))
    }, AUTOSAVE_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [docForSave])

  const stableDispatch = useCallback((action: EditorAction) => {
    dispatchHistory({ kind: 'do', action, at: Date.now() })
  }, [])
  const undo = useCallback(() => dispatchHistory({ kind: 'undo' }), [])
  const redo = useCallback(() => dispatchHistory({ kind: 'redo' }), [])
  const canUndo = history.past.length > 0
  const canRedo = history.future.length > 0

  const value = useMemo(
    () => ({
      state,
      dispatch: stableDispatch,
      sortedObjects,
      pageGeometry,
      pageCount,
      flow,
      undo,
      redo,
      canUndo,
      canRedo,
      saveStatus,
    }),
    [state, stableDispatch, sortedObjects, pageGeometry, pageCount, flow, undo, redo, canUndo, canRedo, saveStatus],
  )

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
}

export function useEditor(): EditorContextValue {
  const ctx = useContext(EditorContext)
  if (!ctx) throw new Error('useEditor 必須在 EditorProvider 內使用')
  return ctx
}
