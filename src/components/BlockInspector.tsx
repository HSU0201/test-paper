import { useEffect, useRef, useState } from 'react'

import { readImageFile } from '../editor/documentIO'
import { useEditor } from '../editor/EditorContext'
import { findQuestion } from '../editor/examReducer'
import { withZhuyin } from '../editor/hanToZhuyin'
import { clockSvg, gridSvg, numberLineSvg, svgToAsset } from '../editor/mathFigures'
import { plainText } from '../editor/richText'
import { adoptTypedSubItems, hasSubItems, SUB_STYLE_LABEL, SUB_STYLES, type SubStyle, subStyleOf } from '../editor/subItems'
import { choiceHits } from '../export/answerMarks'
import { mergeTextLevelPreset } from '../types/document'
import {
  ASIDE_WIDTH_DEFAULT,
  ASIDE_WIDTH_MAX,
  ASIDE_WIDTH_MIN,
  type Asset,
  type Choice,
  choiceLabel,
  type ChoiceLayout,
  createMatchPair,
  FALSE_MARK,
  type Figure,
  FIGURE_MARK,
  type FigurePlacement,
  type FontOverride,
  FOOTER_CONTINUE_ID,
  FOOTER_END_ID,
  hasFigureMark,
  isChoiceType,
  matchAnswerText,
  matchLeftItems,
  type MatchPair,
  matchRightItems,
  NOTICE_CONTINUE,
  NOTICE_END,
  type NumberStyle,
  QUESTION_LEVEL_LABEL,
  QUESTION_TYPE_LABEL,
  questionAsideWidth,
  questionBlankCount,
  type QuestionLevel,
  questionNumbers,
  questionPoints,
  questionRowGroup,
  questionRowLines,
  type QuestionType,
  questionUsesZhuyin,
  type ScoreMode,
  type Section,
  sectionBlankUnit,
  type SectionFrame,
  sectionHeading,
  type SectionLayout,
  sectionRowSize,
  sectionScore,
  shuffled,
  TRUE_MARK,
  trueFalseAnswer,
  uniformQuestionScore,
} from '../types/exam'
import { ColorField, type ColorFieldHandle } from './ColorField'
import type { ExamTextRole } from './exam/ExamTextStyle'
import { SaveToLibraryButton } from './panels/ToolsPanel'
import { Icon, NumberField, PanelSection, Segmented, Switch } from './ui'

const QUESTION_TYPES = Object.keys(QUESTION_TYPE_LABEL) as QuestionType[]

