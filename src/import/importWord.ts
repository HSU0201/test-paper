/**
 * 匯入廠商的 Word 考卷：解壓縮、讀段落、轉圖片，組成編輯器的大題與小題。
 * 只在按下匯入時載入（解壓縮與 EMF 轉圖都不小）。
 */
import { unzip, type Unzipped } from 'fflate'

import {
  type Asset,
  countAnswerBlanks,
  createQuestion,
  createSection,
  type Figure,
  FIGURE_MARK,
  type Question,
  type QuestionType,
  type Section,
  sectionScore,
} from '../types/exam'
import { type DocImage, type DocLayout, type DocParagraph, readParagraphs, readRelationships } from './docxParagraphs'
import { isEmf, renderEmf } from './emf'
import { buildVendorExam, choiceIndexes, flattenAnswer, type ImportedExam, type ImportedQuestion, type ImportedSection, vendorBlankCount } from './vendorExam'
import { isWmf, renderWmf } from './wmf'

export type ImportProgress = { stage: 'read' | 'images' | 'ocr' | 'build'; done: number; total: number }

export type WordImportResult = {
  title: string
  sections: Section[]
  assets: Record<string, Asset>
  questionCount: number
  imageCount: number
  warnings: string[]
}

/** 圖片長邊上限。一欄寬的圖印出來約 300 dpi，再大只會讓存檔變重 */
const MAX_SIDE = 1000
/** PNG 超過這個大小時，改存 JPEG（照片類的圖較省空間） */
const PNG_LIMIT = 250_000
/** 直長的圖，高度最多約為欄寬的幾倍 */
const MAX_FIGURE_HEIGHT = 1.1

function unzipFile(file: File, keep: (name: string) => boolean): Promise<Unzipped> {
  return file.arrayBuffer().then(
    (buf) =>
      new Promise<Unzipped>((resolve, reject) => {
        unzip(new Uint8Array(buf), { filter: (f) => keep(f.name) }, (err, data) => (err ? reject(err) : resolve(data)))
      }),
  )
}

const decoder = new TextDecoder('utf-8')

async function readDocx(file: File, withMedia: boolean) {
  let zip: Unzipped
  try {
    zip = await unzipFile(file, (name) => name === 'word/document.xml' || name === 'word/_rels/document.xml.rels' || (withMedia && name.startsWith('word/media/')))
  } catch {
    throw new Error(`「${file.name}」不是 Word（.docx）檔，或檔案已損壞。舊版 .doc 請先在 Word 另存成 .docx。`)
  }
  const xml = zip['word/document.xml']
  if (!xml) throw new Error(`「${file.name}」裡找不到 Word 內容。`)
  const rels = readRelationships(zip['word/_rels/document.xml.rels'] ? decoder.decode(zip['word/_rels/document.xml.rels']) : '<Relationships/>')
  const { paragraphs, layout } = readParagraphs(decoder.decode(xml), rels)
  return { paragraphs, layout, zip }
}

function canvasToAsset(canvas: HTMLCanvasElement): Asset {
  let src = canvas.toDataURL('image/png')
  if (src.length > PNG_LIMIT) {
    const jpeg = canvas.toDataURL('image/jpeg', 0.85)
    if (jpeg.length < src.length) src = jpeg
  }
  return { src, width: canvas.width, height: canvas.height }
}

async function bitmapToAsset(bytes: Uint8Array, type: string): Promise<Asset> {
  const bitmap = await createImageBitmap(new Blob([bytes.slice()], { type }))
  const k = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * k))
  canvas.height = Math.max(1, Math.round(bitmap.height * k))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('無法建立畫布')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvasToAsset(canvas)
}

const MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  bmp: 'image/bmp',
  webp: 'image/webp',
}

/** 轉一張 Word 圖片；不支援的格式回傳 null */
async function convertImage(zip: Unzipped, target: string): Promise<Asset | null> {
  const bytes = zip[`word/${target}`]
  if (!bytes) return null
  const ext = target.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'emf' || isEmf(bytes.slice(0, 96).buffer)) {
    const canvas = await renderEmf(bytes.slice().buffer, MAX_SIDE)
    return canvasToAsset(canvas)
  }
  if (ext === 'wmf' || isWmf(bytes.slice(0, 32).buffer)) {
    const canvas = await renderWmf(bytes.slice().buffer, MAX_SIDE)
    return canvasToAsset(canvas)
  }
  const type = MIME[ext]
  if (!type) return null
  return bitmapToAsset(bytes, type)
}

const letter = (i: number) => String.fromCharCode(65 + i)

function questionType(section: ImportedSection, q: ImportedQuestion): QuestionType {
  if (q.choices) return choiceIndexes(q.answer, q.choices.length).length > 1 ? 'multi_choice' : 'single_choice'
  if (/回答|問答|簡答|申論|說明/.test(section.title) && countAnswerBlanks(q.stem) === 0) return 'short_answer'
  return 'fill_blank'
}

