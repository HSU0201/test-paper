import { useEditor } from '../../editor/EditorContext'
import { type BuiltinTextLevelKey, mergeTextLevelPreset, type TextLevelPreset } from '../../types/document'
import { NumberField, Switch } from '../ui'

export type ExamTextRole = Extract<BuiltinTextLevelKey, 'section_heading' | 'instruction' | 'question_body'>

type ExamTextStyleProps = {
  role: ExamTextRole
  label: string
}

/** 全卷共用的大題標題、作答說明、小題題文字級與粗體 */
export function ExamTextStyle({ role, label }: ExamTextStyleProps) {
  const { state, dispatch } = useEditor()
  const preset = mergeTextLevelPreset(role, state.textLevelOverrides)
  const set = (patch: Partial<TextLevelPreset>) =>
    dispatch({ type: 'UPDATE_TEXT_LEVEL_OVERRIDES', patch: { [role]: patch } })

  return (
    <div className="exam-style">
      <span className="exam-style__label">{label}</span>
      <div className="exam-style__row">
        <NumberField
          label="字級"
          suffix="px"
          min={8}
          max={72}
          value={preset.fontSize}
          onChange={(value) => set({ fontSize: Math.min(72, Math.max(8, Math.round(value))) })}
        />
        <div className="exam-style__bold">
          <span className="ui-field__label">粗體</span>
          <Switch checked={!!preset.bold} label={`${label}粗體`} onChange={(bold) => set({ bold })} />
        </div>
      </div>
    </div>
  )
}