/** 某一題覆寫全卷字級；關閉時刪除覆寫，改回跟隨全卷 */
function FontOverrideField({
  role,
  label,
  value,
  onChange,
}: {
  role: ExamTextRole
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
    return `每格 ${unit} 分，合計 ${total} 分。各題格數不同也不會標在題目上，配分寫在標題最後。`
  }
  const each = uniformQuestionScore(section)
  if (each == null) {
    return `本大題共 ${n} 題，配分不完全相同，合計 ${total} 分。標題只寫總分，每題最後會標出該題分數。`
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
          <ColorField ariaLabel="大題名稱" value={section.title} placeholder="大題名稱" onChange={(title) => set({ title })} />
        </div>
        <div className="ui-field">
          <span className="ui-field__label">作答說明</span>
          <ColorField
            ariaLabel="作答說明"
            multiline
            rows={2}
            value={section.instruction}
            placeholder={section.zhuyin ? '例：請看注音，選出正確的答案。' : '例：每題 4 分，答錯不倒扣。'}
            onChange={(instruction) => set({ instruction })}
          />
        </div>
        <div className="ui-field">
          <span className="ui-field__label">閱讀短文</span>
          <ColorField
            ariaLabel="閱讀短文"
            multiline
            rows={4}
            value={section.passage ?? ''}
            placeholder="閱讀測驗把文章貼在這裡。會印在說明和題目之間，並加上外框。"
            onChange={(passage) => set({ passage })}
          />
        </div>
      </PanelSection>

      <PanelSection
        title="這一大題的字級"
        description="只影響這一大題。全卷字級在左側「卷面 → 字級」。"
        collapsible
        storeKey="s-font"
        summary={section.headingStyle || section.instructionStyle ? '已單獨設定' : '跟全卷一樣'}
      >
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
            step={0.1}
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
              step={0.5}
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
        title="排列與外框"
        description="外框把這一題圍起來。直式表格是每一題一列，右側可以再拆一欄寫驗算。小題並排一次套到這一大題底下的每一題。"
        collapsible
        storeKey="s-layout"
        summary={[
          section.layout === 'rows' ? '直式表格' : section.layout === 'grid' ? '注音格' : '一般',
          (section.frame ?? 'none') !== 'none' ? '有外框' : '',
          sectionRowSize(section) === 2 ? '兩題一列' : sectionRowSize(section) === 'all' ? '全部同列' : '',
          section.zhuyin ? '注音' : '',
        ]
          .filter(Boolean)
          .join('・')}
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
              { value: 'grid', label: '注音格' },
            ]}
            onChange={(layout) => set({ layout })}
          />
        </div>
        {section.layout === 'grid' ? (
          <>
            <div className="exam-style__head">
              <span className="exam-style__label">國字格畫田字格</span>
              <Switch
                checked={section.gridGuide === true}
                label="國字格畫田字格"
                onChange={(gridGuide) => set({ gridGuide })}
              />
            </div>
            <p className="exam-style__follow">
              每一小題寫一個語詞，每個字一格：左邊國字、右邊注音。在題目文字裡選取字後，按「改成方格」讓學生寫國字，按「注音留白」讓學生寫注音，按「加上注音」兩個都印出來；只打國字沒加注音的，注音欄會空著。留白的字會自動印在答案卷上。橫向試卷由右往左直排。
            </p>
          </>
        ) : null}
        <div className="ui-field" hidden={section.layout === 'grid'}>
          <span className="ui-field__label">小題並排</span>
          <Segmented<'1' | '2' | 'all'>
            label="小題並排"
            value={section.rowSize === 2 ? '2' : section.rowSize === 'all' ? 'all' : '1'}
            options={[
              { value: '1', label: '一題一列' },
              { value: '2', label: '兩題一列' },
              { value: 'all', label: '全部同一列' },
            ]}
            onChange={(v) => set({ rowSize: v === '2' ? 2 : v === 'all' ? 'all' : 1 })}
          />
        </div>
        <p className="exam-style__follow" hidden={section.layout === 'grid'}>
          {section.rowSize === 'all'
            ? '這一大題的小題全部左右排在同一列。各題自己的「與下一題同一列」會關掉。'
            : section.rowSize === 2
              ? '1 跟 2、3 跟 4 並排，各題的並排也改成這樣。最後若剩一題，那題獨佔一列。'
              : '一題一列，各題自己的「與下一題同一列」會關掉。之後要某兩題並排，到左邊那一題再打開。'}
        </p>
        {(section.layout ?? 'flow') === 'rows' ? (
          <>
            <NumberField
              label="每列至少"
              suffix="行"
              min={2}
              max={12}
              value={section.rowLines ?? 4}
              onChange={(v) => set({ rowLines: Math.min(12, Math.max(2, Math.round(v))) })}
            />
            <p className="exam-style__follow">沒有另外設定的小題，每一列都留這麼多行。某一題要不同，改那一題的「這一列高度」。</p>
          </>
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
        <div className="exam-style">
          <div className="exam-style__head">
            <span className="exam-style__label">整題換成注音</span>
            <Switch
              checked={section.zhuyin === true}
              label="整題換成注音"
              onChange={(zhuyin) => withZhuyin(() => set({ zhuyin }))}
            />
          </div>
          <p className="exam-style__follow">
            打開後，這個大題的題幹和選項會改成注音，關掉會改回國字。只要某幾個字換成注音，不必開這裡，在文字裡選取後按「轉成注音」。讀音不對就直接改注音符號。音節和作答空格換行時不會被拆開。
          </p>
        </div>
      </PanelSection>

      <PanelSection
        title="跨欄保護"
        description="標題不會單獨留在欄位底部。"
        collapsible
        storeKey="s-keep"
        summary={section.keepTogether === 'whole' ? '整個大題不拆' : '標題＋第一題'}
      >
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
      <div className="ui-grid-2">
        <button type="button" className="btn btn--ghost" onClick={() => dispatch({ type: 'DUPLICATE_SECTION', id: section.id })}>
          <Icon name="copy" />
          複製大題
        </button>
        <SaveToLibraryButton section={section} />
      </div>
    </div>
  )
}

