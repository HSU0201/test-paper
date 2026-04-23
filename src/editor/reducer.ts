import {
  A4_HEIGHT,
  A4_WIDTH,
  type CanvasObject,
  type EditorState,
  type FontStyle,
  type ImageObject,
  type LineObject,
  type RectObject,
  type TextAlign,
  type TextObject,
} from '../types/document'

export const initialEditorState = (): EditorState => ({
  version: 1,
  pageWidth: A4_WIDTH,
  pageHeight: A4_HEIGHT,
  objects: [],
  selectedId: null,
})

function nextZ(objects: CanvasObject[]): number {
  if (objects.length === 0) return 0
  return Math.max(...objects.map((o) => o.zIndex)) + 1
}

function newId(): string {
  return crypto.randomUUID()
}

export type EditorAction =
  | { type: 'SELECT'; id: string | null }
  | { type: 'ADD_TEXT' }
  | { type: 'ADD_LINE' }
  | { type: 'ADD_RECT' }
  | { type: 'ADD_IMAGE'; src: string; width: number; height: number }
  | { type: 'DELETE_SELECTED' }
  | { type: 'BRING_FORWARD' }
  | { type: 'SEND_BACKWARD' }
  | { type: 'MOVE_OBJECT'; id: string; x: number; y: number }
  | { type: 'MOVE_LINE'; id: string; x1: number; y1: number; x2: number; y2: number }
  | { type: 'RESIZE_OR_TRANSFORM'; id: string; patch: Record<string, number> }
  | {
      type: 'SET_TEXT_STYLE'
      id: string
      patch: Partial<{
        text: string
        fontSize: number
        fontFamily: string
        fill: string
        fontStyle: FontStyle
        align: TextAlign
        width: number
      }>
    }
  | {
      type: 'SET_LINE_STYLE'
      id: string
      patch: Partial<{ stroke: string; strokeWidth: number }>
    }
  | {
      type: 'SET_RECT_STYLE'
      id: string
      patch: Partial<{
        fill: string
        stroke: string
        strokeWidth: number
        cornerRadius: number
      }>
    }
  | {
      type: 'LOAD_DOCUMENT'
      doc: {
        objects: EditorState['objects']
        pageWidth?: number
        pageHeight?: number
      }
    }
  | { type: 'RESET' }

function findIndex(objects: CanvasObject[], id: string): number {
  return objects.findIndex((o) => o.id === id)
}

