import { useRef, type ChangeEventHandler, type RefObject } from 'react'
import { useEditor } from '../editor/EditorContext'
import { exportStageToPdf } from '../export/pdfFromStage'
import type Konva from 'konva'

type ToolbarProps = {
  stageRef: RefObject<Konva.Stage | null>
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function Toolbar({ stageRef }: ToolbarProps) {
  const { state, dispatch } = useEditor()
  const fileRef = useRef<HTMLInputElement>(null)

  const handleExportPdf = () => {
    const stage = stageRef.current
    if (!stage) return
    exportStageToPdf(stage, '試卷.pdf')
  }

  const handleSaveJson = () => {
    downloadJson('試卷編輯.json', {
      version: 1,
      pageWidth: state.pageWidth,
      pageHeight: state.pageHeight,
      objects: state.objects,
    })
  }

  const handleLoadJson: ChangeEventHandler<HTMLInputElement> = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const raw = JSON.parse(String(reader.result)) as {
          objects?: unknown
          pageWidth?: number
          pageHeight?: number
        }
        if (!Array.isArray(raw.objects)) throw new Error('缺少 objects 陣列')
        dispatch({
          type: 'LOAD_DOCUMENT',
          doc: {
            objects: raw.objects as typeof state.objects,
            pageWidth: raw.pageWidth,
            pageHeight: raw.pageHeight,
          },
        })
      } catch {
        window.alert('無法讀取 JSON，請確認檔案格式正確。')
      } finally {
        e.target.value = ''
      }
    }
    reader.readAsText(file, 'utf-8')
  }

  const handlePickImage = () => {
    fileRef.current?.click()
  }

  const onImageFile: ChangeEventHandler<HTMLInputElement> = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      window.alert('請選擇圖片檔。')
      e.target.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const src = String(reader.result)
      const im = new Image()
      im.onload = () => {
        dispatch({
          type: 'ADD_IMAGE',
          src,
          width: im.naturalWidth,
          height: im.naturalHeight,
        })
      }
      im.onerror = () => window.alert('圖片載入失敗。')
      im.src = src
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  return (
    <header className="editor-toolbar">
      <div className="editor-toolbar__brand">試卷編輯器</div>
      <div className="editor-toolbar__actions">
        <button type="button" onClick={() => dispatch({ type: 'ADD_TEXT' })}>
          新增文字
        </button>
        <button type="button" onClick={() => dispatch({ type: 'ADD_LINE' })}>
          新增線條
        </button>
        <button type="button" onClick={() => dispatch({ type: 'ADD_RECT' })}>
          新增矩形
        </button>
        <button type="button" onClick={handlePickImage}>
          插入圖片
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="visually-hidden"
          onChange={onImageFile}
          aria-hidden
        />
        <span className="editor-toolbar__sep" aria-hidden />
        <button type="button" onClick={() => dispatch({ type: 'BRING_FORWARD' })}>
          上移一層
        </button>
        <button type="button" onClick={() => dispatch({ type: 'SEND_BACKWARD' })}>
          下移一層
        </button>
        <button type="button" onClick={() => dispatch({ type: 'DELETE_SELECTED' })}>
          刪除選取
        </button>
        <span className="editor-toolbar__sep" aria-hidden />
        <button type="button" onClick={handleSaveJson}>
          匯出 JSON
        </button>
        <label className="editor-toolbar__file">
          載入 JSON
          <input type="file" accept="application/json,.json" onChange={handleLoadJson} />
        </label>
        <button type="button" className="editor-toolbar__primary" onClick={handleExportPdf}>
          匯出 PDF
        </button>
        <button type="button" onClick={() => dispatch({ type: 'RESET' })}>
          清空畫布
        </button>
      </div>
    </header>
  )
}
