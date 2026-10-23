import { AnimatePresence, motion } from 'motion/react'
import { useId, useState, type DragEvent, type KeyboardEvent } from 'react'
import { useEditor } from '../../editor/EditorContext'
import { hasRubyMarkup, hasZhuyinMarkup, plainText } from '../../editor/richText'
import {
  examTotals,
  FOOTER_CONTINUE_ID,
  FOOTER_END_ID,
  QUESTION_TYPE_LABEL,
  questionRowGroup,
  sectionRowSize,
  questionNumbers,
  questionPoints,
  sectionHeading,
  sectionScore,
  type BlockRef,
} from '../../types/exam'
import { easeOut, layoutSpring } from '../../motion/presets'
import { ExamTextStyle } from '../BlockInspector'
import { Icon, Segmented, Switch } from '../ui'

function SelectMark({ on }: { on: boolean }) {
  if (!on) return null
  return <motion.span layoutId="outline-selection" className="outline-row__mark" transition={layoutSpring} />
}

type Drag = BlockRef | null
/** 放置位置：大題用 sectionIndex；小題用 sectionId + index */
type Drop = { kind: 'section'; index: number } | { kind: 'question'; sectionId: string; index: number } | null

function half(e: DragEvent): 'before' | 'after' {
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
  return e.clientY < r.top + r.height / 2 ? 'before' : 'after'
}

