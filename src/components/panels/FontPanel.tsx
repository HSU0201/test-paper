import { useEditor } from '../../editor/EditorContext'
import { PAPER_FONTS } from '../../fonts/paperFont'
import { PanelSection } from '../ui'

export function FontPanel() {
  const { state, dispatch } = useEditor()

  return (
    <div className="side-panel__scroll">
      <PanelSection
        title="全卷字型"
        description="頁首、題目與畫布文字會一起換成這個字。編輯器的按鈕仍用系統字。"
      >
        <div className="font-choices">
          {PAPER_FONTS.map((font) => {
            const active = state.paperFontFamily === font.family
            return (
              <button
                key={font.id}
                type="button"
                className={`font-choice${active ? ' is-active' : ''}`}
                aria-pressed={active}
                onClick={() => dispatch({ type: 'SET_PAPER_FONT', fontFamily: font.family })}
              >
                <span className="font-choice__name">
                  {font.label}
                  {active ? <span className="font-choice__badge">使用中</span> : null}
                </span>
                <span className="font-choice__sample" style={{ fontFamily: font.family }}>
                  國中段考　一、選擇題　ABC 123
                </span>
                <span className="font-choice__note">{font.note}</span>
              </button>
            )
          })}
        </div>
      </PanelSection>
    </div>
  )
}
