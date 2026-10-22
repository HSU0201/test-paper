import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react'
import type { EditorAction } from './reducer'
import { historyReducer, initialHistory } from './history'
import { layoutExam, type FlowResult } from './flowLayout'
import { measureWithKonva } from './konvaMeasure'
import { mergeTextLevelPreset, type EditorState } from '../types/document'
import { computeLayoutGeometry, type LayoutGeometry } from '../types/layout'

type EditorContextValue = {
  state: EditorState
  dispatch: (a: EditorAction) => void
  sortedObjects: EditorState['objects']
  layoutGeometry: LayoutGeometry
  flow: FlowResult
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
}

const EditorContext = createContext<EditorContextValue | null>(null)

export function EditorProvider({ children }: { children: ReactNode }) {
  const [history, dispatchHistory] = useReducer(historyReducer, undefined, initialHistory)
  const state = history.present

  const sortedObjects = useMemo(
    () => [...state.objects].sort((a, b) => a.zIndex - b.zIndex),
    [state.objects],
  )

  const layoutGeometry = useMemo(
    () =>
      computeLayoutGeometry(state.layout, state.pageWidth, state.pageHeight, state.textLevelOverrides),
    [state.layout, state.pageWidth, state.pageHeight, state.textLevelOverrides],
  )

  const flow = useMemo(() => {
    const o = state.textLevelOverrides
    const heading = mergeTextLevelPreset('section_heading', o)
    const instruction = mergeTextLevelPreset('instruction', o)
    const body = mergeTextLevelPreset('question_body', o)
    return layoutExam(
      state.exam,
      layoutGeometry.columns,
      {
        heading: { fontSize: heading.fontSize, fill: heading.fill, bold: true },
        instruction: { fontSize: instruction.fontSize, fill: instruction.fill },
        body: { fontSize: body.fontSize, fill: body.fill },
        lineHeight: 1.5,
        questionGap: 10,
        sectionGap: 18,
      },
      measureWithKonva,
    )
  }, [state.exam, state.textLevelOverrides, layoutGeometry])

  const stableDispatch = useCallback((action: EditorAction) => {
    dispatchHistory({ kind: 'do', action, at: Date.now() })
  }, [])
  const undo = useCallback(() => dispatchHistory({ kind: 'undo' }), [])
  const redo = useCallback(() => dispatchHistory({ kind: 'redo' }), [])
  const canUndo = history.past.length > 0
  const canRedo = history.future.length > 0

  const value = useMemo(
    () => ({ state, dispatch: stableDispatch, sortedObjects, layoutGeometry, flow, undo, redo, canUndo, canRedo }),
    [state, stableDispatch, sortedObjects, layoutGeometry, flow, undo, redo, canUndo, canRedo],
  )

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
}

export function useEditor(): EditorContextValue {
  const ctx = useContext(EditorContext)
  if (!ctx) throw new Error('useEditor 必須在 EditorProvider 內使用')
  return ctx
}
