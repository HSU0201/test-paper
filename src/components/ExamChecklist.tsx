import { useMemo } from 'react'

import { useEditor } from '../editor/EditorContext'
import { plainText } from '../editor/richText'
import { checkScores } from '../editor/scoreCheck'
import { examTotals } from '../types/exam'

type Step = { label: string; done: boolean; detail: string; go?: () => void }

/** 沒有選取任何東西時，右側列出出一份考卷要完成的事，做好的打勾 */
export function ExamChecklist() {
  const { state, dispatch } = useEditor()
  const { exam } = state
  const check = useMemo(() => checkScores(exam), [exam])
  const totals = examTotals(exam)
  const fullScore = exam.fullScore ?? 100
  const title = state.layout.header.items.find((it) => it.role === 'examTitle')
  const missingAnswers = check.issues.filter((i) => i.text.includes('沒有填答案')).length
  const firstMissing = check.issues.find((i) => i.text.includes('沒有填答案'))?.ref
  const firstSection = exam.sections[0]
  const blankQuestions = exam.sections.flatMap((s) =>
    s.questions.filter((q) => !plainText(q.stem).trim() && q.type !== 'matching' && s.layout !== 'grid'),
  )

  const steps: Step[] = [
    {
      label: '頁首：學校與試卷名稱',
      done: !!title && plainText(title.value).trim().length > 0,
      detail: '直接點卷面最上面的文字就能改。',
      go: title ? () => dispatch({ type: 'SELECT_BLOCK', ref: { kind: 'header', id: title.id } }) : undefined,
    },
    {
      label: '新增大題、打題目',
      done: totals.questions > 0 && blankQuestions.length === 0,
      detail: !totals.questions
        ? '左側選一種題型開始。'
        : blankQuestions.length
          ? `已有 ${totals.questions} 題，其中 ${blankQuestions.length} 題還沒打題目。`
          : `已有 ${totals.sections} 個大題、${totals.questions} 題。`,
      go: blankQuestions.length
        ? () => dispatch({ type: 'SELECT_BLOCK', ref: { kind: 'question', id: blankQuestions[0].id } })
        : firstSection
          ? () => dispatch({ type: 'SELECT_BLOCK', ref: { kind: 'section', id: firstSection.id } })
          : undefined,
    },
    {
      label: '每一題都有答案',
      done: totals.questions > 0 && missingAnswers === 0,
      detail: missingAnswers ? `還有 ${missingAnswers} 題沒填答案。` : '答案只印在答案卷上。',
      go: firstMissing ? () => dispatch({ type: 'SELECT_BLOCK', ref: firstMissing }) : undefined,
    },
    {
      label: `配分加起來 ${fullScore} 分`,
      done: totals.questions > 0 && Math.abs(totals.score - fullScore) < 0.001,
      detail: `目前 ${totals.score} 分。`,
    },
  ]
  const doneCount = steps.filter((s) => s.done).length

  return (
    <section className="checklist" aria-label="出卷進度">
      <h2 className="inspector__title">出卷進度</h2>
      <p className="inspector__hint">
        完成 {doneCount}／{steps.length}。點左側或卷上的任何一題，這裡就會換成那一題的設定。
      </p>
      <ol className="checklist__steps">
        {steps.map((s) => (
          <li key={s.label} className={s.done ? 'is-done' : ''}>
            <span className="checklist__mark" aria-hidden>
              {s.done ? '✓' : ''}
            </span>
            <div className="checklist__text">
              {s.go && !s.done ? (
                <button type="button" className="checklist__label text-btn" onClick={s.go}>
                  {s.label}
                </button>
              ) : (
                <strong className="checklist__label">{s.label}</strong>
              )}
              <span>{s.detail}</span>
            </div>
          </li>
        ))}
        <li className={doneCount === steps.length ? 'is-ready' : ''}>
          <span className="checklist__mark" aria-hidden />
          <div className="checklist__text">
            <strong className="checklist__label">匯出試卷與答案卷</strong>
            <span>右上角「匯出試卷」給學生，「匯出答案」自己批改用。答案表在左側「工具」。</span>
          </div>
        </li>
      </ol>
    </section>
  )
}
