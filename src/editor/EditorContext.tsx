import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react'
import { editorReducer, initialEditorState, type EditorAction } from './reducer'
import type { EditorState } from '../types/document'
import { computeLayoutGeometry, type LayoutGeometry } from '../types/layout'

type EditorContextValue = {
  state: EditorState
  dispatch: (a: EditorAction) => void
  sortedObjects: EditorState['objects']
  layoutGeometry: LayoutGeometry
}

const EditorContext = createContext<EditorContextValue | null>(null)

export function EditorProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(editorReducer, undefined, initialEditorState)

  const sortedObjects = useMemo(
    () => [...state.objects].sort((a, b) => a.zIndex - b.zIndex),
    [state.objects],
  )

  const layoutGeometry = useMemo(
    () =>
      computeLayoutGeometry(state.layout, state.pageWidth, state.pageHeight, state.textLevelOverrides),
    [state.layout, state.pageWidth, state.pageHeight, state.textLevelOverrides],
  )

  const stableDispatch = useCallback((a: EditorAction) => {
    dispatch(a)
  }, [])

  const value = useMemo(
    () => ({ state, dispatch: stableDispatch, sortedObjects, layoutGeometry }),
    [state, stableDispatch, sortedObjects, layoutGeometry],
  )

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
}

export function useEditor(): EditorContextValue {
  const ctx = useContext(EditorContext)
  if (!ctx) throw new Error('useEditor 必須在 EditorProvider 內使用')
  return ctx
}
