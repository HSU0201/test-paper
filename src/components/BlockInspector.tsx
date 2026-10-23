import { useRef, useState } from 'react'
import { readImageFile } from '../editor/documentIO'
import { useEditor } from '../editor/EditorContext'
import { findQuestion } from '../editor/examReducer'
import {
  choiceLabel,
  type Figure,
  type FigurePlacement,
  isChoiceType,
  QUESTION_TYPE_LABEL,
  questionNumbers,
  sectionHeading,
  sectionScore,
  type Choice,
  type ChoiceLayout,
  type QuestionType,
  type Section,
} from '../types/exam'
import { Icon, NumberField, PanelSection, Segmented, Switch } from './ui'
import { ColorField } from './ColorField'
import { plainText } from '../editor/richText'
import { mergeTextLevelPreset, type BuiltinTextLevelKey, type TextLevelPreset } from '../types/document'

const QUESTION_TYPES = Object.keys(QUESTION_TYPE_LABEL) as QuestionType[]

/** 大題標題、作答說明、題文的字級與粗體；同一類文字整份試卷共用 */
function ExamTextStyle({
  role,
  label,
}: {
  role: Extract<BuiltinTextLevelKey, 'section_heading' | 'instruction' | 'question_body'>
  label: string
}) {
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
          onChange={(v) => set({ fontSize: Math.min(72, Math.max(8, Math.round(v))) })}
        />
        <div className="exam-style__bold">
          <span className="ui-field__label">粗體</span>
          <Switch checked={!!preset.bold} label={`${label}粗體`} onChange={(v) => set({ bold: v })} />
        </div>
      </div>
    </div>
  )
}

function SectionEditor({ section, index }: { section: Section; index: number }) {
  const { dispatch } = useEditor()
  const set = (patch: Partial<Section>) => dispatch({ type: 'UPDATE_SECTION', id: section.id, patch })
  return (
    <div className="inspector__body">
      <PanelSection title={sectionHeading(section, index)}>
        <div className="ui-field">
          <span className="ui-field__label">大題名稱</span>
          <ColorField ariaLabel="大題名稱" value={section.title} onChange={(title) => set({ title })} />
        </div>
        <div className="ui-field">
          <span className="ui-field__label">作答說明</span>
          <ColorField
            ariaLabel="作答說明"
            multiline
            rows={2}
            value={section.instruction}
            placeholder="例：每題 4 分，答錯不倒扣。"
            onChange={(instruction) => set({ instruction })}
          />
        </div>
      </PanelSection>

      <PanelSection title="文字樣式" description="大題標題與作答說明的字級、粗體會套用到整份試卷。">
        <ExamTextStyle role="section_heading" label="大題標題" />
        <ExamTextStyle role="instruction" label="作答說明" />
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

const PLACEMENT_OPTIONS: { value: FigurePlacement; label: string }[] = [
  { value: 'below', label: '題目下方' },
  { value: 'right', label: '題目右側' },
  { value: 'afterChoices', label: '選項下方' },
]

function FiguresEditor({ questionId }: { questionId: string }) {
  const { state, dispatch } = useEditor()
  const fileRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const hit = findQuestion(state.exam, questionId)
  if (!hit) return null
  const q = hit.question
  const options = isChoiceType(q.type) ? PLACEMENT_OPTIONS : PLACEMENT_OPTIONS.filter((o) => o.value !== 'afterChoices')

  const onFiles = async (files: FileList | null) => {
    setError(null)
    for (const file of Array.from(files ?? [])) {
      try {
        const asset = await readImageFile(file)
        dispatch({ type: 'ADD_FIGURE', questionId, asset })
      } catch {
        setError(`無法讀取「${file.name}」，請確認是圖片檔`)
      }
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <PanelSection
      title="題目附圖"
      description="圖片會跟著題目一起排版、換頁；大圖會自動縮小到 1400px 以內。"
      actions={
        <button type="button" className="text-btn" onClick={() => fileRef.current?.click()}>
          ＋ 插入圖片
        </button>
      }
    >
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => void onFiles(e.target.files)}
      />
      {error ? <p className="inspector__warn">{error}</p> : null}
      {!q.figures.length ? (
        <button
          type="button"
          className="figure-drop"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            void onFiles(e.dataTransfer.files)
          }}
        >
          點擊或拖曳圖片到這裡
        </button>
      ) : null}
      {q.figures.map((f, i) => {
        const asset = state.exam.assets[f.assetId]
        const setFig = (patch: Partial<Figure>) =>
          dispatch({ type: 'UPDATE_FIGURE', questionId, figureId: f.id, patch })
        return (
          <div key={f.id} className="figure-card">
            <div className="figure-card__top">
              {asset ? <img className="figure-card__thumb" src={asset.src} alt={`附圖 ${i + 1}`} /> : null}
              <span className="figure-card__name">
                附圖 {i + 1}
                {asset ? (
                  <small>
                    {asset.width}×{asset.height}
                  </small>
                ) : null}
              </span>
              <button
                type="button"
                className="icon-btn icon-btn--danger"
                title="移除圖片"
                onClick={() => dispatch({ type: 'REMOVE_FIGURE', questionId, figureId: f.id })}
              >
                <Icon name="trash" />
              </button>
            </div>
            <Segmented
              label="圖片位置"
              value={options.some((o) => o.value === f.placement) ? f.placement : 'below'}
              options={options}
              onChange={(v) => setFig({ placement: v })}
            />
            <label className="ui-field">
              <span className="ui-field__label">
                寬度 <strong>{Math.round(f.widthRatio * 100)}%</strong>
                <span className="ui-field__hint">（佔{f.placement === 'right' ? '題目寬' : '欄寬'}）</span>
              </span>
              <input
                type="range"
                min={15}
                max={f.placement === 'right' ? 50 : 100}
                step={5}
                value={Math.round(f.widthRatio * 100)}
                onChange={(e) => setFig({ widthRatio: Number(e.target.value) / 100 })}
              />
            </label>
          </div>
        )
      })}
    </PanelSection>
  )
}

