import { useEditor } from '../editor/EditorContext'
import { findQuestion } from '../editor/examReducer'
import {
  choiceLabel,
  isChoiceType,
  QUESTION_TYPE_LABEL,
  questionNumbers,
  sectionHeading,
  sectionScore,
  type ChoiceLayout,
  type QuestionType,
  type Section,
} from '../types/exam'
import { Icon, NumberField, PanelSection, Segmented } from './ui'

const QUESTION_TYPES = Object.keys(QUESTION_TYPE_LABEL) as QuestionType[]

function SectionEditor({ section, index }: { section: Section; index: number }) {
  const { dispatch } = useEditor()
  const set = (patch: Partial<Section>) => dispatch({ type: 'UPDATE_SECTION', id: section.id, patch })
  return (
    <div className="inspector__body">
      <PanelSection title={sectionHeading(section, index)}>
        <label className="ui-field">
          <span className="ui-field__label">大題名稱</span>
          <input className="ui-input" value={section.title} onChange={(e) => set({ title: e.target.value })} />
        </label>
        <label className="ui-field">
          <span className="ui-field__label">作答說明</span>
          <textarea
            className="ui-input ui-textarea"
            rows={2}
            value={section.instruction}
            placeholder="例：每題 4 分，答錯不倒扣。"
            onChange={(e) => set({ instruction: e.target.value })}
          />
        </label>
      </PanelSection>

      <PanelSection title="配分" description={`本大題共 ${section.questions.length} 題，${sectionScore(section)} 分。`}>
        <div className="ui-grid-2 ui-grid-2--end">
          <NumberField
            label="每題預設"
            suffix="分"
            min={0}
            max={100}
            value={section.defaultScore}
            onChange={(v) => set({ defaultScore: v })}
          />
          <button
            type="button"
            className="btn btn--ghost btn--block"
            disabled={!section.questions.length}
            onClick={() => dispatch({ type: 'APPLY_SECTION_SCORE', id: section.id })}
          >
            套用到全部小題
          </button>
        </div>
        <label className="ui-field">
          <span className="ui-field__label">新增小題的題型</span>
          <select
            className="ui-input"
            value={section.defaultType}
            onChange={(e) => set({ defaultType: e.target.value as QuestionType })}
          >
            {QUESTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {QUESTION_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </label>
      </PanelSection>

      <PanelSection title="跨欄保護" description="標題不會單獨留在欄位底部。">
        <Segmented
          label="跨欄保護"
          value={section.keepTogether}
          options={[
            { value: 'firstChild', label: '標題＋第一題' },
            { value: 'whole', label: '整個大題不拆' },
          ]}
          onChange={(v) => set({ keepTogether: v })}
        />
      </PanelSection>

      <button
        type="button"
        className="btn btn--ghost btn--block"
        onClick={() => dispatch({ type: 'ADD_QUESTION', sectionId: section.id, afterId: section.questions.at(-1)?.id })}
      >
        <Icon name="plus" />
        在此大題新增小題
      </button>
    </div>
  )
}

function QuestionEditor({ questionId }: { questionId: string }) {
  const { state, dispatch } = useEditor()
  const hit = findQuestion(state.exam, questionId)
  if (!hit) return null
  const { question: q, section } = hit
  const num = questionNumbers(state.exam).get(q.id)
  const set = (patch: Partial<typeof q>) => dispatch({ type: 'UPDATE_QUESTION', id: q.id, patch })

  return (
    <div className="inspector__body">
      <PanelSection title={`第 ${num} 題・${section.title}`}>
        <div className="ui-grid-2">
          <label className="ui-field">
            <span className="ui-field__label">題型</span>
            <select
              className="ui-input"
              value={q.type}
              onChange={(e) => set({ type: e.target.value as QuestionType })}
            >
              {QUESTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {QUESTION_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </label>
          <NumberField label="配分" suffix="分" min={0} max={100} value={q.score} onChange={(v) => set({ score: v })} />
        </div>
        <label className="ui-field">
          <span className="ui-field__label">題目</span>
          <textarea
            className="ui-input ui-textarea"
            rows={4}
            value={q.stem}
            placeholder={q.type === 'fill_blank' ? '例：3 + 4 = ＿＿＿＿' : '輸入題目內容'}
            autoFocus={!q.stem}
            onChange={(e) => set({ stem: e.target.value })}
          />
        </label>
      </PanelSection>

      {isChoiceType(q.type) ? (
        <PanelSection
          title="選項"
          actions={
            <button type="button" className="text-btn" onClick={() => dispatch({ type: 'ADD_CHOICE', questionId: q.id })}>
              ＋ 新增選項
            </button>
          }
        >
          {q.choices.map((c, i) => (
            <div key={c.id} className="choice-row">
              <span className="choice-row__label">{choiceLabel(i)}</span>
              <input
                className="ui-input"
                value={c.text}
                aria-label={`選項 ${choiceLabel(i)}`}
                onChange={(e) =>
                  dispatch({ type: 'UPDATE_CHOICE', questionId: q.id, choiceId: c.id, text: e.target.value })
                }
              />
              <button
                type="button"
                className="icon-btn icon-btn--danger"
                title="刪除選項"
                disabled={q.choices.length <= 2}
                onClick={() => dispatch({ type: 'REMOVE_CHOICE', questionId: q.id, choiceId: c.id })}
              >
                <Icon name="trash" />
              </button>
            </div>
          ))}
          <div className="ui-field">
            <span className="ui-field__label">選項排列</span>
            <Segmented<string>
              label="選項排列"
              value={String(q.choiceLayout)}
              options={[
                { value: 'auto', label: '自動' },
                { value: '1', label: '1 欄' },
                { value: '2', label: '2 欄' },
                { value: '4', label: '4 欄' },
              ]}
              onChange={(v) => set({ choiceLayout: (v === 'auto' ? 'auto' : Number(v)) as ChoiceLayout })}
            />
          </div>
        </PanelSection>
      ) : null}

      {q.type === 'short_answer' ? (
        <PanelSection title="作答區">
          <NumberField
            label="作答行數"
            suffix="行"
            min={0}
            max={20}
            value={q.answerLines}
            onChange={(v) => set({ answerLines: Math.max(0, Math.round(v)) })}
          />
        </PanelSection>
      ) : null}

      <PanelSection title="答案" description="只存在檔案中，不會印在試卷上。">
        <input
          className="ui-input"
          value={q.answer}
          placeholder={isChoiceType(q.type) ? '例：C' : '輸入參考答案'}
          onChange={(e) => set({ answer: e.target.value })}
        />
      </PanelSection>

      <button
        type="button"
        className="btn btn--ghost btn--block"
        onClick={() => dispatch({ type: 'ADD_QUESTION', sectionId: section.id, afterId: q.id })}
      >
        <Icon name="plus" />
        在下方新增一題
      </button>
    </div>
  )
}

export function BlockInspector() {
  const { state } = useEditor()
  const ref = state.selectedBlock
  if (!ref) return null
  if (ref.kind === 'section') {
    const index = state.exam.sections.findIndex((s) => s.id === ref.id)
    if (index < 0) return null
    return <SectionEditor section={state.exam.sections[index]} index={index} />
  }
  return <QuestionEditor questionId={ref.id} />
}
