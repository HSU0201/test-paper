import {
  createChoice,
  createQuestion,
  createSection,
  isChoiceType,
  type Asset,
  type BlockRef,
  type Choice,
  type Figure,
  type ExamContent,
  type Question,
  type QuestionNumbering,
  type Section,
} from '../types/exam'

export type ExamAction =
  | { type: 'SELECT_BLOCK'; ref: BlockRef | null }
  | { type: 'ADD_SECTION'; afterId?: string }
  | { type: 'UPDATE_SECTION'; id: string; patch: Partial<Omit<Section, 'id' | 'questions'>> }
  | { type: 'REMOVE_SECTION'; id: string }
  | { type: 'MOVE_SECTION'; id: string; toIndex: number }
  | { type: 'ADD_QUESTION'; sectionId: string; afterId?: string }
  | { type: 'UPDATE_QUESTION'; id: string; patch: Partial<Omit<Question, 'id'>> }
  | { type: 'REMOVE_QUESTION'; id: string }
  | { type: 'MOVE_QUESTION'; id: string; toSectionId: string; toIndex: number }
  | { type: 'APPLY_SECTION_SCORE'; id: string }
  | { type: 'ADD_CHOICE'; questionId: string }
  | { type: 'UPDATE_CHOICE'; questionId: string; choiceId: string; text: string }
  | { type: 'REMOVE_CHOICE'; questionId: string; choiceId: string }
  | { type: 'SET_CHOICE_IMAGE'; questionId: string; choiceId: string; asset: Asset | null }
  | { type: 'SET_CHOICE_IMAGE_RATIO'; questionId: string; choiceId: string; widthRatio: number }
  | { type: 'SET_NUMBERING'; numbering: QuestionNumbering }
  | { type: 'ADD_FIGURE'; questionId: string; asset: Asset }
  | { type: 'UPDATE_FIGURE'; questionId: string; figureId: string; patch: Partial<Omit<Figure, 'id' | 'assetId'>> }
  | { type: 'REMOVE_FIGURE'; questionId: string; figureId: string }

export const EXAM_ACTION_TYPES = new Set<string>([
  'ADD_FIGURE',
  'UPDATE_FIGURE',
  'REMOVE_FIGURE',
  'SELECT_BLOCK',
  'ADD_SECTION',
  'UPDATE_SECTION',
  'REMOVE_SECTION',
  'MOVE_SECTION',
  'ADD_QUESTION',
  'UPDATE_QUESTION',
  'REMOVE_QUESTION',
  'MOVE_QUESTION',
  'APPLY_SECTION_SCORE',
  'ADD_CHOICE',
  'UPDATE_CHOICE',
  'REMOVE_CHOICE',
  'SET_CHOICE_IMAGE',
  'SET_CHOICE_IMAGE_RATIO',
  'SET_NUMBERING',
])

type ExamSlice = { exam: ExamContent; selectedBlock: BlockRef | null }

export function findQuestion(exam: ExamContent, id: string) {
  for (let si = 0; si < exam.sections.length; si++) {
    const qi = exam.sections[si].questions.findIndex((q) => q.id === id)
    if (qi >= 0) return { section: exam.sections[si], sectionIndex: si, question: exam.sections[si].questions[qi], index: qi }
  }
  return null
}

function mapSection(exam: ExamContent, id: string, fn: (s: Section) => Section): ExamContent {
  return { ...exam, sections: exam.sections.map((s) => (s.id === id ? fn(s) : s)) }
}

function mapQuestion(exam: ExamContent, id: string, fn: (q: Question) => Question): ExamContent {
  const hit = findQuestion(exam, id)
  if (!hit) return exam
  return mapSection(exam, hit.section.id, (s) => ({
    ...s,
    questions: s.questions.map((q) => (q.id === id ? fn(q) : q)),
  }))
}

/** 圖檔不再被任何附圖或選項引用時從 assets 移除 */
function pruneAssets(exam: ExamContent, assetIds: (string | undefined)[]): ExamContent {
  const used = new Set<string>()
  for (const s of exam.sections) {
    for (const q of s.questions) {
      q.figures.forEach((f) => used.add(f.assetId))
      q.choices.forEach((c) => c.image && used.add(c.image.assetId))
    }
  }
  const drop = assetIds.filter((id): id is string => !!id && !used.has(id) && id in exam.assets)
  if (!drop.length) return exam
  const assets = { ...exam.assets }
  drop.forEach((id) => delete assets[id])
  return { ...exam, assets }
}

