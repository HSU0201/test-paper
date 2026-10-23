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
  questionBlankCount,
  questionNumbers,
  questionPoints,
  sectionBlankUnit,
  sectionHeading,
  sectionScore,
  uniformQuestionScore,
  NOTICE_CONTINUE,
  NOTICE_END,
  type Choice,
  type ChoiceLayout,
  type FontOverride,
  type Notice,
  type NumberStyle,
  type QuestionType,
  type ScoreMode,
  type Section,
  type SectionFrame,
  type SectionLayout,
} from '../types/exam'
import { Icon, NumberField, PanelSection, Segmented, Switch } from './ui'
import { ColorField } from './ColorField'
import { plainText } from '../editor/richText'
import { mergeTextLevelPreset, type BuiltinTextLevelKey, type TextLevelPreset } from '../types/document'

const QUESTION_TYPES = Object.keys(QUESTION_TYPE_LABEL) as QuestionType[]

/** 全卷共用的大題標題、作答說明、小題題文字級與粗體 */
export function ExamTextStyle({
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

/** 某一題覆寫全卷字級；關閉時刪除覆寫，改回跟隨全卷 */
function FontOverrideField({
  role,
  label,
  value,
  onChange,
}: {
  role: Extract<BuiltinTextLevelKey, 'section_heading' | 'instruction' | 'question_body'>
  label: string
  value?: FontOverride
  onChange: (next: FontOverride | undefined) => void
}) {
  const { state } = useEditor()
  const preset = mergeTextLevelPreset(role, state.textLevelOverrides)
  const custom = value?.fontSize != null || value?.bold != null
  const fontSize = value?.fontSize ?? preset.fontSize
  const bold = value?.bold ?? !!preset.bold
  return (
    <div className="exam-style">
      <div className="exam-style__head">
        <span className="exam-style__label">{label}</span>
        <span className="exam-style__override">
          <span className="ui-field__label">單獨設定</span>
          <Switch
            checked={custom}
            label={`${label}單獨設定`}
            onChange={(on) => onChange(on ? { fontSize: preset.fontSize, bold: !!preset.bold } : undefined)}
          />
        </span>
      </div>
      {custom ? (
        <div className="exam-style__row">
          <NumberField
            label="字級"
            suffix="px"
            min={8}
            max={72}
            value={fontSize}
            onChange={(v) => onChange({ fontSize: Math.min(72, Math.max(8, Math.round(v))), bold })}
          />
          <div className="exam-style__bold">
            <span className="ui-field__label">粗體</span>
            <Switch checked={bold} label={`${label}粗體`} onChange={(v) => onChange({ fontSize, bold: v })} />
          </div>
        </div>
      ) : (
        <p className="exam-style__follow">
          跟隨全卷 {preset.fontSize}px{preset.bold ? '・粗體' : ''}
        </p>
      )}
    </div>
  )
}

function sectionScoreDescription(section: Section): string {
  const n = section.questions.length
  const total = sectionScore(section)
  if (!n) return '尚未加入小題。新題使用下方預設配分，每題分數之後仍可各自調整。'
  if (section.scoreMode === 'blank') {
    const unit = sectionBlankUnit(section)
    return `每格 ${unit} 分，合計 ${total} 分。各題格數不同也不會標在題號前面，配分寫在標題最後。`
  }
  const each = uniformQuestionScore(section)
  if (each == null) {
    return `本大題共 ${n} 題，配分不完全相同，合計 ${total} 分。標題只寫總分，每題題號後會標出該題分數。`
  }
  return `本大題共 ${n} 題，每題 ${each} 分，合計 ${total} 分。標題最後會寫「每題 ${each} 分」。`
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

      <PanelSection title="文字樣式" description="只影響這一大題。全卷預設在左側大綱的「全卷字級」。">
        <FontOverrideField
          role="section_heading"
          label="大題標題"
          value={section.headingStyle}
          onChange={(headingStyle) => set({ headingStyle })}
        />
        <FontOverrideField
          role="instruction"
          label="作答說明"
          value={section.instructionStyle}
          onChange={(instructionStyle) => set({ instructionStyle })}
        />
      </PanelSection>

      <PanelSection title="配分" description={sectionScoreDescription(section)}>
        <Segmented<ScoreMode>
          label="配分方式"
          value={section.scoreMode}
          options={[
            { value: 'each', label: '每題' },
            { value: 'blank', label: '每格' },
          ]}
          onChange={(v) =>
            set(v === 'blank' ? { scoreMode: 'blank', blankScore: section.blankScore || section.defaultScore || 2 } : { scoreMode: 'each' })
          }
        />
        {section.scoreMode === 'blank' ? (
          <NumberField
            label="每格分數"
            suffix="分"
            min={0}
            max={100}
            value={section.blankScore}
            onChange={(v) => set({ blankScore: v })}
          />
        ) : (
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
        )}
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

      <PanelSection
        title="卷面格式"
        description="外框把這一題圍起來。直式表格是每一題一列，右側可以再拆一欄寫驗算。"
      >
        <div className="ui-field">
          <span className="ui-field__label">外框</span>
          <Segmented<SectionFrame>
            label="外框"
            value={section.frame ?? 'none'}
            options={[
              { value: 'none', label: '無' },
              { value: 'body', label: '只框題目' },
              { value: 'all', label: '連標題' },
            ]}
            onChange={(frame) => set({ frame })}
          />
        </div>
        <div className="ui-field">
          <span className="ui-field__label">排列</span>
          <Segmented<SectionLayout>
            label="排列"
            value={section.layout ?? 'flow'}
            options={[
              { value: 'flow', label: '一般' },
              { value: 'rows', label: '直式表格' },
            ]}
            onChange={(layout) => set({ layout })}
          />
        </div>
        {(section.layout ?? 'flow') === 'rows' ? (
          <NumberField
            label="每列至少"
            suffix="行"
            min={2}
            max={12}
            value={section.rowLines ?? 4}
            onChange={(v) => set({ rowLines: Math.min(12, Math.max(2, Math.round(v))) })}
          />
        ) : null}
        <div className="ui-field">
          <span className="ui-field__label">題號</span>
          <Segmented<NumberStyle>
            label="題號"
            value={section.numberStyle ?? 'dot'}
            options={[
              { value: 'dot', label: '1.' },
              { value: 'paren', label: '(1)' },
            ]}
            onChange={(numberStyle) => set({ numberStyle })}
          />
        </div>
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
  { value: 'below', label: '下方' },
  { value: 'middle', label: '文中' },
  { value: 'right', label: '右側' },
  { value: 'afterChoices', label: '選後' },
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
      description="圖片跟著題目排版。在卷面上拖曳圖片，決定它接在題幹的哪裡；左右仍用拉霸。"
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
        const align = f.align ?? (f.placement === 'middle' ? 0 : 0.5)
        const alignLabel = align <= 0.34 ? '靠左' : align >= 0.66 ? '靠右' : '置中'
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
              onChange={(v) => {
                const patch: Partial<Figure> = { placement: v }
                if (v === 'middle' && f.align == null) patch.align = 0
                setFig(patch)
              }}
            />
            {f.placement === 'middle' || f.placement === 'below' || f.placement === 'afterChoices' ? (
              <p className="exam-style__follow">
                {state.pageWidth > state.pageHeight
                  ? '在卷面上按住圖片，拖到要接的那個字旁邊，鬆開後就接在它後面。'
                  : '在卷面上按住圖片上下拖曳，鬆開後會接到最接近的那一行後面。'}
                {f.placement === 'middle' && typeof f.afterLine === 'number'
                  ? f.afterLine === 0
                    ? '目前在題幹最前面。'
                    : `目前接在第 ${f.afterLine} ${state.pageWidth > state.pageHeight ? '個字' : '行'}後面。`
                  : null}
              </p>
            ) : null}
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
            {f.placement !== 'right' ? (
              <label className="ui-field">
                <span className="ui-field__label">
                  左右位置 <strong>{alignLabel}</strong>
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  aria-label="左右位置"
                  value={Math.round(align * 100)}
                  onChange={(e) => setFig({ align: Number(e.target.value) / 100 })}
                />
              </label>
            ) : null}
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
          {section.scoreMode === 'blank' ? (
            <NumberField
              label="格數"
              suffix="格"
              min={0}
              max={30}
              value={questionBlankCount(q)}
              onChange={(v) => set({ blanks: Math.max(0, Math.round(v)) })}
            />
          ) : (
            <NumberField label="配分" suffix="分" min={0} max={100} value={q.score} onChange={(v) => set({ score: v })} />
          )}
        </div>
        {section.scoreMode === 'blank' ? (
          <div className="exam-style__follow">
            每格 {sectionBlankUnit(section)} 分，這一題 {questionPoints(section, q)} 分。
            {typeof q.blanks === 'number' ? '格數已手動指定。' : '尚未指定時，依題目裡的（ ）與底線計算。'}
            {typeof q.blanks === 'number' ? (
              <>
                {' '}
                <button type="button" className="text-btn" onClick={() => set({ blanks: undefined })}>
                  改回自動計算
                </button>
              </>
            ) : null}
          </div>
        ) : null}
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

      <PanelSection title="文字樣式" description="題號、題幹與選項一起套用，只影響這一題。全卷預設在左側大綱。">
        <FontOverrideField
          role="question_body"
          label="題文"
          value={q.bodyStyle}
          onChange={(bodyStyle) => set({ bodyStyle })}
        />
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

      {(section.layout ?? 'flow') === 'rows' ? (
        <PanelSection title="直式格子" description="這一列的高度。右側欄留空就跟其他列一樣寬；要驗算就填「驗算：」。">
          <NumberField
            label="這一列高度"
            suffix="行"
            min={2}
            max={20}
            value={q.answerLines > 0 ? q.answerLines : (section.rowLines ?? 4)}
            onChange={(v) => set({ answerLines: Math.max(2, Math.round(v)) })}
          />
          <div className="ui-field">
            <span className="ui-field__label">右側欄</span>
            <input
              className="ui-input"
              value={q.aside ?? ''}
              placeholder="例如：驗算："
              onChange={(e) => set({ aside: e.target.value })}
            />
          </div>
        </PanelSection>
      ) : null}

      {q.type === 'short_answer' && (section.layout ?? 'flow') !== 'rows' ? (
        <PanelSection title="作答區" description="行數是留給學生寫的空白。只留白就不會畫底線。">
          <NumberField
            label="作答行數"
            suffix="行"
            min={0}
            max={20}
            value={q.answerLines}
            onChange={(v) => set({ answerLines: Math.max(0, Math.round(v)) })}
          />
          <div className="ui-field">
            <span className="ui-field__label">底線</span>
            <Segmented<'line' | 'blank'>
              label="底線"
              value={q.answerRuled === false ? 'blank' : 'line'}
              options={[
                { value: 'line', label: '畫底線' },
                { value: 'blank', label: '只留白' },
              ]}
              onChange={(v) => set({ answerRuled: v === 'line' })}
            />
          </div>
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

function NoticeEditor({ id }: { id: string }) {
  const { state, dispatch } = useEditor()
  const notice = (state.exam.notices ?? []).find((n) => n.id === id)
  if (!notice) return null
  const set = (patch: Partial<Pick<Notice, 'text' | 'afterSectionId'>>) =>
    dispatch({ type: 'UPDATE_NOTICE', id, patch })
  const anchor = notice.afterSectionId && state.exam.sections.some((s) => s.id === notice.afterSectionId) ? notice.afterSectionId : ''
  return (
    <div className="inspector__body">
      <PanelSection title="提示框" description="會印成置中、帶框的一行字。常用在頁末或整份試卷的最後。">
        <div className="ui-field">
          <span className="ui-field__label">文字</span>
          <ColorField ariaLabel="提示文字" value={notice.text} onChange={(text) => set({ text })} />
        </div>
        <div className="notice-presets">
          <button type="button" className="btn btn--ghost" onClick={() => set({ text: NOTICE_CONTINUE })}>
            {NOTICE_CONTINUE}
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => set({ text: NOTICE_END })}>
            {NOTICE_END}
          </button>
        </div>
        <label className="ui-field">
          <span className="ui-field__label">位置</span>
          <select
            className="ui-input"
            value={anchor}
            onChange={(e) => set({ afterSectionId: e.target.value || null })}
          >
            {state.exam.sections.map((s, i) => (
              <option key={s.id} value={s.id}>
                接在{sectionHeading(s, i)}之後
              </option>
            ))}
            <option value="">卷末</option>
          </select>
        </label>
      </PanelSection>
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
  if (ref.kind === 'notice') return <NoticeEditor id={ref.id} />
  return <QuestionEditor questionId={ref.id} />
}
