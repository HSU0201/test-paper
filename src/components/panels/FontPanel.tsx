import { useEditor } from '../../editor/EditorContext'
import { BOPOMOFO_FAMILY, PAPER_FONTS, withBopomofoFont } from '../../fonts/paperFont'
import { PanelSection } from '../ui'

export function FontPanel({ embedded = false }: { embedded?: boolean }) {
  const { state, dispatch } = useEditor()

  const body = (
      <PanelSection
        title="全卷字型"
        description="頁首、題目與畫布的國字會一起換成這個字。注音符號另外用內建注音字型。編輯器的按鈕仍用系統字。"
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
                <span className="font-choice__sample" style={{ fontFamily: withBopomofoFont(font.family) }}>
                  國中段考　ㄓㄨˋ ㄧㄣ　ABC 123
                </span>
                <span className="font-choice__note">{font.note}</span>
              </button>
            )
          })}
        </div>
        <div className="font-zhuyin">
          <span className="font-choice__name">注音字型</span>
          <span className="font-choice__sample" style={{ fontFamily: `"${BOPOMOFO_FAMILY}", sans-serif` }}>
            ㄅㄆㄇㄈ　ㄓㄨˋ ㄧㄣ　˙ㄉㄜ
          </span>
          <span className="font-choice__note">
            題目裡的注音符號自動用這個字型，國字仍用上面選的正黑體或標楷體。可以只把選到的幾個字換成注音。
          </span>
        </div>
      </PanelSection>
  )
  if (embedded) return body
  return <div className="side-panel__scroll">{body}</div>
}
