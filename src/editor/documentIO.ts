import type { EditorAction } from './reducer'
import type { CanvasObject, EditorState, TextLevelOverrides, UserTextTier } from '../types/document'
import type { Asset } from '../types/exam'

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function serializeDocument(state: EditorState) {
  return {
    version: 4,
    pageWidth: state.pageWidth,
    pageHeight: state.pageHeight,
    layout: state.layout,
    exam: state.exam,
    textLevelOverrides: state.textLevelOverrides,
    userTextTiers: state.userTextTiers,
    defaultNewTextTierId: state.defaultNewTextTierId,
    objects: state.objects,
  }
}

/** 由學校名稱與試卷名稱組出檔名 */
export function documentBaseName(state: EditorState): string {
  const valueOf = (role: string) =>
    state.layout.header.items.find((it) => it.role === role && it.visible)?.value.trim() ?? ''
  const parts = [valueOf('schoolName'), valueOf('examTitle')].filter(Boolean)
  const name = parts.join('_').replace(/[\\/:*?"<>|]/g, '')
  return name || '試卷'
}

/** 把 JSON（檔案或暫存稿）轉成載入動作；格式不符回傳 null */
export function toLoadAction(data: unknown): EditorAction | null {
  if (!data || typeof data !== 'object') return null
  const raw = data as {
    objects?: unknown
    pageWidth?: number
    pageHeight?: number
    layout?: unknown
    exam?: unknown
    textLevelOverrides?: TextLevelOverrides
    userTextTiers?: UserTextTier[]
    defaultNewTextTierId?: string
  }
  if (!Array.isArray(raw.objects)) return null
  return {
    type: 'LOAD_DOCUMENT',
    doc: {
      objects: raw.objects as CanvasObject[],
      pageWidth: raw.pageWidth,
      pageHeight: raw.pageHeight,
      layout: raw.layout,
      exam: raw.exam,
      textLevelOverrides: raw.textLevelOverrides,
      userTextTiers: raw.userTextTiers,
      defaultNewTextTierId: raw.defaultNewTextTierId,
    },
  }
}

export function readDocumentFile(file: File, dispatch: (a: EditorAction) => void) {
  const reader = new FileReader()
  reader.onload = () => {
    let action: EditorAction | null
    try {
      action = toLoadAction(JSON.parse(String(reader.result)))
    } catch {
      action = null
    }
    if (action) dispatch(action)
    else window.alert('無法讀取檔案，請確認是本編輯器匯出的 JSON。')
  }
  reader.readAsText(file, 'utf-8')
}

/** 讀取圖片並把長邊縮到 maxSide 以內，避免草稿與存檔過大 */
export function readImageFile(file: File, maxSide = 1400): Promise<Asset> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('請選擇圖片檔。'))
      return
    }
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('圖片讀取失敗。'))
    reader.onload = () => {
      const src = String(reader.result)
      const im = new Image()
      im.onerror = () => reject(new Error('圖片載入失敗。'))
      im.onload = () => {
        const w = im.naturalWidth
        const h = im.naturalHeight
        const k = Math.min(1, maxSide / Math.max(w, h))
        if (k === 1 || file.type === 'image/svg+xml') {
          resolve({ src, width: w, height: h })
          return
        }
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(w * k)
        canvas.height = Math.round(h * k)
        canvas.getContext('2d')?.drawImage(im, 0, 0, canvas.width, canvas.height)
        const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
        resolve({ src: canvas.toDataURL(type, 0.9), width: canvas.width, height: canvas.height })
      }
      im.src = src
    }
    reader.readAsDataURL(file)
  })
}
