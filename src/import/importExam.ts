/**
 * 匯入考卷的入口：依檔案種類分流。
 *   - Word（.docx）：讀段落、自動編號與圖片，最完整
 *   - PDF、圖片：讀文字（必要時做文字辨識），只帶入文字；圖片請匯入後再補
 * 題目卷與解析卷可以是不同種類，例如題目卷是 Word、解析卷是拍照的圖片。
 */
import type { DocParagraph } from './docxParagraphs'
import { buildSections, type ImportProgress, importWordExam, readDocxParagraphs, type WordImportResult } from './importWord'
import { isImage, isPdf, readTextFiles } from './readText'
import { linesToParagraphs } from './textParagraphs'
import { buildVendorExam } from './vendorExam'

export type { ImportProgress, WordImportResult }

export function isDocx(file: File) {
  return /\.docx$/i.test(file.name)
}

/** 檢查選的檔案能不能匯入；可以時回傳 null，不行時回傳要給老師看的說明 */
export function checkFiles(files: File[]): string | null {
  if (!files.length) return null
  const docx = files.filter(isDocx)
  if (docx.length && files.length > 1) return 'Word 檔一次只能選一個，不能和其他檔案混在一起。'
  const unknown = files.find((f) => !isDocx(f) && !isPdf(f) && !isImage(f))
  if (unknown) {
    if (/\.doc$/i.test(unknown.name)) return `「${unknown.name}」是舊版 Word（.doc），請先在 Word 另存成 .docx。`
    return `「${unknown.name}」不是 Word、PDF 或圖片檔。`
  }
  return null
}

async function readTextParagraphs(
  files: File[],
  onProgress?: (p: ImportProgress) => void,
): Promise<{ paragraphs: DocParagraph[]; ocrPages: number }> {
  const { lines, ocrPages } = await readTextFiles(files, ({ done, total, ocr }) =>
    onProgress?.({ stage: ocr ? 'ocr' : 'read', done, total }),
  )
  return { paragraphs: linesToParagraphs(lines), ocrPages }
}

export async function importExam(
  questionFiles: File[],
  answerFiles: File[],
  onProgress?: (p: ImportProgress) => void,
): Promise<WordImportResult> {
  const problem = checkFiles(questionFiles) ?? checkFiles(answerFiles)
  if (problem) throw new Error(problem)
  if (!questionFiles.length) throw new Error('請先選題目卷。')

  let ocrPages = 0
  let answer: DocParagraph[] | null = null
  if (answerFiles.length) {
    if (isDocx(answerFiles[0])) answer = await readDocxParagraphs(answerFiles[0])
    else {
      const read = await readTextParagraphs(answerFiles, onProgress)
      answer = read.paragraphs
      ocrPages += read.ocrPages
    }
  }

  if (isDocx(questionFiles[0])) {
    const result = await importWordExam(questionFiles[0], answer, onProgress)
    if (ocrPages) result.warnings.push('解析卷是用文字辨識讀的，答案請再核對一次。')
    return result
  }

  onProgress?.({ stage: 'read', done: 0, total: 1 })
  const read = await readTextParagraphs(questionFiles, onProgress)
  ocrPages += read.ocrPages
  onProgress?.({ stage: 'build', done: 1, total: 1 })

  const imported = buildVendorExam(read.paragraphs, answer ?? undefined)
  const found = imported.sections.some((s) => s.questions.length)
  const warnings = imported.warnings.filter((w) => !w.startsWith('沒有找到題目'))
  if (!found) {
    warnings.push(
      ocrPages
        ? '沒有找到題目。請確認照片清楚、沒有歪斜，題號寫成「1.」開頭，大題寫成「一、選擇題」。'
        : '沒有找到題目。請確認題號寫成「1.」開頭，大題寫成「一、選擇題」。',
    )
  }
  if (ocrPages) warnings.push(`有 ${ocrPages} 頁是用文字辨識讀出來的，可能有錯字，注音也辨識不出來，匯入後請再檢查一次。`)
  if (found) warnings.push('PDF 與圖片只會帶入文字，題目裡的圖片請匯入後再補上。')

  const { sections, questionCount } = buildSections(imported, () => null, { columnWidthPt: null }, warnings)
  return { title: imported.title, sections, assets: {}, questionCount, imageCount: 0, warnings }
}
