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
import {
  computePageGeometry,
  createCustomHeaderItem,
  createDefaultLayout,
  normalizeLayout,
  refitHeaderHeight,
  withDefaultHeaderPlacement,
  type ColumnLayout,
  type HeaderItem,
  type HeaderLayout,
  type PageMargin,
  type SpacingSettings,
} from '../types/layout'
import { createEmptyExam, createSampleExam, FOOTER_CONTINUE_ID, FOOTER_END_ID, normalizeExam } from '../types/exam'
import { DEFAULT_PAPER_FONT, normalizePaperFont } from '../fonts/paperFont'
import { EXAM_ACTION_TYPES, examReducer, type ExamAction } from './examReducer'

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
  layout: createDefaultLayout(),
  exam: createSampleExam(),
  selectedBlock: null,
  activePage: 0,
  paperFontFamily: DEFAULT_PAPER_FONT,
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
  | ExamAction
  | { type: 'SELECT'; id: string | null }
  | { type: 'START_TEXT_PLACEMENT' }
  | { type: 'CANCEL_TEXT_PLACEMENT' }
  | { type: 'PLACE_TEXT_AT'; x: number; y: number; page: number }
  | { type: 'SET_ACTIVE_PAGE'; page: number }
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
        layout?: unknown
        exam?: unknown
        paperFontFamily?: string
      }
    }
  | { type: 'SET_PAPER_FONT'; fontFamily: string }
  | { type: 'UPDATE_HEADER_ITEM'; id: string; patch: Partial<Omit<HeaderItem, 'id' | 'role'>> }
  | { type: 'UPDATE_HEADER_ITEMS'; updates: { id: string; patch: Partial<Omit<HeaderItem, 'id' | 'role'>> }[] }
  | { type: 'ADD_HEADER_ITEM' }
  | { type: 'REMOVE_HEADER_ITEM'; id: string }
  | { type: 'SET_HEADER'; patch: Partial<Omit<HeaderLayout, 'items'>> }
  | { type: 'RESET_HEADER_LAYOUT' }
  | { type: 'SET_COLUMNS'; patch: Partial<ColumnLayout> }
  | { type: 'SET_MARGIN'; patch: Partial<PageMargin> }
  | { type: 'SET_SPACING'; patch: Partial<SpacingSettings> }
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

function withHeader(state: EditorState, fn: (h: HeaderLayout) => HeaderLayout): EditorState {
  return { ...state, layout: { ...state.layout, header: fn(state.layout.header) } }
}