const PLACEMENT_OPTIONS: { value: FigurePlacement; label: string }[] = [
  { value: 'below', label: '下方' },
  { value: 'middle', label: '文中' },
  { value: 'right', label: '右側' },
  { value: 'afterChoices', label: '選後' },
]

type MathFigureKind = 'clock' | 'line' | 'grid'

/** 時鐘、數線、方格。填好數字後產生圖片，加到這一題 */
function MathFigureMaker({ onAdd, onError }: { onAdd: (asset: Asset) => void; onError: () => void }) {
  const [kind, setKind] = useState<MathFigureKind | null>(null)
  const [clock, setClock] = useState({ hour: 3, minute: 0, hands: true, numbers: true })
  const [line, setLine] = useState({ start: 0, end: 10, step: 1, labelEvery: 1, blanks: '' })
  const [grid, setGrid] = useState({ rows: 4, cols: 5 })
  const make = () => {
    let fig: { svg: string; width: number; height: number } | null = null
    if (kind === 'clock') fig = clockSvg(clock)
    if (kind === 'line') {
      const blanks = line.blanks
        .split(/[,，、\s]+/)
        .map((s) => Number(s))
        .filter((n) => Number.isFinite(n))
      fig = numberLineSvg({ ...line, blanks })
      if (!fig) {
        window.alert('數線的範圍不對：結束要大於開始，而且刻度不能超過 60 格。')
        return
      }
    }
    if (kind === 'grid') fig = gridSvg(grid)
    if (fig) svgToAsset(fig).then(onAdd, onError)
  }
  const num = (label: string, value: number, set: (n: number) => void, min = -999, max = 999) => (
    <NumberField label={label} min={min} max={max} value={value} onChange={(v) => set(v)} />
  )
  return (
    <div className="math-figure">
      <div className="math-figure__pick">
        <span className="ui-field__label">數學圖形</span>
        <Segmented<MathFigureKind | ''>
          label="數學圖形"
          value={kind ?? ''}
          options={[
            { value: 'clock', label: '時鐘' },
            { value: 'line', label: '數線' },
            { value: 'grid', label: '方格' },
          ]}
          onChange={(v) => setKind(v === kind ? null : v || null)}
        />
      </div>
      {kind === 'clock' ? (
        <>
          <div className="ui-grid-2">
            {num('時', clock.hour, (hour) => setClock({ ...clock, hour: Math.round(hour) }), 0, 12)}
            {num('分', clock.minute, (minute) => setClock({ ...clock, minute: Math.round(minute) }), 0, 59)}
          </div>
          <div className="ui-row">
            <span className="ui-row__label">畫出指針（關掉讓學生自己畫）</span>
            <Switch checked={clock.hands} label="畫出指針" onChange={(hands) => setClock({ ...clock, hands })} />
          </div>
          <div className="ui-row">
            <span className="ui-row__label">寫上 1–12</span>
            <Switch checked={clock.numbers} label="寫上數字" onChange={(numbers) => setClock({ ...clock, numbers })} />
          </div>
        </>
      ) : null}
      {kind === 'line' ? (
        <>
          <div className="ui-grid-2">
            {num('開始', line.start, (start) => setLine({ ...line, start }))}
            {num('結束', line.end, (end) => setLine({ ...line, end }))}
            {num('每格', line.step, (step) => setLine({ ...line, step }), 0.01)}
            {num('每幾格寫數字', line.labelEvery, (labelEvery) => setLine({ ...line, labelEvery }), 1, 20)}
          </div>
          <label className="ui-field">
            <span className="ui-field__label">要學生填的刻度</span>
            <input
              className="ui-input"
              value={line.blanks}
              placeholder="例：3, 7（印成（　））"
              onChange={(e) => setLine({ ...line, blanks: e.target.value })}
            />
          </label>
        </>
      ) : null}
      {kind === 'grid' ? (
        <div className="ui-grid-2">
          {num('列數', grid.rows, (rows) => setGrid({ ...grid, rows }), 1, 20)}
          {num('行數', grid.cols, (cols) => setGrid({ ...grid, cols }), 1, 20)}
        </div>
      ) : null}
      {kind ? (
        <button type="button" className="btn btn--ghost btn--block" onClick={make}>
          <Icon name="plus" />
          加到這一題
        </button>
      ) : null}
    </div>
  )
}

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
      title="附圖與數學圖形"
      description="圖片跟著題目走。要換位置，直接在卷面上拖曳圖片。"
      collapsible
      storeKey="q-figures"
      summary={q.figures.length ? `${q.figures.length} 張圖` : '沒有圖'}
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
      <MathFigureMaker
        onAdd={(asset) => dispatch({ type: 'ADD_FIGURE', questionId, asset })}
        onError={() => setError('圖形產生失敗，請再試一次')}
      />
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
  const question = findQuestion(state.exam, questionId)?.question
  const hits = question ? choiceHits(question) : []
  const correct = hits.includes(index)
  const toggleCorrect = () => {
    if (!question) return
    const letter = (i: number) => String.fromCharCode(65 + i)
    let next: number[]
    if (question.type === 'multi_choice') next = correct ? hits.filter((i) => i !== index) : [...hits, index]
    else next = correct ? [] : [index]
    dispatch({
      type: 'UPDATE_QUESTION',
      id: questionId,
      patch: { answer: next.sort((a, b) => a - b).map(letter).join(question.type === 'multi_choice' ? '、' : '') },
    })
  }

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
        <button
          type="button"
          className={`choice-row__correct${correct ? ' is-on' : ''}`}
          aria-pressed={correct}
          title={correct ? `${label} 是正確答案，再按一次取消` : `設成正確答案`}
          onClick={toggleCorrect}
        >
          {correct ? '✓' : ''}
        </button>
        <span className="choice-row__label">{label}</span>
        <ColorField
          ariaLabel={`選項 ${label}`}
          mathTools
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
  const stemRef = useRef<ColorFieldHandle>(null)
  const openedId = useRef<string | null>(null)
  const hit = findQuestion(state.exam, questionId)
  const stem = hit?.question.stem ?? ''
  useEffect(() => {
    if (openedId.current === questionId) return
    openedId.current = questionId
    if (!plainText(stem)) stemRef.current?.focus()
  }, [questionId, stem])
  if (!hit) return null
  const { question: q, section, index } = hit
  const num = questionNumbers(state.exam).get(q.id)
  const set = (patch: Partial<typeof q>) => dispatch({ type: 'UPDATE_QUESTION', id: q.id, patch })
  const adopt = adoptTypedSubItems(q.stem)

  return (
    <div className="inspector__body">
      <PanelSection title={`第 ${num} 題`} description={plainText(section.title) || '這個大題還沒有名稱'}>
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
          <span className="ui-field__label ui-field__label--split">
            <span>題目</span>
            <span className="ui-field__actions">
              <button
                type="button"
                className="text-btn"
                title="在游標處加上 ①②③ 這類子題號，號碼會自動排"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => stemRef.current?.insertSub()}
              >
                插入子題號
              </button>
              <button
                type="button"
                className="text-btn"
                title="附圖要插在句子中間時，先把游標點在那裡再按。也可以直接在卷面上拖曳圖片"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => stemRef.current?.insert(FIGURE_MARK)}
              >
                插入圖片位置
              </button>
            </span>
          </span>
          <ColorField
            ref={stemRef}
            ariaLabel="題目"
            mathTools
            multiline
            rows={4}
            value={q.stem}
            placeholder={
              questionUsesZhuyin(section, q)
                ? '例：小明有ㄐㄧˇ ˙ㄍㄜ蘋果？'
                : q.type === 'fill_blank'
                  ? '例：3 + 4 = ＿＿＿＿'
                  : '輸入題目內容'
            }
            onChange={(stem) => set({ stem })}
            subStyle={subStyleOf(q)}
          />
          {hasSubItems(q.stem) ? (
            <div className="ui-field">
              <span className="ui-field__label">子題號</span>
              <Segmented<SubStyle>
                label="子題號樣式"
                value={subStyleOf(q)}
                options={SUB_STYLES.map((value) => ({ value, label: SUB_STYLE_LABEL[value] }))}
                onChange={(subStyle) => set({ subStyle })}
              />
              <p className="exam-style__follow">按 Enter 自動接下一號；空的子題再按一次 Enter 就結束。</p>
            </div>
          ) : adopt ? (
            <p className="exam-style__follow">
              題目裡有自己打的子題號（{SUB_STYLE_LABEL[adopt.style]}…）。{' '}
              <button type="button" className="text-btn" onClick={() => set({ stem: adopt.stem, subStyle: adopt.style })}>
                換成自動子題號
              </button>
              {' '}之後刪掉或插入子題，號碼會自動重排，換行也會對齊。
            </p>
          ) : null}
          {hasFigureMark(q.stem) ? (
            <p className="exam-style__follow">［圖］不會印出來，只表示附圖插在這裡。</p>
          ) : null}
        </div>
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

      {q.type === 'matching' ? <MatchingEditor questionId={q.id} /> : null}

      <PanelSection
        title="答案"
        description={
          isChoiceType(q.type)
            ? '點選項旁的「✓」就是正確答案。只印在答案卷上。'
            : '只印在「匯出答案」的答案卷上，學生的卷子看不到。'
        }
      >
        {q.type === 'true_false' ? (
          <Segmented<string>
            label="是非題答案"
            value={trueFalseAnswer(q.answer)}
            options={[
              { value: TRUE_MARK, label: `${TRUE_MARK} 對` },
              { value: FALSE_MARK, label: `${FALSE_MARK} 錯` },
            ]}
            onChange={(answer) => set({ answer })}
          />
        ) : q.type === 'matching' ? (
          <p className="exam-style__follow">
            {matchLeftItems(q).length
              ? `依上面的配對自動產生：${matchAnswerText(q)}。答案卷會用紅線連起來。`
              : '先在「配對」填好左右兩邊。'}
          </p>
        ) : (
          <input
            className="ui-input"
            value={q.answer}
            aria-label="答案"
            placeholder={isChoiceType(q.type) ? '也可以直接打代號，例：C' : '輸入參考答案'}
            onChange={(e) => set({ answer: e.target.value })}
          />
        )}
      </PanelSection>

      <FiguresEditor questionId={q.id} />

      {(section.layout ?? 'flow') === 'rows' ? (
        <PanelSection
          title="直式格子"
          description="預設跟大題的「每列至少」一樣高。這裡改成別的數字，只有這一題不同；改回跟大題相同，就會再跟著一起變。右側欄留空，這一列就不拆開。"
        >
          <NumberField
            label="這一列高度"
            suffix="行"
            min={2}
            max={20}
            value={questionRowLines(section, q)}
            onChange={(v) => {
              const n = Math.min(20, Math.max(2, Math.round(v)))
              const shared = section.rowLines ?? 4
              set({ rowLines: n === shared ? 0 : n })
            }}
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
          <NumberField
            label="右側欄寬度"
            suffix="%"
            min={ASIDE_WIDTH_MIN}
            max={ASIDE_WIDTH_MAX}
            value={questionAsideWidth(q)}
            onChange={(v) => {
              const n = Math.min(ASIDE_WIDTH_MAX, Math.max(ASIDE_WIDTH_MIN, Math.round(v)))
              set({ asideWidth: n === ASIDE_WIDTH_DEFAULT ? 0 : n })
            }}
          />
          <p className="exam-style__follow">
            只改這一列，其他列不受影響。改回 {ASIDE_WIDTH_DEFAULT}% 就用預設寬度。右側欄沒有文字時，寬度不會出現。
          </p>
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

      <PanelSection
        title="注音與並排"
        collapsible
        storeKey="q-zhuyin"
        summary={[questionUsesZhuyin(section, q) ? '注音' : '', q.pairNext ? '與下一題同列' : ''].filter(Boolean).join('・') || '未使用'}
      >
        <div className="exam-style">
          <div className="exam-style__head">
            <span className="exam-style__label">這一題換成注音</span>
            <Switch
              checked={questionUsesZhuyin(section, q)}
              label="這一題換成注音"
              onChange={(zhuyin) => withZhuyin(() => set({ zhuyin }))}
            />
          </div>
          <p className="exam-style__follow">
            打開會把這一題的題幹和選項改成注音，關掉會改回國字。只換幾個字時，在題目文字裡選取後按「轉成注音」。
            {typeof q.zhuyin === 'boolean' ? (
              <>
                {' '}
                這一題已單獨設定。
                <button type="button" className="text-btn" onClick={() => withZhuyin(() => set({ zhuyin: undefined }))}>
                  改回跟隨大題
                </button>
              </>
            ) : (
              <> 目前跟隨大題（{section.zhuyin ? '整題注音' : '不自動改'}）。</>
            )}
          </p>
        </div>
        {sectionRowSize(section) !== 1 ? (
          <p className="exam-style__follow">
            這一題跟著大題：{section.rowSize === 'all' ? '全部小題同一列' : '兩題一列'}。要改的話，請到大題的「小題並排」。
          </p>
        ) : questionRowGroup(section, index)?.start !== index && questionRowGroup(section, index) ? (
          <p className="exam-style__follow">
            這一題在上一題的右半邊。要改回各佔一列，請到上一題關掉「與下一題同一列」。
          </p>
        ) : (
          <>
            <div className="ui-row">
              <span className="ui-row__label">與下一題同一列</span>
              <Switch checked={q.pairNext === true} label="與下一題同一列" onChange={(v) => set({ pairNext: v })} />
            </div>
            <p className="exam-style__follow">
              {section.questions[index + 1]
                ? (section.layout ?? 'flow') === 'rows'
                  ? '打開後，這一題在左、下一題在右，中間有分隔線。'
                  : '打開後，這一題在左、下一題在右，各佔一半。'
                : '這是最後一題，沒有下一題可以並排，打開後仍會佔滿整列。'}
            </p>
          </>
        )}
      </PanelSection>

      <PanelSection
        title="這一題的字級"
        description="只影響這一題。全卷字級在左側「卷面 → 字級」或「工具 → 字級與列印」。"
        collapsible
        storeKey="q-font"
        summary={q.bodyStyle ? '已單獨設定' : '跟全卷一樣'}
      >
        <FontOverrideField
          role="question_body"
          label="題文"
          value={q.bodyStyle}
          onChange={(bodyStyle) => set({ bodyStyle })}
        />
      </PanelSection>


      <PanelSection
        title="雙向細目表"
        description="可以不填。填了之後，「工具 → 答案表與雙向細目表」會統計題數和配分比例。"
        collapsible
        storeKey="q-blueprint"
        summary={[q.unit, q.skill, q.level ? QUESTION_LEVEL_LABEL[q.level] : ''].filter(Boolean).join('・') || '未填'}
      >
        <div className="ui-grid-2">
          <label className="ui-field">
            <span className="ui-field__label">單元／目標</span>
            <input
              className="ui-input"
              list="unit-options"
              value={q.unit ?? ''}
              placeholder="例：第三課"
              onChange={(e) => set({ unit: e.target.value || undefined })}
            />
          </label>
          <label className="ui-field">
            <span className="ui-field__label">能力</span>
            <input
              className="ui-input"
              list="skill-options"
              value={q.skill ?? ''}
              placeholder="例：理解"
              onChange={(e) => set({ skill: e.target.value || undefined })}
            />
          </label>
        </div>
        <datalist id="unit-options">
          {[...new Set(state.exam.sections.flatMap((s) => s.questions.map((x) => x.unit ?? '').filter(Boolean)))].map(
            (u) => (
              <option key={u} value={u} />
            ),
          )}
        </datalist>
        <datalist id="skill-options">
          {SKILL_OPTIONS.map((u) => (
            <option key={u} value={u} />
          ))}
        </datalist>
        <div className="ui-field">
          <span className="ui-field__label">難易度</span>
          <Segmented<QuestionLevel | ''>
            label="難易度"
            value={q.level ?? ''}
            options={[
              { value: '', label: '未填' },
              ...(['easy', 'medium', 'hard'] as QuestionLevel[]).map((value) => ({
                value,
                label: QUESTION_LEVEL_LABEL[value],
              })),
            ]}
            onChange={(level) => set({ level: level || undefined })}
          />
        </div>
      </PanelSection>

      <button
        type="button"
        className="btn btn--ghost btn--block"
        onClick={() => dispatch({ type: 'ADD_QUESTION', sectionId: section.id, afterId: q.id })}
      >
        <Icon name="plus" />
        在下方新增一題
      </button>
      <button type="button" className="btn btn--ghost btn--block" onClick={() => dispatch({ type: 'DUPLICATE_QUESTION', id: q.id })}>
        <Icon name="copy" />
        複製這一題
      </button>
    </div>
  )
}

