import {
  A4_HEIGHT,
  A4_WIDTH,
  DEFAULT_NEW_TEXT_FONT_SIZE,
  isValidTierId,
  normalizeCanvasObject,
  resolveLockedTextStyle,
  TEXT_PRESET_LEVEL_KEYS,
  type CanvasObject,
  type EditorState,
  type FontStyle,
  type ImageObject,
  type LineObject,
  type RectObject,
  type TextAlign,
  type TextLevelOverrides,
  type TextObject,
  type UserTextTier,
} from '../types/document'

export const initialEditorState = (): EditorState => ({
  version: 1,
  pageWidth: A4_WIDTH,
  pageHeight: A4_HEIGHT,
  objects: [],
  selectedId: null,
  textLevelOverrides: {},
  userTextTiers: [],
  defaultNewTextTierId: 'question_body',
  textPlacementMode: false,
})

function nextZ(objects: CanvasObject[]): number {
  if (objects.length === 0) return 0
  return Math.max(...objects.map((o) => o.zIndex)) + 1
}

function newId(): string {
  return crypto.randomUUID()
}

function pickValidDefaultNewTextTier(id: string | undefined, userTiers: UserTextTier[]): string {
  const cand = id ?? 'question_body'
  return isValidTierId(cand, userTiers) ? cand : 'question_body'
}

export type EditorAction =
  | { type: 'SELECT'; id: string | null }
  | { type: 'START_TEXT_PLACEMENT' }
  | { type: 'CANCEL_TEXT_PLACEMENT' }
  | { type: 'PLACE_TEXT_AT'; x: number; y: number }
  | { type: 'SET_DEFAULT_NEW_TEXT_TIER'; tierId: string }
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
        textLevel: string
        boxStroke: string
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
        textLevelOverrides?: TextLevelOverrides
        userTextTiers?: UserTextTier[]
        defaultNewTextTierId?: string
      }
    }
  | { type: 'UPDATE_TEXT_LEVEL_OVERRIDES'; patch: TextLevelOverrides }
  | { type: 'COMMIT_TEXT_TIER_CATALOG'; overridesPatch: TextLevelOverrides; userTiers: UserTextTier[] }
  | { type: 'RESET' }
  | { type: 'SET_PAGE_SIZE'; pageWidth: number; pageHeight: number }

function findIndex(objects: CanvasObject[], id: string): number {
  return objects.findIndex((o) => o.id === id)
}

