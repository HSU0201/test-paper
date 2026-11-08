/** 範例考卷共用的小工具：建題目、大題、連連看、附圖 */
import {
  type Asset,
  type Choice,
  createChoice,
  createMatchPair,
  createQuestion,
  createSection,
  type Figure,
  type FigurePlacement,
  type MatchPair,
  type Question,
  type QuestionLevel,
  type QuestionType,
  type Section,
} from '../types/exam'
import { SUB_TOKEN } from './richText'

export const CELL = '（　　）'
export const MARK = '（　）'
/** 子題號，印出時自動編成 ①②③ */
export const SUB = SUB_TOKEN

export function choices(texts: string[]): Choice[] {
  return texts.map((text) => ({ ...createChoice(), text }))
}

export function ask(
  type: QuestionType,
  score: number,
  stem: string,
  extra: Partial<Omit<Question, 'id' | 'type' | 'score' | 'stem'>> = {},
): Question {
  return { ...createQuestion(type, score), stem, ...extra }
}

export function sec(
  title: string,
  type: QuestionType,
  patch: Partial<Omit<Section, 'id' | 'questions'>>,
  questions: Question[],
): Section {
  return { ...createSection(title, type), ...patch, questions }
}

/** 連連看的配對。right 多出來、left 留空的就是干擾項 */
export function pairs(list: [string, string][]): MatchPair[] {
  return list.map(([left, right]) => createMatchPair(left, right))
}

/** 連連看右欄順序：照 order 裡的右欄文字排，讓範例每次打開都一樣 */
export function orderRight(list: MatchPair[], order: string[]): string[] {
  return order.map((text) => list.find((p) => p.right === text)?.id).filter((id): id is string => !!id)
}

/** 雙向細目：單元、能力、難易度一起標上 */
export function tag<T extends Question>(q: T, unit: string, skill: string, level: QuestionLevel): T {
  return { ...q, unit, skill, level }
}

/** 範例用的圖：SVG 直接當圖片，不必等瀏覽器轉檔 */
export function svgAsset(fig: { svg: string; width: number; height: number }): Asset {
  return { src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(fig.svg)}`, width: fig.width, height: fig.height }
}

/** 把一張圖放進題目，並登記到 assets */
export function withFigure(
  q: Question,
  assets: Record<string, Asset>,
  asset: Asset,
  placement: FigurePlacement = 'below',
  widthRatio = 0.5,
): Question {
  const assetId = crypto.randomUUID()
  assets[assetId] = asset
  const figure: Figure = { id: crypto.randomUUID(), assetId, placement, widthRatio }
  return { ...q, figures: [...q.figures, figure] }
}