const SKILL_OPTIONS = ['記憶', '理解', '應用', '分析', '評鑑', '創造']

/** 連連看：每一組左右各一格。左邊空白就是右欄多放的干擾項 */
function MatchingEditor({ questionId }: { questionId: string }) {
  const { state, dispatch } = useEditor()
  const hit = findQuestion(state.exam, questionId)
  if (!hit) return null
  const q = hit.question
  const pairs = q.pairs ?? []
  const setPairs = (next: MatchPair[], order?: string[]) =>
    dispatch({ type: 'UPDATE_QUESTION', id: q.id, patch: { pairs: next, ...(order ? { matchOrder: order } : {}) } })
  const update = (id: string, patch: Partial<MatchPair>) => setPairs(pairs.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  const right = matchRightItems(q)
  return (
    <PanelSection
      title="配對"
      description="左欄依順序印出，右欄會打亂。左邊留空就是右欄多放的干擾項。"
      actions={
        <button type="button" className="text-btn" onClick={() => setPairs([...pairs, createMatchPair()])}>
          ＋ 新增一組
        </button>
      }
    >
      <div className="match-editor">
        <div className="match-editor__head" aria-hidden>
          <span>左欄</span>
          <span>右欄（正確配對）</span>
          <span />
        </div>
        {pairs.map((p, i) => (
          <div key={p.id} className="match-editor__row">
            <input
              className="ui-input"
              aria-label={`第 ${i + 1} 組左欄`}
              value={p.left}
              placeholder={i === 0 ? '例：蘋果' : '留空＝干擾項'}
              onChange={(e) => update(p.id, { left: e.target.value })}
            />
            <input
              className="ui-input"
              aria-label={`第 ${i + 1} 組右欄`}
              value={p.right}
              placeholder={i === 0 ? '例：紅色' : ''}
              onChange={(e) => update(p.id, { right: e.target.value })}
            />
            <button
              type="button"
              className="icon-btn"
              title="刪除這一組"
              disabled={pairs.length <= 1}
              onClick={() => setPairs(pairs.filter((x) => x.id !== p.id))}
            >
              <Icon name="trash" />
            </button>
          </div>
        ))}
      </div>
      <div className="ui-row">
        <span className="ui-row__label">右欄順序：{right.map((p) => p.right.trim()).join('、') || '（還沒有）'}</span>
        <button
          type="button"
          className="text-btn"
          disabled={right.length < 2}
          onClick={() => {
            const ids = right.map((p) => p.id)
            let next = shuffled(ids)
            for (let k = 0; k < 5 && next.join() === ids.join(); k++) next = shuffled(ids)
            setPairs(pairs, next)
          }}
        >
          重新打亂
        </button>
      </div>
    </PanelSection>
  )
}

function NoticeEditor({ id }: { id: string }) {
  const { state, dispatch } = useEditor()
  const footer = state.exam.footer
  const isEnd = id === FOOTER_END_ID
  const isContinue = id === FOOTER_CONTINUE_ID
  if ((!isEnd && !isContinue) || (isEnd && !footer.endOn) || (isContinue && !footer.continueOn)) return null
  const text = isEnd ? footer.endText : footer.continueText
  const setText = (value: string) =>
    dispatch({ type: 'SET_FOOTER', patch: isEnd ? { endText: value } : { continueText: value } })
  return (
    <div className="inspector__body">
      <PanelSection
        title={isEnd ? '作答結束' : '下一頁還有題目'}
        description={
          isEnd
            ? '接在最後一題的下面，跟著題目走，不固定在頁尾。'
            : '有下一頁時印在該頁下方。左右兩欄時只佔右欄，不橫跨整頁。整份只有一頁時不會出現。'
        }
      >
        <div className="ui-field">
          <span className="ui-field__label">文字</span>
          <ColorField ariaLabel="頁尾文字" value={text} onChange={setText} />
        </div>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => setText(isEnd ? NOTICE_END : NOTICE_CONTINUE)}
        >
          還原預設文字
        </button>
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