function isExamAction(a: EditorAction): a is ExamAction {
  return EXAM_ACTION_TYPES.has(a.type)
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  if (isExamAction(action)) {
    const next = examReducer({ exam: state.exam, selectedBlock: state.selectedBlock }, action)
    const blockSelected = next.selectedBlock !== null && next.selectedBlock !== state.selectedBlock
    return {
      ...state,
      ...next,
      selectedId: blockSelected ? null : state.selectedId,
      textPlacementMode: blockSelected ? false : state.textPlacementMode,
    }
  }
  switch (action.type) {
    case 'SELECT':
      return {
        ...state,
        selectedId: action.id,
        selectedBlock: action.id !== null ? null : state.selectedBlock,
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
      const geo = computePageGeometry(state.layout, state.pageWidth, state.pageHeight, action.page)
      const col =
        geo.frames.find((c) => action.x >= c.x && action.x <= c.x + c.w && action.y >= c.y && action.y <= c.y + c.h) ??
        geo.frames.reduce((best, c) =>
          Math.abs(c.x + c.w / 2 - action.x) < Math.abs(best.x + best.w / 2 - action.x) ? c : best,
        )
      const px = Math.max(col.x, Math.min(action.x, col.x + col.w - 120))
      const py = Math.max(col.y, Math.min(action.y, col.y + col.h - 28))
      const width = Math.max(120, col.x + col.w - px)

      let text: TextObject = {
        id: newId(),
        type: 'text',
        zIndex: z,
        page: action.page,
        x: px,
        y: py,
        width,
        text: '請輸入考題文字',
        fontFamily: state.paperFontFamily,
        fontStyle: 'normal',
        align: 'left',
        textLevel: 'custom',
        fontSize: DEFAULT_NEW_TEXT_FONT_SIZE,
        fill: '#000000',
        boxFill: 'transparent',
        boxStroke: '#a08a4a',
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
        page: state.activePage,
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
        page: state.activePage,
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
        page: state.activePage,
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
      const block = state.selectedBlock
      if (block) {
        return editorReducer(
          state,
          block.kind === 'section'
            ? { type: 'REMOVE_SECTION', id: block.id }
            : block.kind === 'question'
              ? { type: 'REMOVE_QUESTION', id: block.id }
              : block.kind === 'notice'
                ? {
                    type: 'SET_FOOTER',
                    patch:
                      block.id === FOOTER_END_ID
                        ? { endOn: false }
                        : block.id === FOOTER_CONTINUE_ID
                          ? { continueOn: false }
                          : {},
                  }
                : { type: 'REMOVE_HEADER_ITEM', id: block.id },
        )
      }
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
        layout: normalizeLayout(action.doc.layout),
        exam: normalizeExam(action.doc.exam),
        selectedBlock: null,
        activePage: 0,
        paperFontFamily: normalizePaperFont(action.doc.paperFontFamily),
      }
    }
    case 'SET_PAPER_FONT': {
      const fontFamily = normalizePaperFont(action.fontFamily)
      let changed = fontFamily !== state.paperFontFamily
      const objects = state.objects.map((o) => {
        if (o.type !== 'text' || o.fontFamily === fontFamily) return o
        changed = true
        return { ...o, fontFamily }
      })
      if (!changed) return state
      return { ...state, paperFontFamily: fontFamily, objects }
    }
    case 'SET_ACTIVE_PAGE':
      return state.activePage === action.page ? state : { ...state, activePage: action.page }
    case 'UPDATE_HEADER_ITEM':
      return withHeader(state, (h) => {
        const items = h.items.map((it) => (it.id === action.id ? { ...it, ...action.patch } : it))
        const affectsHeight = 'visible' in action.patch || 'y' in action.patch || 'fontSize' in action.patch
        return affectsHeight ? refitHeaderHeight(h, items) : { ...h, items }
      })
    case 'UPDATE_HEADER_ITEMS':
      return withHeader(state, (h) =>
        refitHeaderHeight(
          h,
          h.items.map((it) => {
            const update = action.updates.find((u) => u.id === it.id)
            return update ? { ...it, ...update.patch } : it
          }),
        ),
      )
    case 'ADD_HEADER_ITEM': {
      const item = createCustomHeaderItem(Math.max(0, state.layout.header.height - 22))
      return {
        ...withHeader(state, (h) => ({ ...h, items: [...h.items, item] })),
        selectedBlock: { kind: 'header', id: item.id },
        selectedId: null,
      }
    }
    case 'REMOVE_HEADER_ITEM': {
      const item = state.layout.header.items.find((it) => it.id === action.id)
      if (!item) return state
      const next = withHeader(state, (h) =>
        refitHeaderHeight(
          h,
          item.role === 'custom'
            ? h.items.filter((it) => it.id !== action.id)
            : h.items.map((it) => (it.id === action.id ? { ...it, visible: false } : it)),
        ),
      )
      return { ...next, selectedBlock: state.selectedBlock?.id === action.id ? null : state.selectedBlock }
    }
    case 'SET_HEADER':
      return withHeader(state, (h) => {
        const next = { ...h, ...action.patch }
        if (typeof action.patch.height === 'number') next.heightManual = action.patch.height
        return next
      })
    case 'RESET_HEADER_LAYOUT':
      return withHeader(state, (h) => withDefaultHeaderPlacement(h))
    case 'SET_COLUMNS':
      return {
        ...state,
        layout: normalizeLayout({ ...state.layout, columns: { ...state.layout.columns, ...action.patch } }),
      }
    case 'SET_MARGIN':
      return {
        ...state,
        layout: normalizeLayout({ ...state.layout, margin: { ...state.layout.margin, ...action.patch } }),
      }
    case 'SET_SPACING':
      return {
        ...state,
        layout: normalizeLayout({ ...state.layout, spacing: { ...state.layout.spacing, ...action.patch } }),
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
      return { ...initialEditorState(), exam: createEmptyExam() }
    case 'SET_PAGE_SIZE': {
      const w = Math.max(120, Math.round(action.pageWidth))
      const h = Math.max(120, Math.round(action.pageHeight))
      return { ...state, pageWidth: w, pageHeight: h }
    }
  }
}