function sortByZ(objects: CanvasObject[]): CanvasObject[] {
  return [...objects].sort((a, b) => a.zIndex - b.zIndex)
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'SELECT':
      return { ...state, selectedId: action.id }
    case 'ADD_TEXT': {
      const z = nextZ(state.objects)
      const text: TextObject = {
        id: newId(),
        type: 'text',
        zIndex: z,
        x: 80,
        y: 120,
        width: 520,
        text: '請輸入考題文字',
        fontSize: 18,
        fontFamily: '"Microsoft JhengHei", "PingFang TC", sans-serif',
        fill: '#111827',
        fontStyle: 'normal',
        align: 'left',
      }
      return {
        ...state,
        objects: [...state.objects, text],
        selectedId: text.id,
      }
    }
    case 'ADD_LINE': {
      const z = nextZ(state.objects)
      const line: LineObject = {
        id: newId(),
        type: 'line',
        zIndex: z,
        x1: 100,
        y1: 400,
        x2: 420,
        y2: 400,
        stroke: '#111827',
        strokeWidth: 2,
      }
      return {
        ...state,
        objects: [...state.objects, line],
        selectedId: line.id,
      }
    }
    case 'ADD_RECT': {
      const z = nextZ(state.objects)
      const rect: RectObject = {
        id: newId(),
        type: 'rect',
        zIndex: z,
        x: 120,
        y: 200,
        width: 200,
        height: 120,
        fill: 'transparent',
        stroke: '#374151',
        strokeWidth: 2,
        cornerRadius: 4,
      }
      return {
        ...state,
        objects: [...state.objects, rect],
        selectedId: rect.id,
      }
    }
    case 'ADD_IMAGE': {
      const z = nextZ(state.objects)
      const aw = action.width || 400
      const ah = action.height || 300
      const w = Math.min(aw, state.pageWidth - 80)
      const h = (w / aw) * ah
      const img: ImageObject = {
        id: newId(),
        type: 'image',
        zIndex: z,
        x: 80,
        y: 100,
        width: w,
        height: h,
        src: action.src,
      }
      return {
        ...state,
        objects: [...state.objects, img],
        selectedId: img.id,
      }
    }
    case 'DELETE_SELECTED': {
      if (!state.selectedId) return state
      return {
        ...state,
        objects: state.objects.filter((o) => o.id !== state.selectedId),
        selectedId: null,
      }
    }
    case 'BRING_FORWARD': {
      if (!state.selectedId) return state
      const sorted = sortByZ(state.objects)
      const idx = sorted.findIndex((o) => o.id === state.selectedId)
      if (idx < 0 || idx === sorted.length - 1) return state
      const a = sorted[idx]
      const b = sorted[idx + 1]
      const objects = state.objects.map((o) => {
        if (o.id === a.id) return { ...o, zIndex: b.zIndex }
        if (o.id === b.id) return { ...o, zIndex: a.zIndex }
        return o
      })
      return { ...state, objects }
    }
    case 'SEND_BACKWARD': {
      if (!state.selectedId) return state
      const sorted = sortByZ(state.objects)
      const idx = sorted.findIndex((o) => o.id === state.selectedId)
      if (idx <= 0) return state
      const a = sorted[idx]
      const b = sorted[idx - 1]
      const objects = state.objects.map((o) => {
        if (o.id === a.id) return { ...o, zIndex: b.zIndex }
        if (o.id === b.id) return { ...o, zIndex: a.zIndex }
        return o
      })
      return { ...state, objects }
    }
    case 'MOVE_OBJECT': {
      const i = findIndex(state.objects, action.id)
      if (i < 0) return state
      const o = state.objects[i]
      if (o.type === 'line') return state
      const next = { ...o, x: action.x, y: action.y } as CanvasObject
      const objects = [...state.objects]
      objects[i] = next
      return { ...state, objects }
    }
    case 'MOVE_LINE': {
      const i = findIndex(state.objects, action.id)
      if (i < 0) return state
      const o = state.objects[i]
      if (o.type !== 'line') return state
      const next: LineObject = {
        ...o,
        x1: action.x1,
        y1: action.y1,
        x2: action.x2,
        y2: action.y2,
      }
      const objects = [...state.objects]
      objects[i] = next
      return { ...state, objects }
    }
    case 'RESIZE_OR_TRANSFORM': {
      const i = findIndex(state.objects, action.id)
      if (i < 0) return state
      const o = state.objects[i]
      const p = action.patch
      let next: CanvasObject = o
      if (o.type === 'text') {
        next = {
          ...o,
          x: p.x ?? o.x,
          y: p.y ?? o.y,
          width: p.width ?? o.width,
          fontSize: p.fontSize ?? o.fontSize,
        }
      } else if (o.type === 'rect' || o.type === 'image') {
        next = {
          ...o,
          x: p.x ?? o.x,
          y: p.y ?? o.y,
          width: p.width ?? o.width,
          height: p.height ?? o.height,
        }
      } else if (o.type === 'line') {
        next = {
          ...o,
          x1: p.x1 ?? o.x1,
          y1: p.y1 ?? o.y1,
          x2: p.x2 ?? o.x2,
          y2: p.y2 ?? o.y2,
        }
      }
      const objects = [...state.objects]
      objects[i] = next
      return { ...state, objects }
    }
    case 'SET_TEXT_STYLE': {
      const i = findIndex(state.objects, action.id)
      if (i < 0) return state
      const o = state.objects[i]
      if (o.type !== 'text') return state
      const objects = [...state.objects]
      objects[i] = { ...o, ...action.patch }
      return { ...state, objects }
    }
    case 'SET_LINE_STYLE': {
      const i = findIndex(state.objects, action.id)
      if (i < 0) return state
      const o = state.objects[i]
      if (o.type !== 'line') return state
      const objects = [...state.objects]
      objects[i] = { ...o, ...action.patch }
      return { ...state, objects }
    }
    case 'SET_RECT_STYLE': {
      const i = findIndex(state.objects, action.id)
      if (i < 0) return state
      const o = state.objects[i]
      if (o.type !== 'rect') return state
      const objects = [...state.objects]
      objects[i] = { ...o, ...action.patch }
      return { ...state, objects }
    }
    case 'LOAD_DOCUMENT': {
      return {
        ...state,
        pageWidth: action.doc.pageWidth ?? A4_WIDTH,
        pageHeight: action.doc.pageHeight ?? A4_HEIGHT,
        objects: action.doc.objects,
        selectedId: null,
      }
    }
    case 'RESET':
      return initialEditorState()
  }
}