function ChoiceRow({
  questionId,
  choice,
  index,
  canRemove,
}: {
  questionId: string
  choice: Choice
  index: number
  canRemove: boolean
}) {
  const { state, dispatch } = useEditor()
  const fileRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const asset = choice.image ? state.exam.assets[choice.image.assetId] : undefined
  const label = choiceLabel(index)

  const onFile = async (file?: File) => {
    if (!file) return
    setError(null)
    try {
      dispatch({ type: 'SET_CHOICE_IMAGE', questionId, choiceId: choice.id, asset: await readImageFile(file) })
    } catch {
      setError('無法讀取這張圖片')
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="choice-block">
      <div className="choice-row">
        <span className="choice-row__label">{label}</span>
        <ColorField
          ariaLabel={`選項 ${label}`}
          value={choice.text}
          placeholder={asset ? '圖片說明，可留白' : undefined}
          onChange={(text) => dispatch({ type: 'UPDATE_CHOICE', questionId, choiceId: choice.id, text })}
        />
        <button type="button" className="icon-btn" title="插入選項圖片" onClick={() => fileRef.current?.click()}>
          <Icon name="image" />
        </button>
        <button
          type="button"
          className="icon-btn icon-btn--danger"
          title="刪除選項"
          disabled={!canRemove}
          onClick={() => dispatch({ type: 'REMOVE_CHOICE', questionId, choiceId: choice.id })}
        >
          <Icon name="trash" />
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
      </div>
      {error ? <p className="choice-block__error">{error}</p> : null}
      {asset && choice.image ? (
        <div className="choice-row__image">
          <img className="choice-row__thumb" src={asset.src} alt={`${label} 的圖片`} />
          <label className="ui-field choice-row__ratio">
            <span className="ui-field__label">
              圖片寬度 <strong>{Math.round(choice.image.widthRatio * 100)}%</strong>
            </span>
            <input
              type="range"
              min={30}
              max={100}
              step={5}
              value={Math.round(choice.image.widthRatio * 100)}
              onChange={(e) =>
                dispatch({
                  type: 'SET_CHOICE_IMAGE_RATIO',
                  questionId,
                  choiceId: choice.id,
                  widthRatio: Number(e.target.value) / 100,
                })
              }
            />
          </label>
          <button
            type="button"
            className="icon-btn icon-btn--danger"
            title="移除圖片"
            onClick={() => dispatch({ type: 'SET_CHOICE_IMAGE', questionId, choiceId: choice.id, asset: null })}
          >
            <Icon name="trash" />
          </button>
        </div>
      ) : null}
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
      <PanelSection title={`第 ${num} 題・${plainText(section.title)}`}>
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
        <div className="ui-field">
          <span className="ui-field__label">題目</span>
          <ColorField
            ariaLabel="題目"
            multiline
            rows={4}
            value={q.stem}
            placeholder={q.type === 'fill_blank' ? '例：3 + 4 = ＿＿＿＿' : '輸入題目內容'}
            onChange={(stem) => set({ stem })}
          />
        </div>
      </PanelSection>

      <PanelSection title="文字樣式" description="題號、題幹與選項共用這個字級與粗體，整份試卷一起套用。">
        <ExamTextStyle role="question_body" label="題文" />
      </PanelSection>

      {isChoiceType(q.type) ? (
        <PanelSection
          title="選項"
          description="每個選項都能附一張圖；只有圖片時，圖會跟在選項代號旁邊。"
          actions={
            <button type="button" className="text-btn" onClick={() => dispatch({ type: 'ADD_CHOICE', questionId: q.id })}>
              ＋ 新增選項
            </button>
          }
        >
          {q.choices.map((c, i) => (
            <ChoiceRow key={c.id} questionId={q.id} choice={c} index={i} canRemove={q.choices.length > 2} />
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

      <FiguresEditor questionId={q.id} />

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
