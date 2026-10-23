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
import { documentSignature, serializeDocument, toLoadAction } from './documentIO'
import {
  listSnapshots,
  loadDraft,
  MAX_SNAPSHOTS,
  requestPersistentStorage,
  saveDraft,
  saveSnapshot,
  SNAPSHOT_INTERVAL_MS,
} from './persist'
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
  /** 本機定時備份的時間戳，新的在前 */
  snapshots: number[]
  backupNow: () => Promise<number | null>
  reloadSnapshots: () => Promise<void>
}

const EditorContext = createContext<EditorContextValue | null>(null)

const AUTOSAVE_DELAY_MS = 800

export function EditorProvider({ children }: { children: ReactNode }) {
  const [history, dispatchHistory] = useReducer(historyReducer, undefined, initialHistory)
  const state = history.present
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ state: 'loading' })
  const [snapshots, setSnapshots] = useState<number[]>([])
  const ready = useRef(false)
  /** 載入完成當下的存檔；同一參照代表還沒有新的編輯 */
  const hydratedDoc = useRef<unknown>(undefined)
  const docRef = useRef<ReturnType<typeof serializeDocument> | null>(null)
  const revision = useRef(0)
  const lastSnapRevision = useRef(0)
  const lastSnapAt = useRef(0)
  const lastCapturedSig = useRef('')
  const snapTimer = useRef<number | null>(null)
  const snapChain = useRef(Promise.resolve<number | null>(null))
  const saveGen = useRef(0)
  const saveChain = useRef(Promise.resolve())

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

  const docForSave = useMemo(
    () => serializeDocument(state),
    // 只在可存檔的內容變動時重新序列化（選取、放置模式不觸發暫存）
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.objects, state.layout, state.exam, state.pageWidth, state.pageHeight, state.textLevelOverrides, state.userTextTiers, state.defaultNewTextTierId],
  )
  useEffect(() => {
    docRef.current = docForSave
  }, [docForSave])

  const rememberSnapshot = useCallback((at: number) => {
    setSnapshots((prev) => [at, ...prev.filter((x) => x !== at)].sort((a, b) => b - a).slice(0, MAX_SNAPSHOTS))
  }, [])

  const commitSnapshot = useCallback(
    (doc: unknown, opts?: { force?: boolean }) => {
      const run = () => {
        try {
          const rev = revision.current
          const sig = documentSignature(doc)
          if (!opts?.force && sig === lastCapturedSig.current) {
            if (lastSnapRevision.current < rev) lastSnapRevision.current = rev
            return Promise.resolve<number | null>(null)
          }
          const previousAt = lastSnapAt.current
          lastSnapAt.current = Date.now()
          return saveSnapshot(doc).then(
            (at) => {
              lastCapturedSig.current = sig
              if (lastSnapRevision.current < rev) lastSnapRevision.current = rev
              lastSnapAt.current = at
              rememberSnapshot(at)
              return at
            },
            () => {
              lastSnapAt.current = previousAt
              return null
            },
          )
        } catch {
          return Promise.resolve<number | null>(null)
        }
      }
      const job = snapChain.current.then(run, run)
      snapChain.current = job
      return job
    },
    [rememberSnapshot],
  )

  const reloadSnapshots = useCallback(
    () =>
      listSnapshots().then((keys) => {
        setSnapshots((prev) => {
          const merged = new Set([...keys, ...prev])
          return [...merged].sort((a, b) => b - a).slice(0, MAX_SNAPSHOTS)
        })
      }),
    [],
  )

  const backupNow = useCallback(() => {
    const doc = docRef.current
    if (!doc) return Promise.resolve(null)
    return commitSnapshot(doc, { force: true })
  }, [commitSnapshot])

  const persistDraft = useCallback((doc: unknown) => {
    const gen = ++saveGen.current
    setSaveStatus((s) => ({ ...s, state: 'saving' }))
    const job = saveChain.current.then(() => saveDraft(doc))
    saveChain.current = job.then(
      (at) => {
        if (saveGen.current === gen) setSaveStatus({ state: 'saved', at })
      },
      () => {
        if (saveGen.current === gen) setSaveStatus({ state: 'error' })
      },
    )
  }, [])

  useEffect(() => {
    let cancelled = false
    requestPersistentStorage()
    loadDraft().then((draft) => {
      if (cancelled) return
      const action = draft ? toLoadAction(draft.doc) : null
      if (action) dispatchHistory({ kind: 'hydrate', action })
      else {
        hydratedDoc.current = docRef.current
        revision.current = 1
        lastSnapRevision.current = 1
        lastSnapAt.current = Date.now()
      }
      ready.current = true
      setSaveStatus(draft ? { state: 'saved', at: draft.savedAt } : { state: 'idle' })
    })
    listSnapshots().then((keys) => {
      if (cancelled) return
      setSnapshots((prev) => {
        const merged = new Set([...keys, ...prev])
        return [...merged].sort((a, b) => b - a).slice(0, MAX_SNAPSHOTS)
      })
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!ready.current) return
    const timer = window.setTimeout(() => {
      const doc = docRef.current
      if (doc) persistDraft(doc)
    }, AUTOSAVE_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [docForSave, persistDraft])

  useEffect(() => {
    if (!ready.current) return
    if (hydratedDoc.current === undefined) {
      hydratedDoc.current = docForSave
      revision.current = 1
      lastSnapRevision.current = 1
      lastSnapAt.current = Date.now()
      return
    }
    if (hydratedDoc.current === docForSave) return
    revision.current += 1
    if (snapTimer.current != null) return
    const wait = Math.max(0, SNAPSHOT_INTERVAL_MS - (Date.now() - lastSnapAt.current))
    snapTimer.current = window.setTimeout(() => {
      snapTimer.current = null
      if (!ready.current || revision.current === lastSnapRevision.current) return
      const doc = docRef.current
      if (doc) void commitSnapshot(doc)
    }, wait)
  }, [docForSave, commitSnapshot])

  useEffect(() => {
    const flush = () => {
      if (!ready.current) return
      const doc = docRef.current
      if (!doc) return
      persistDraft(doc)
      if (revision.current !== lastSnapRevision.current) void commitSnapshot(doc)
    }
    window.addEventListener('pagehide', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
      if (snapTimer.current != null) {
        window.clearTimeout(snapTimer.current)
        snapTimer.current = null
      }
    }
  }, [persistDraft, commitSnapshot])

  const stableDispatch = useCallback(
    (action: EditorAction) => {
      if ((action.type === 'RESET' || action.type === 'LOAD_DOCUMENT') && docRef.current) {
        void commitSnapshot(docRef.current)
      }
      dispatchHistory({ kind: 'do', action, at: Date.now() })
    },
    [commitSnapshot],
  )
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
      snapshots,
      backupNow,
      reloadSnapshots,
    }),
    [
      state,
      stableDispatch,
      sortedObjects,
      pageGeometry,
      pageCount,
      flow,
      undo,
      redo,
      canUndo,
      canRedo,
      saveStatus,
      snapshots,
      backupNow,
      reloadSnapshots,
    ],
  )

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
}

export function useEditor(): EditorContextValue {
  const ctx = useContext(EditorContext)
  if (!ctx) throw new Error('useEditor 必須在 EditorProvider 內使用')
  return ctx
}