function sortByZ(objects: CanvasObject[]): CanvasObject[] {
  return [...objects].sort((a, b) => a.zIndex - b.zIndex)
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'SELECT':
      return {
        ...state,
        selectedId: action.id,
        textPlacementMode: action.id !== null ? false : state.textPlacementMode,
      }
    case 'START_TEXT_PLACEMENT': {
      const tierId = pickValidDefaultNewTextTier(state.defaultNewTextTierId, state.userTextTiers)
      return {
        ...state,
        textPlacementMode: true,
        selectedId: null,
        defaultNewTextTierId: tierId,
      }
    }
    case 'CANCEL_TEXT_PLACEMENT':
      return { ...state, textPlacementMode: false }
    case 'SET_DEFAULT_NEW_TEXT_TIER': {
      if (!isValidTierId(action.tierId, state.userTextTiers)) return state
      return { ...state, defaultNewTextTierId: action.tierId }
    }
    case 'PLACE_TEXT_AT': {
      if (!state.textPlacementMode) return state
      const tierId = pickValidDefaultNewTextTier(state.defaultNewTextTierId, state.userTextTiers)
      const z = nextZ(state.objects)
      const margin = 40
      const px = Math.max(0, Math.min(action.x, state.pageWidth - margin))
      const py = Math.max(0, Math.min(action.y, state.pageHeight - margin))
      const width = Math.max(120, Math.min(520, state.pageWidth - px - margin))

      let text: TextObject = {
        id: newId(),
        type: 'text',
        zIndex: z,
        x: px,
        y: py,
        width,
        text: '請輸入考題文字',
        fontFamily: '"Microsoft JhengHei", "PingFang TC", sans-serif',
        fontStyle: 'normal',
        align: 'left',
        textLevel: 'custom',
        fontSize: DEFAULT_NEW_TEXT_FONT_SIZE,
        fill: '#111827',
        boxFill: 'transparent',
        boxStroke: '#64748b',
      }

      if (tierId !== 'custom') {
        const st = resolveLockedTextStyle(tierId, state.textLevelOverrides, state.userTextTiers)
        if (st) {
          text = {
            ...text,
            ...st,
            textLevel: tierId,
            boxFill: 'transparent',
          }
        }
      }

      return {
        ...state,
        objects: [...state.objects, text],
        selectedId: text.id,
        textPlacementMode: false,
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
      let next: TextObject = { ...o, ...action.patch }
      const lev = action.patch.textLevel
      if (lev !== undefined && lev !== 'custom') {
        const st = resolveLockedTextStyle(lev, state.textLevelOverrides, state.userTextTiers)
        if (st) next = { ...next, ...st, textLevel: lev }
        else next = { ...o, ...action.patch, textLevel: 'custom', boxFill: 'transparent' }
      }
      objects[i] = { ...next, boxFill: 'transparent' }
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
      const raw = action.doc.objects as CanvasObject[]
      const userTiers = Array.isArray(action.doc.userTextTiers) ? action.doc.userTextTiers : []
      const knownIds = new Set(userTiers.map((t) => t.id))
      const overrides = action.doc.textLevelOverrides ?? {}
      const normalized = raw.map((obj) => normalizeCanvasObject(obj, { knownCustomTierIds: knownIds }))
      const objects = normalized.map((o) => {
        if (o.type !== 'text' || o.textLevel === 'custom') return o
        const st = resolveLockedTextStyle(o.textLevel, overrides, userTiers)
        if (!st) {
          return {
            ...o,
            textLevel: 'custom',
            boxFill: 'transparent',
            boxStroke: o.boxStroke ?? '#64748b',
          }
        }
        return { ...o, ...st, textLevel: o.textLevel, boxFill: 'transparent' as const }
      })
      const defaultNewTextTierId = pickValidDefaultNewTextTier(action.doc.defaultNewTextTierId, userTiers)
      return {
        ...state,
        pageWidth: action.doc.pageWidth ?? A4_WIDTH,
        pageHeight: action.doc.pageHeight ?? A4_HEIGHT,
        objects,
        textLevelOverrides: overrides,
        userTextTiers: userTiers,
        defaultNewTextTierId,
        textPlacementMode: false,
        selectedId: null,
      }
    }
    case 'UPDATE_TEXT_LEVEL_OVERRIDES': {
      const merged: TextLevelOverrides = { ...state.textLevelOverrides }
      for (const key of TEXT_PRESET_LEVEL_KEYS) {
        const p = action.patch[key]
        if (p) merged[key] = { ...merged[key], ...p }
      }
      const objects = state.objects.map((o) => {
        if (o.type !== 'text' || o.textLevel === 'custom') return o
        const st = resolveLockedTextStyle(o.textLevel, merged, state.userTextTiers)
        if (!st) {
          return {
            ...o,
            textLevel: 'custom',
            boxFill: 'transparent',
            boxStroke: o.boxStroke ?? '#64748b',
          }
        }
        return { ...o, ...st, textLevel: o.textLevel, boxFill: 'transparent' as const }
      })
      return { ...state, textLevelOverrides: merged, objects }
    }
    case 'COMMIT_TEXT_TIER_CATALOG': {
      const merged: TextLevelOverrides = { ...state.textLevelOverrides }
      for (const key of TEXT_PRESET_LEVEL_KEYS) {
        const p = action.overridesPatch[key]
        if (p) merged[key] = { ...merged[key], ...p }
      }
      const userTiers = action.userTiers
      const objects = state.objects.map((o) => {
        if (o.type !== 'text' || o.textLevel === 'custom') return o
        const st = resolveLockedTextStyle(o.textLevel, merged, userTiers)
        if (!st) {
          return {
            ...o,
            textLevel: 'custom',
            boxFill: 'transparent',
            boxStroke: o.boxStroke ?? '#64748b',
          }
        }
        return { ...o, ...st, textLevel: o.textLevel, boxFill: 'transparent' as const }
      })
      const defaultNewTextTierId = pickValidDefaultNewTextTier(state.defaultNewTextTierId, userTiers)
      return {
        ...state,
        textLevelOverrides: merged,
        userTextTiers: userTiers,
        objects,
        defaultNewTextTierId,
      }
    }
    case 'RESET':
      return initialEditorState()
    case 'SET_PAGE_SIZE': {
      const w = Math.max(120, Math.round(action.pageWidth))
      const h = Math.max(120, Math.round(action.pageHeight))
      return { ...state, pageWidth: w, pageHeight: h }
    }
  }
}