function buildQuestion(
  section: ImportedSection,
  q: ImportedQuestion,
  assetsFor: (image: DocImage) => { id: string; asset: Asset } | null,
  layout: DocLayout,
  warn: (message: string) => void,
  where: string,
): Question {
  const type = questionType(section, q)
  const out = createQuestion(type, section.eachScore ?? 2)
  const figures: Figure[] = []
  // 依［圖］的順序對上圖片；轉不出來的圖連同標記一起拿掉
  const pieces = q.stem.split(FIGURE_MARK)
  let stem = pieces[0]
  pieces.slice(1).forEach((piece, i) => {
    const image = q.images[i]
    const found = image ? assetsFor(image) : null
    if (found && image) {
      let ratio = image.widthPt && layout.columnWidthPt ? image.widthPt / layout.columnWidthPt : 0.6
      // 直長的圖照原寬度放，常會比一整欄還高；限制圖高約一個欄寬
      const tall = found.asset.height / Math.max(1, found.asset.width)
      if (tall > 1) ratio = Math.min(ratio, MAX_FIGURE_HEIGHT / tall)
      figures.push({
        id: crypto.randomUUID(),
        assetId: found.id,
        placement: 'middle',
        widthRatio: Math.round(Math.min(1, Math.max(0.15, ratio)) * 100) / 100,
        align: 0.5,
      })
      stem += FIGURE_MARK
    } else if (image) {
      warn(`${where}有一張圖無法轉換（${image.target.split('/').pop()}），請手動補上。`)
    }
    stem += piece
  })
  out.stem = stem.replace(/\n{3,}/g, '\n\n').trim()
  out.figures = figures

  if (q.choices) {
    out.choices = q.choices.map((text) => ({ id: crypto.randomUUID(), text }))
    const hits = choiceIndexes(q.answer, q.choices.length)
    out.answer = hits.length ? hits.map(letter).join('、') : q.answer
  } else {
    const blanks = countAnswerBlanks(out.stem)
    out.answer = flattenAnswer(q.answer, blanks) ?? q.answer
  }
  if (section.blankScore != null) {
    // 每格計分：選擇題算一格；其餘依廠商的算法數格，數字和編輯器自己數的不同時才寫進去
    const blanks = q.choices ? 1 : vendorBlankCount(out.stem, q.answer, countAnswerBlanks)
    if (blanks !== countAnswerBlanks(out.stem)) out.blanks = blanks
  }
  return out
}

/** 整理好的大題與小題 → 編輯器的大題；圖片由 assetsFor 對上已轉好的素材 */
export function buildSections(
  imported: ImportedExam,
  assetsFor: (image: DocImage) => { id: string; asset: Asset } | null,
  layout: DocLayout,
  warnings: string[],
): { sections: Section[]; questionCount: number } {
  let questionCount = 0
  const sections = imported.sections
    .filter((s) => s.questions.length || s.instruction)
    .map((s, si) => {
      const section = createSection(s.title, s.questions[0]?.choices ? 'single_choice' : 'fill_blank')
      section.instruction = s.instruction
      if (s.total != null) section.expectedTotal = s.total
      if (s.blankScore != null) {
        section.scoreMode = 'blank'
        section.blankScore = s.blankScore
      } else if (s.eachScore != null) {
        section.defaultScore = s.eachScore
      }
      section.questions = s.questions.map((q, qi) =>
        buildQuestion(s, q, assetsFor, layout, (m) => warnings.push(m), `第 ${si + 1} 大題第 ${qi + 1} 題`),
      )
      questionCount += section.questions.length
      if (s.total != null) {
        const got = Math.round(sectionScore(section) * 100) / 100
        if (Math.abs(got - s.total) > 0.001) {
          warnings.push(`「${s.title}」原卷寫共 ${s.total} 分，匯入後算出 ${got} 分，可能是格數判斷不同，請檢查。`)
        }
      }
      return section
    })

  const explained = imported.sections.reduce((n, s) => n + s.questions.filter((q) => q.explanation).length, 0)
  if (explained) warnings.push(`解析卷有 ${explained} 題附了解析說明，編輯器沒有放解析的欄位，所以沒有匯入。`)
  return { sections, questionCount }
}

/** 讀 Word 解析卷的段落（題目卷是 PDF、圖片時，解析卷仍可以是 Word） */
export async function readDocxParagraphs(file: File): Promise<DocParagraph[]> {
  return (await readDocx(file, false)).paragraphs
}

/**
 * 讀 Word 題目卷（必要）與解析卷（可省略，Word 檔或已讀好的段落），轉成可以直接放進試卷的大題。
 * 圖片轉換時會回報進度。
 */
export async function importWordExam(
  questionFile: File,
  answer: File | DocParagraph[] | null,
  onProgress?: (p: ImportProgress) => void,
): Promise<WordImportResult> {
  onProgress?.({ stage: 'read', done: 0, total: 1 })
  const questionDoc = await readDocx(questionFile, true)
  const answerParagraphs = answer instanceof File ? await readDocxParagraphs(answer) : (answer ?? undefined)
  const imported = buildVendorExam(questionDoc.paragraphs, answerParagraphs)
  const warnings = [...imported.warnings]

  // 先把用到的圖片全部轉好
  const targets = [...new Set(imported.sections.flatMap((s) => s.questions.flatMap((q) => q.images.map((im) => im.target))))]
  const assets: Record<string, Asset> = {}
  const idOf = new Map<string, string | null>()
  for (let i = 0; i < targets.length; i++) {
    onProgress?.({ stage: 'images', done: i, total: targets.length })
    // 讓畫面有機會更新進度
    await new Promise((resolve) => setTimeout(resolve, 0))
    const asset = await convertImage(questionDoc.zip, targets[i]).catch(() => null)
    if (asset) {
      const id = crypto.randomUUID()
      assets[id] = asset
      idOf.set(targets[i], id)
    } else idOf.set(targets[i], null)
  }
  onProgress?.({ stage: 'build', done: targets.length, total: targets.length })

  const { sections, questionCount } = buildSections(
    imported,
    (im) => {
      const id = idOf.get(im.target)
      return id ? { id, asset: assets[id] } : null
    },
    questionDoc.layout,
    warnings,
  )

  return {
    title: imported.title,
    sections,
    assets,
    questionCount,
    imageCount: Object.keys(assets).length,
    warnings,
  }
}
