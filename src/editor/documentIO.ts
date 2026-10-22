import type { EditorAction } from './reducer'
import type { CanvasObject, EditorState, TextLevelOverrides, UserTextTier } from '../types/document'

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
    version: 2,
    pageWidth: state.pageWidth,
    pageHeight: state.pageHeight,
    layout: state.layout,
    textLevelOverrides: state.textLevelOverrides,
    userTextTiers: state.userTextTiers,
    defaultNewTextTierId: state.defaultNewTextTierId,
    objects: state.objects,
  }
}

/** 由學校名稱與試卷名稱組出檔名 */
export function documentBaseName(state: EditorState): string {
  const { schoolName, examTitle } = state.layout.header
  const parts = [schoolName.value.trim(), examTitle.value.trim()].filter(Boolean)
  const name = parts.join('_').replace(/[\\/:*?"<>|]/g, '')
  return name || '試卷'
}

export function readDocumentFile(file: File, dispatch: (a: EditorAction) => void) {
  const reader = new FileReader()
  reader.onload = () => {
    try {
      const raw = JSON.parse(String(reader.result)) as {
        objects?: unknown
        pageWidth?: number
        pageHeight?: number
        layout?: unknown
        textLevelOverrides?: TextLevelOverrides
        userTextTiers?: UserTextTier[]
        defaultNewTextTierId?: string
      }
      if (!Array.isArray(raw.objects)) throw new Error('缺少 objects 陣列')
      dispatch({
        type: 'LOAD_DOCUMENT',
        doc: {
          objects: raw.objects as CanvasObject[],
          pageWidth: raw.pageWidth,
          pageHeight: raw.pageHeight,
          layout: raw.layout,
          textLevelOverrides: raw.textLevelOverrides,
          userTextTiers: raw.userTextTiers,
          defaultNewTextTierId: raw.defaultNewTextTierId,
        },
      })
    } catch {
      window.alert('無法讀取檔案，請確認是本編輯器匯出的 JSON。')
    }
  }
  reader.readAsText(file, 'utf-8')
}