function questionAssetIds(q: Question): string[] {
  return [...q.figures.map((f) => f.assetId), ...q.choices.flatMap((c) => (c.image ? [c.image.assetId] : []))]
}

function moveItem<T>(list: T[], from: number, to: number): T[] {
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(Math.max(0, Math.min(to, next.length)), 0, item)
  return next
}

export function examReducer(state: ExamSlice, action: ExamAction): ExamSlice {
  const { exam } = state
  switch (action.type) {
    case 'SELECT_BLOCK':
      return { ...state, selectedBlock: action.ref }

    case 'ADD_SECTION': {
      const s = createSection()
      const at = action.afterId ? exam.sections.findIndex((x) => x.id === action.afterId) + 1 : exam.sections.length
      const sections = [...exam.sections]
      sections.splice(at <= 0 ? sections.length : at, 0, s)
      return { exam: { ...exam, sections }, selectedBlock: { kind: 'section', id: s.id } }
    }
    case 'UPDATE_SECTION':
      return { ...state, exam: mapSection(exam, action.id, (s) => ({ ...s, ...action.patch })) }
    case 'REMOVE_SECTION': {
      const sections = exam.sections.filter((s) => s.id !== action.id)
      const removed = exam.sections.find((s) => s.id === action.id)
      const sel = state.selectedBlock
      const selGone =
        sel &&
        (sel.id === action.id || (sel.kind === 'question' && removed?.questions.some((q) => q.id === sel.id)))
      return {
        exam: pruneAssets({ ...exam, sections }, removed?.questions.flatMap(questionAssetIds) ?? []),
        selectedBlock: selGone ? null : sel,
      }
    }
    case 'MOVE_SECTION': {
      const from = exam.sections.findIndex((s) => s.id === action.id)
      if (from < 0) return state
      const to = from < action.toIndex ? action.toIndex - 1 : action.toIndex
      if (to === from) return state
      return { ...state, exam: { ...exam, sections: moveItem(exam.sections, from, to) } }
    }

    case 'ADD_QUESTION': {
      const section = exam.sections.find((s) => s.id === action.sectionId)
      if (!section) return state
      const after = action.afterId ? section.questions.findIndex((x) => x.id === action.afterId) : -1
      const template = after >= 0 ? section.questions[after] : null
      const nq = createQuestion(template?.type ?? section.defaultType, template?.score ?? section.defaultScore)
      if (template) nq.choiceLayout = template.choiceLayout
      const questions = [...section.questions]
      questions.splice(after >= 0 ? after + 1 : questions.length, 0, nq)
      return {
        exam: mapSection(exam, section.id, (s) => ({ ...s, questions })),
        selectedBlock: { kind: 'question', id: nq.id },
      }
    }
    case 'UPDATE_QUESTION':
      return {
        ...state,
        exam: mapQuestion(exam, action.id, (q) => {
          const next = { ...q, ...action.patch }
          if (action.patch.type && isChoiceType(action.patch.type) && next.choices.length === 0) {
            next.choices = [createChoice(), createChoice(), createChoice(), createChoice()]
          }
          if (action.patch.type === 'short_answer' && next.answerLines === 0) next.answerLines = 3
          return next
        }),
      }
    case 'REMOVE_QUESTION': {
      const hit = findQuestion(exam, action.id)
      if (!hit) return state
      const next = mapSection(exam, hit.section.id, (s) => ({
        ...s,
        questions: s.questions.filter((q) => q.id !== action.id),
      }))
      return {
        exam: pruneAssets(next, questionAssetIds(hit.question)),
        selectedBlock: state.selectedBlock?.id === action.id ? null : state.selectedBlock,
      }
    }
    case 'MOVE_QUESTION': {
      const hit = findQuestion(exam, action.id)
      const target = exam.sections.find((s) => s.id === action.toSectionId)
      if (!hit || !target) return state
      if (hit.section.id === target.id) {
        const to = hit.index < action.toIndex ? action.toIndex - 1 : action.toIndex
        if (to === hit.index) return state
        return {
          ...state,
          exam: mapSection(exam, target.id, (s) => ({ ...s, questions: moveItem(s.questions, hit.index, to) })),
        }
      }
      const sections = exam.sections.map((s) => {
        if (s.id === hit.section.id) return { ...s, questions: s.questions.filter((q) => q.id !== action.id) }
        if (s.id === target.id) {
          const questions = [...s.questions]
          questions.splice(Math.max(0, Math.min(action.toIndex, questions.length)), 0, hit.question)
          return { ...s, questions }
        }
        return s
      })
      return { ...state, exam: { ...exam, sections } }
    }
    case 'APPLY_SECTION_SCORE':
      return {
        ...state,
        exam: mapSection(exam, action.id, (s) => ({
          ...s,
          questions: s.questions.map((q) => ({ ...q, score: s.defaultScore })),
        })),
      }

    case 'ADD_CHOICE':
      return {
        ...state,
        exam: mapQuestion(exam, action.questionId, (q) => ({ ...q, choices: [...q.choices, createChoice()] })),
      }
    case 'UPDATE_CHOICE':
      return {
        ...state,
        exam: mapQuestion(exam, action.questionId, (q) => ({
          ...q,
          choices: q.choices.map((c) => (c.id === action.choiceId ? { ...c, text: action.text } : c)),
        })),
      }
    case 'REMOVE_CHOICE': {
      const old = findQuestion(exam, action.questionId)?.question.choices.find((c) => c.id === action.choiceId)
      const next = mapQuestion(exam, action.questionId, (q) => ({
        ...q,
        choices: q.choices.filter((c) => c.id !== action.choiceId),
      }))
      return { ...state, exam: pruneAssets(next, [old?.image?.assetId]) }
    }
    case 'SET_CHOICE_IMAGE': {
      const old = findQuestion(exam, action.questionId)?.question.choices.find((c) => c.id === action.choiceId)
      if (!old) return state
      let base = exam
      let image: Choice['image']
      if (action.asset) {
        const assetId = crypto.randomUUID()
        base = { ...exam, assets: { ...exam.assets, [assetId]: action.asset } }
        image = { assetId, widthRatio: old.image?.widthRatio ?? 0.8 }
      }
      const next = mapQuestion(base, action.questionId, (q) => ({
        ...q,
        choices: q.choices.map((c) => {
          if (c.id !== action.choiceId) return c
          if (image) return { ...c, image }
          return { id: c.id, text: c.text }
        }),
      }))
      return { ...state, exam: pruneAssets(next, [old.image?.assetId]) }
    }
    case 'SET_CHOICE_IMAGE_RATIO':
      return {
        ...state,
        exam: mapQuestion(exam, action.questionId, (q) => ({
          ...q,
          choices: q.choices.map((c) =>
            c.id === action.choiceId && c.image ? { ...c, image: { ...c.image, widthRatio: action.widthRatio } } : c,
          ),
        })),
      }
    case 'SET_NUMBERING':
      return { ...state, exam: { ...exam, numbering: action.numbering } }

    case 'ADD_FIGURE': {
      const assetId = crypto.randomUUID()
      const figure: Figure = { id: crypto.randomUUID(), assetId, placement: 'below', widthRatio: 0.6 }
      const withAsset = { ...exam, assets: { ...exam.assets, [assetId]: action.asset } }
      return {
        ...state,
        exam: mapQuestion(withAsset, action.questionId, (q) => ({ ...q, figures: [...q.figures, figure] })),
      }
    }
    case 'UPDATE_FIGURE':
      return {
        ...state,
        exam: mapQuestion(exam, action.questionId, (q) => ({
          ...q,
          figures: q.figures.map((f) => (f.id === action.figureId ? { ...f, ...action.patch } : f)),
        })),
      }
    case 'REMOVE_FIGURE': {
      const hit = findQuestion(exam, action.questionId)
      const fig = hit?.question.figures.find((f) => f.id === action.figureId)
      if (!fig) return state
      const next = mapQuestion(exam, action.questionId, (q) => ({
        ...q,
        figures: q.figures.filter((f) => f.id !== action.figureId),
      }))
      return { ...state, exam: pruneAssets(next, [fig.assetId]) }
    }
  }
}
