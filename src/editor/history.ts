import type { EditorState } from '../types/document'
import { type EditorAction,editorReducer, initialEditorState } from './reducer'

const LIMIT = 100
/** 同一欄位連續輸入在此時間內合併為一步復原 */
const MERGE_WINDOW_MS = 1000

const TRANSIENT = new Set<EditorAction['type']>([
  'SELECT',
  'SELECT_BLOCK',
  'START_TEXT_PLACEMENT',
  'CANCEL_TEXT_PLACEMENT',
  'SET_DEFAULT_NEW_TEXT_TIER',
  'SET_ACTIVE_PAGE',
])

export type HistoryState = {
  past: EditorState[]
  present: EditorState
  future: EditorState[]
  lastKey: string | null
  lastAt: number
}

export type HistoryAction =
  | { kind: 'do'; action: EditorAction; at: number }
  | { kind: 'undo' }
  | { kind: 'redo' }
  /** 載入暫存稿：取代目前內容並清空復原紀錄 */
  | { kind: 'hydrate'; action: EditorAction }

export function initialHistory(): HistoryState {
  return { past: [], present: initialEditorState(), future: [], lastKey: null, lastAt: 0 }
}

function mergeKey(a: EditorAction): string {
  const r = a as { id?: string; key?: string; questionId?: string; choiceId?: string; patch?: object }
  const fields = r.patch ? Object.keys(r.patch).sort().join(',') : ''
  return [a.type, r.id, r.key, r.questionId, r.choiceId, fields].join('|')
}

/** 復原後不留在放置模式，避免誤點建立物件 */
function settle(s: EditorState): EditorState {
  return s.textPlacementMode ? { ...s, textPlacementMode: false } : s
}

export function historyReducer(h: HistoryState, a: HistoryAction): HistoryState {
  if (a.kind === 'hydrate') {
    return { past: [], present: editorReducer(h.present, a.action), future: [], lastKey: null, lastAt: 0 }
  }
  if (a.kind === 'undo') {
    const prev = h.past[h.past.length - 1]
    if (!prev) return h
    return {
      past: h.past.slice(0, -1),
      present: settle(prev),
      future: [h.present, ...h.future],
      lastKey: null,
      lastAt: 0,
    }
  }
  if (a.kind === 'redo') {
    const next = h.future[0]
    if (!next) return h
    return {
      past: [...h.past, h.present],
      present: settle(next),
      future: h.future.slice(1),
      lastKey: null,
      lastAt: 0,
    }
  }

  const present = editorReducer(h.present, a.action)
  if (present === h.present) return h
  if (TRANSIENT.has(a.action.type)) return { ...h, present }

  const key = mergeKey(a.action)
  if (key === h.lastKey && a.at - h.lastAt < MERGE_WINDOW_MS) {
    return { ...h, present, future: [], lastAt: a.at }
  }
  return {
    past: [...h.past, h.present].slice(-LIMIT),
    present,
    future: [],
    lastKey: key,
    lastAt: a.at,
  }
}
