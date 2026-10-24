import type { EditorState } from '../../types/document'
import { type BlockRef,questionNumbers } from '../../types/exam'
import type { IconName } from '../ui'

type SheetView = 'header' | 'paper' | 'type'

export type SideTab = 'questions' | 'sheet' | 'decorate'

export const SIDE_TABS: { id: SideTab; label: string; icon: IconName; title: string }[] = [
  { id: 'questions', label: '出題', icon: 'outline', title: '題目順序' },
  { id: 'sheet', label: '卷面', icon: 'page', title: '頁首、紙張、字級' },
  { id: 'decorate', label: '物件', icon: 'insert', title: '線條、方框、圖片與自由文字' },
]

export function focusKeyOf(block: BlockRef | null, selectedId: string | null) {
  if (block) return `${block.kind}:${block.id}`
  if (selectedId) return `obj:${selectedId}`
  return ''
}

export function tabForFocusKey(focusKey: string): SideTab {
  if (focusKey.startsWith('obj:')) return 'decorate'
  if (focusKey.startsWith('header:')) return 'sheet'
  return 'questions'
}

export function taskHint(tab: SideTab, sheetView: SheetView, state: EditorState): string {
  if (tab === 'sheet') {
    if (sheetView === 'header') return '學校、科目、座號、姓名。點卷上的頁首文字也會打開這裡。'
    if (sheetView === 'paper') return '紙張大小、分欄、行距與頁邊距。'
    return '全卷的字型與字級。某一題要不同，回到「出題」點那一題，在右側打開「單獨設定」。'
  }
  if (tab === 'decorate') return '固定在某一頁的文字、線條、方框、圖片。題目請在「出題」新增。'
  const block = state.selectedBlock
  if (block?.kind === 'question') {
    const num = questionNumbers(state.exam).get(block.id)
    return num ? `正在編輯第 ${num} 題。題幹、選項與配分在右側。` : '正在編輯這一題。內容在右側。'
  }
  if (block?.kind === 'section') return '正在編輯這個大題。名稱、說明與配分在右側；小題請點下面的列。'
  if (block?.kind === 'notice') return '頁尾文字在右側。'
  return '由上到下就是卷上的順序。點一題，右側就是這一題的內容。'
}
