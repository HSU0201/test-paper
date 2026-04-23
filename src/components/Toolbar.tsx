import { useMemo, useRef, type ChangeEventHandler, type RefObject } from 'react'
import { useEditor } from '../editor/EditorContext'
import { exportStageToPdf } from '../export/pdfFromStage'
import type { EditorAction } from '../editor/reducer'
import {
  PAPER_PRESETS,
  TEXT_PRESET_LEVEL_KEYS,
  detectPaperPreset,
  getTextTierLabel,
  isValidTierId,
  pxToMm,
  type PaperPresetKey,
  type TextLevelOverrides,
  type UserTextTier,
} from '../types/document'
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

function applyPaperPreset(dispatch: (a: EditorAction) => void, key: PaperPresetKey, landscape: boolean) {
  const p = PAPER_PRESETS[key]
  dispatch({
    type: 'SET_PAGE_SIZE',
    pageWidth: landscape ? p.height : p.width,
    pageHeight: landscape ? p.width : p.height,
  })
}

export function Toolbar({ stageRef }: ToolbarProps) {
  const { state, dispatch } = useEditor()
  const fileRef = useRef<HTMLInputElement>(null)

  const landscape = state.pageWidth > state.pageHeight
  const presetKey = detectPaperPreset(state.pageWidth, state.pageHeight)
  const selectedObj = state.selectedId
    ? state.objects.find((o) => o.id === state.selectedId)
    : undefined
  const selectedText = selectedObj?.type === 'text' ? selectedObj : undefined

  /** 與任一 option value 對齊，避免受控 select 因無匹配而顯示空白 */
  const tierSelectValue = useMemo(() => {
    const raw = selectedText ? selectedText.textLevel : state.defaultNewTextTierId
    if (isValidTierId(raw, state.userTextTiers)) return raw
    return selectedText ? 'custom' : 'question_body'
  }, [selectedText, state.defaultNewTextTierId, state.userTextTiers])

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
      textLevelOverrides: state.textLevelOverrides,
      userTextTiers: state.userTextTiers,
      defaultNewTextTierId: state.defaultNewTextTierId,
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
          textLevelOverrides?: TextLevelOverrides
          userTextTiers?: UserTextTier[]
          defaultNewTextTierId?: string
        }
        if (!Array.isArray(raw.objects)) throw new Error('缺少 objects 陣列')
        dispatch({
          type: 'LOAD_DOCUMENT',
          doc: {
            objects: raw.objects as typeof state.objects,
            pageWidth: raw.pageWidth,
            pageHeight: raw.pageHeight,
            textLevelOverrides: raw.textLevelOverrides,
            userTextTiers: raw.userTextTiers,
            defaultNewTextTierId: raw.defaultNewTextTierId,
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

  const swapOrientation = () =>
    dispatch({
      type: 'SET_PAGE_SIZE',
      pageWidth: state.pageHeight,
      pageHeight: state.pageWidth,
    })

  return (
    <header className="editor-header">
      <div className="editor-toolbar editor-toolbar--primary">
        <div className="editor-toolbar__brand">試卷編輯器</div>
        <div className="editor-toolbar__actions">
          <div
            className="editor-toolbar__add-text"
            title={
              state.textPlacementMode
                ? '放置模式中：可點既有文字取消放置並選取，或在空白處放置新文字。'
                : selectedText
                  ? '變更目前選取文字的階層，並同步為之後「新增文字」的預設。'
                  : '之後按「新增文字」並在畫布點擊時，新文字使用的階層。'
            }
          >
            <label className="editor-toolbar__add-text-label">
              <span className="editor-toolbar__add-text-k">
                {selectedText ? '目前文字階層' : '新增文字預設階層'}
              </span>
              <select
                className="editor-toolbar__add-text-select"
                value={tierSelectValue}
                onChange={(e) => {
                  const tierId = e.target.value
                  if (selectedText) {
                    dispatch({
                      type: 'SET_TEXT_STYLE',
                      id: selectedText.id,
                      patch: { textLevel: tierId },
                    })
                  }
                  dispatch({ type: 'SET_DEFAULT_NEW_TEXT_TIER', tierId })
                }}
              >
                {TEXT_PRESET_LEVEL_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {getTextTierLabel(key, state.textLevelOverrides, state.userTextTiers)}
                  </option>
                ))}
                {state.userTextTiers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
                <option value="custom">自訂</option>
              </select>
            </label>
            <button
              type="button"
              className={state.textPlacementMode ? 'editor-toolbar__place-text is-active' : ''}
              onClick={() =>
                state.textPlacementMode
                  ? dispatch({ type: 'CANCEL_TEXT_PLACEMENT' })
                  : dispatch({ type: 'START_TEXT_PLACEMENT' })
              }
            >
              {state.textPlacementMode ? '取消放置文字' : '新增文字'}
            </button>
          </div>
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
      </div>

      <nav className="editor-nav-sub" aria-label="頁面與紙張">
        <div className="editor-nav-sub__title">
          <span className="editor-nav-sub__title-icon" aria-hidden>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <rect x="5" y="3" width="14" height="18" rx="2" />
              <path d="M9 8h6M9 12h6M9 16h4" strokeLinecap="round" />
            </svg>
          </span>
          頁面
        </div>

        <div className="editor-nav-sub__cluster">
          <label className="editor-nav-sub__field">
            <span className="editor-nav-sub__field-label">紙張</span>
            <select
              className="editor-nav-sub__select"
              value={presetKey === 'custom' ? '__none__' : presetKey}
              onChange={(e) => {
                const raw = e.target.value
                if (raw === '__none__') return
                applyPaperPreset(dispatch, raw as PaperPresetKey, landscape)
              }}
            >
              {presetKey === 'custom' ? (
                <option value="__none__">不符標準預設（請選下列或調整寬高）</option>
              ) : null}
              {(Object.keys(PAPER_PRESETS) as PaperPresetKey[]).map((k) => (
                <option key={k} value={k}>
                  {PAPER_PRESETS[k].label}
                </option>
              ))}
            </select>
          </label>

          <div className="editor-nav-sub__pair" role="group" aria-label="寬高（px）">
            <label className="editor-nav-sub__field editor-nav-sub__field--num">
              <span className="editor-nav-sub__field-label">寬</span>
              <input
                type="number"
                min={120}
                max={4000}
                className="editor-nav-sub__input"
                value={state.pageWidth}
                onChange={(e) =>
                  dispatch({
                    type: 'SET_PAGE_SIZE',
                    pageWidth: Number(e.target.value) || state.pageWidth,
                    pageHeight: state.pageHeight,
                  })
                }
              />
            </label>
            <span className="editor-nav-sub__pair-cross" aria-hidden>
              ×
            </span>
            <label className="editor-nav-sub__field editor-nav-sub__field--num">
              <span className="editor-nav-sub__field-label">高</span>
              <input
                type="number"
                min={120}
                max={4000}
                className="editor-nav-sub__input"
                value={state.pageHeight}
                onChange={(e) =>
                  dispatch({
                    type: 'SET_PAGE_SIZE',
                    pageWidth: state.pageWidth,
                    pageHeight: Number(e.target.value) || state.pageHeight,
                  })
                }
              />
            </label>
          </div>

          <div className="editor-nav-sub__segment" role="group" aria-label="紙張方向">
            <button
              type="button"
              className={!landscape ? 'is-active' : ''}
              title="高度不小於寬度"
              onClick={() => {
                if (landscape) swapOrientation()
              }}
            >
              直向
            </button>
            <button
              type="button"
              className={landscape ? 'is-active' : ''}
              title="寬度大於高度"
              onClick={() => {
                if (!landscape) swapOrientation()
              }}
            >
              橫向
            </button>
          </div>
        </div>

        <ul className="editor-nav-sub__chips" aria-live="polite">
          <li className="editor-nav-sub__chip editor-nav-sub__chip--accent">
            <span className="editor-nav-sub__chip-k">畫布</span>
            <span className="editor-nav-sub__chip-v">
              {state.pageWidth}×{state.pageHeight}px
            </span>
          </li>
          <li className="editor-nav-sub__chip">
            <span className="editor-nav-sub__chip-k">約</span>
            <span className="editor-nav-sub__chip-v">
              {pxToMm(state.pageWidth)}×{pxToMm(state.pageHeight)}mm
            </span>
          </li>
          <li className="editor-nav-sub__chip">
            <span className="editor-nav-sub__chip-k">方向</span>
            <span className="editor-nav-sub__chip-v">{landscape ? '橫向' : '直向'}</span>
          </li>
          <li className="editor-nav-sub__chip">
            <span className="editor-nav-sub__chip-k">新文字預設階層</span>
            <span className="editor-nav-sub__chip-v">
              {getTextTierLabel(state.defaultNewTextTierId, state.textLevelOverrides, state.userTextTiers)}
            </span>
          </li>
          {selectedText ? (
            <li className="editor-nav-sub__chip editor-nav-sub__chip--sel">
              <span className="editor-nav-sub__chip-k">選取文字</span>
              <span className="editor-nav-sub__chip-v">
                {`${getTextTierLabel(selectedText.textLevel, state.textLevelOverrides, state.userTextTiers)} · ${selectedText.fontSize}px`}
              </span>
            </li>
          ) : null}
        </ul>
      </nav>
    </header>
  )
}