export function OutlinePanel() {
  const { state, dispatch, flow } = useEditor()
  const { exam, selectedBlock } = state
  const [drag, setDrag] = useState<Drag>(null)
  const [drop, setDrop] = useState<Drop>(null)
  const [fontsOpen, setFontsOpen] = useState(false)
  const fontsBodyId = useId()
  const nums = questionNumbers(exam)
  const totals = examTotals(exam)
  const overflowIds = new Set(flow.warnings.flatMap((w) => (w.type === 'oversize' ? [w.ref.id] : [])))
  const pageOf = new Map(flow.blocks.map((b) => [b.ref.id, b.page]))

  const select = (ref: BlockRef) => dispatch({ type: 'SELECT_BLOCK', ref })
  const isSel = (id: string) => selectedBlock?.id === id

  const startDrag = (ref: BlockRef) => (e: DragEvent) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', ref.id)
    setDrag(ref)
  }
  const endDrag = () => {
    setDrag(null)
    setDrop(null)
  }
  const commitDrop = (e: DragEvent) => {
    e.preventDefault()
    if (drag && drop) {
      if (drag.kind === 'section' && drop.kind === 'section') {
        dispatch({ type: 'MOVE_SECTION', id: drag.id, toIndex: drop.index })
      } else if (drag.kind === 'question' && drop.kind === 'question') {
        dispatch({ type: 'MOVE_QUESTION', id: drag.id, toSectionId: drop.sectionId, toIndex: drop.index })
      }
    }
    endDrag()
  }

  const onKey = (ref: BlockRef, sectionId: string) => (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      dispatch({ type: 'ADD_QUESTION', sectionId, afterId: ref.kind === 'question' ? ref.id : undefined })
    } else if (e.key === 'Delete') {
      e.preventDefault()
      e.stopPropagation()
      dispatch(ref.kind === 'section' ? { type: 'REMOVE_SECTION', id: ref.id } : { type: 'REMOVE_QUESTION', id: ref.id })
    } else if (e.key === ' ') {
      e.preventDefault()
      select(ref)
    }
  }

  const dropClass = (match: boolean, pos: 'before' | 'after') => (match ? ` is-drop-${pos}` : '')
  const footer = exam.footer

  return (
    <div className="side-panel__scroll outline">
      <div className="outline__summary">
        <div>
          <strong>{totals.score}</strong>
          <span>總分</span>
        </div>
        <div>
          <strong>{totals.questions}</strong>
          <span>題數</span>
        </div>
        <div>
          <strong>{totals.sections}</strong>
          <span>大題</span>
        </div>
      </div>

      <div className="outline__numbering">
        <span className="ui-field__label">題號</span>
        <Segmented
          label="題號方式"
          value={exam.numbering}
          options={[
            { value: 'continuous', label: '全卷連號' },
            { value: 'perSection', label: '各大題重編' },
          ]}
          onChange={(v) => dispatch({ type: 'SET_NUMBERING', numbering: v })}
        />
      </div>

      <div className={`outline__fonts${fontsOpen ? ' is-open' : ''}`}>
        <button
          type="button"
          className="outline__fonts-toggle"
          aria-expanded={fontsOpen}
          aria-controls={fontsBodyId}
          onClick={() => setFontsOpen((open) => !open)}
        >
          <span>全卷字級</span>
          <span className="outline__fonts-chevron" aria-hidden>
            <Icon name="down" />
          </span>
        </button>
        <AnimatePresence initial={false}>
          {fontsOpen ? (
            <motion.div
              id={fontsBodyId}
              key="fonts"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: easeOut }}
              style={{ overflow: 'hidden' }}
            >
              <div className="outline__fonts-body">
                <p className="outline__fonts-hint">
                  套用到所有大題與小題。某一題要不同，點選後在右側打開「單獨設定」。
                </p>
                <ExamTextStyle role="section_heading" label="大題標題" />
                <ExamTextStyle role="instruction" label="作答說明" />
                <ExamTextStyle role="question_body" label="小題題文" />
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {exam.sections.length === 0 ? (
        <div className="outline__empty">
          <p>還沒有任何大題。可以先放入一份範例，看看選項排列、外框、底線、直式表格和圖片。</p>
          <button type="button" className="btn btn--primary btn--block" onClick={() => dispatch({ type: 'LOAD_EXAMPLE' })}>
            放入排版範例
          </button>
        </div>
      ) : null}

      <ol className="outline__sections">
        {exam.sections.map((s, si) => {
          const sectionDropBefore = drag?.kind === 'section' && drop?.kind === 'section' && drop.index === si
          const sectionDropAfter =
            drag?.kind === 'section' && drop?.kind === 'section' && drop.index === si + 1 && si === exam.sections.length - 1
          return (
            <li
              key={s.id}
              className={`outline-section${drag?.id === s.id ? ' is-dragging' : ''}${dropClass(sectionDropBefore, 'before')}${dropClass(sectionDropAfter, 'after')}`}
            >
              <div
                className={`outline-row outline-row--section${isSel(s.id) ? ' is-selected' : ''}${overflowIds.has(s.id) ? ' is-overflow' : ''}`}
                role="button"
                tabIndex={0}
                draggable
                onDragStart={startDrag({ kind: 'section', id: s.id })}
                onDragEnd={endDrag}
                onDragOver={(e) => {
                  if (!drag) return
                  e.preventDefault()
                  if (drag.kind === 'section') {
                    setDrop({ kind: 'section', index: half(e) === 'before' ? si : si + 1 })
                  } else if (drag.kind === 'question') {
                    setDrop({ kind: 'question', sectionId: s.id, index: 0 })
                  }
                }}
                onDrop={commitDrop}
                onClick={() => select({ kind: 'section', id: s.id })}
                onKeyDown={onKey({ kind: 'section', id: s.id }, s.id)}
              >
                <SelectMark on={isSel(s.id)} />
                <span className="outline-row__grip" aria-hidden>
                  ⋮⋮
                </span>
                <span className="outline-row__title">
                  {plainText(s.title).trim() ? sectionHeading(s, si) : `${sectionHeading(s, si)}（未輸入名稱）`}
                </span>
                {(s.frame ?? 'none') !== 'none' ? <span className="outline-row__badge">框</span> : null}
                {(s.layout ?? 'flow') === 'rows' ? <span className="outline-row__badge">表</span> : null}
                {sectionRowSize(s) === 2 ? <span className="outline-row__badge">兩題</span> : null}
                {sectionRowSize(s) === 'all' ? <span className="outline-row__badge">同列</span> : null}
                {s.zhuyin ? <span className="outline-row__badge">注音</span> : null}
                {pageOf.has(s.id) ? <span className="outline-row__page">P{pageOf.get(s.id)! + 1}</span> : null}
                <span className="outline-row__score">{sectionScore(s)} 分</span>
              </div>

              <ol className="outline__questions">
                {s.questions.map((q, qi) => {
                  const showBefore =
                    drag?.kind === 'question' && drop?.kind === 'question' && drop.sectionId === s.id && drop.index === qi
                  const showAfter =
                    drag?.kind === 'question' &&
                    drop?.kind === 'question' &&
                    drop.sectionId === s.id &&
                    drop.index === qi + 1 &&
                    qi === s.questions.length - 1
                  return (
                    <li key={q.id} className={`${dropClass(showBefore, 'before')}${dropClass(showAfter, 'after')}`}>
                      <div
                        className={`outline-row outline-row--question${isSel(q.id) ? ' is-selected' : ''}${drag?.id === q.id ? ' is-dragging' : ''}${overflowIds.has(q.id) ? ' is-overflow' : ''}`}
                        role="button"
                        tabIndex={0}
                        draggable
                        onDragStart={(e) => {
                          e.stopPropagation()
                          startDrag({ kind: 'question', id: q.id })(e)
                        }}
                        onDragEnd={endDrag}
                        onDragOver={(e) => {
                          if (drag?.kind !== 'question') return
                          e.preventDefault()
                          e.stopPropagation()
                          setDrop({ kind: 'question', sectionId: s.id, index: half(e) === 'before' ? qi : qi + 1 })
                        }}
                        onDrop={(e) => {
                          e.stopPropagation()
                          commitDrop(e)
                        }}
                        onClick={() => select({ kind: 'question', id: q.id })}
                        onKeyDown={onKey({ kind: 'question', id: q.id }, s.id)}
                        title={overflowIds.has(q.id) ? '此題比一整欄還高，會超出頁面' : undefined}
                      >
                        <SelectMark on={isSel(q.id)} />
                        <span className="outline-row__num">{nums.get(q.id)}.</span>
                        <span className="outline-row__stem">
                          {plainText(q.stem).trim() || <em>（未輸入題目）</em>}
                        </span>
                        {questionRowGroup(s, qi) ? <span className="outline-row__badge">並列</span> : null}
                        {(q.zhuyin === true || hasZhuyinMarkup(q.stem) || q.choices.some((c) => hasZhuyinMarkup(c.text))) &&
                        !s.zhuyin ? (
                          <span className="outline-row__badge">注音</span>
                        ) : null}
                        {hasRubyMarkup(q.stem) || q.choices.some((c) => hasRubyMarkup(c.text)) ? (
                          <span className="outline-row__badge">旁注</span>
                        ) : null}
                        {q.figures.length ? (
                          <span className="outline-row__fig" title={`${q.figures.length} 張附圖`}>
                            圖
                          </span>
                        ) : null}
                        <span className="outline-row__meta">
                          {QUESTION_TYPE_LABEL[q.type].replace('題', '')}・{questionPoints(s, q)}
                        </span>
                      </div>
                    </li>
                  )
                })}
                <li
                  onDragOver={(e) => {
                    if (drag?.kind !== 'question') return
                    e.preventDefault()
                    setDrop({ kind: 'question', sectionId: s.id, index: s.questions.length })
                  }}
                  onDrop={commitDrop}
                  className={dropClass(
                    drag?.kind === 'question' &&
                      drop?.kind === 'question' &&
                      drop.sectionId === s.id &&
                      drop.index === s.questions.length &&
                      s.questions.length === 0,
                    'before',
                  )}
                >
                  <button
                    type="button"
                    className="outline__add-q"
                    onClick={() =>
                      dispatch({ type: 'ADD_QUESTION', sectionId: s.id, afterId: s.questions.at(-1)?.id })
                    }
                  >
                    <Icon name="plus" />
                    新增小題
                  </button>
                </li>
              </ol>
            </li>
          )
        })}
      </ol>

      <div className="outline__footer">
        <p className="outline__footer-hint">有下一頁時顯示「下一頁還有題目」；左右兩欄時只印在右欄，不橫跨整頁。「作答結束」接在最後一題下面。</p>
        <div className={`outline__footer-row${isSel(FOOTER_CONTINUE_ID) ? ' is-selected' : ''}`}>
          <button
            type="button"
            className="outline__footer-label"
            onClick={() => footer.continueOn && select({ kind: 'notice', id: FOOTER_CONTINUE_ID })}
          >
            下一頁還有題目
          </button>
          <Switch
            label="下一頁還有題目"
            checked={footer.continueOn}
            onChange={(continueOn) => dispatch({ type: 'SET_FOOTER', patch: { continueOn } })}
          />
        </div>
        <div className={`outline__footer-row${isSel(FOOTER_END_ID) ? ' is-selected' : ''}`}>
          <button
            type="button"
            className="outline__footer-label"
            onClick={() => footer.endOn && select({ kind: 'notice', id: FOOTER_END_ID })}
          >
            作答結束，請仔細檢查
          </button>
          <Switch
            label="作答結束，請仔細檢查"
            checked={footer.endOn}
            onChange={(endOn) => dispatch({ type: 'SET_FOOTER', patch: { endOn } })}
          />
        </div>
      </div>

      <div className="outline__adds">
        <button
          type="button"
          className="outline__add-section"
          onClick={() => dispatch({ type: 'ADD_SECTION', afterId: exam.sections.at(-1)?.id })}
        >
          <Icon name="plus" />
          新增大題
        </button>
      </div>

      <p className="outline__tip">
        拖曳可調整順序；選取後按 <kbd>Enter</kbd> 在下方新增小題、<kbd>Delete</kbd> 刪除。
      </p>
    </div>
  )
}
