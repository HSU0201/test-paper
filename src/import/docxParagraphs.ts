/** 把 Word 的 document.xml 讀成一段一段的文字與圖片，給考卷匯入用。 */

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const V = 'urn:schemas-microsoft-com:vml'
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
const WP = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing'
const PKG_REL = 'http://schemas.openxmlformats.org/package/2006/relationships'

export type DocImage = {
  /** word/ 底下的路徑，例如 media/image1.emf */
  target: string
  /** Word 裡顯示的寬高（點） */
  widthPt?: number
  heightPt?: number
}

export type DocPart = { kind: 'text'; text: string } | { kind: 'image'; image: DocImage }

export type DocParagraph = {
  /** 段落用了 Word 自動編號 */
  numbered: boolean
  parts: DocPart[]
}

export type DocLayout = {
  /** 一欄可放內容的寬度（點）。讀不到時是 null */
  columnWidthPt: number | null
}

/** document.xml.rels：關聯編號 → 檔案路徑 */
export function readRelationships(xml: string): Map<string, string> {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  const map = new Map<string, string>()
  for (const el of Array.from(doc.getElementsByTagNameNS(PKG_REL, 'Relationship'))) {
    const id = el.getAttribute('Id')
    const target = el.getAttribute('Target')
    if (id && target && el.getAttribute('TargetMode') !== 'External') map.set(id, target.replace(/^\/?word\//, ''))
  }
  return map
}

/** VML 的 style="width:120pt;height:3in" 轉成點 */
function cssLengthPt(style: string, key: 'width' | 'height'): number | undefined {
  const m = style.match(new RegExp(`(?:^|;)\\s*${key}\\s*:\\s*([\\d.]+)\\s*(pt|in|cm|mm|px)?`, 'i'))
  if (!m) return undefined
  const n = Number(m[1])
  const unit = (m[2] ?? 'px').toLowerCase()
  const k = unit === 'pt' ? 1 : unit === 'in' ? 72 : unit === 'cm' ? 72 / 2.54 : unit === 'mm' ? 72 / 25.4 : 0.75
  return Number.isFinite(n) ? n * k : undefined
}

function isUnderlined(run: Element): boolean {
  const rPr = Array.from(run.children).find((c) => c.localName === 'rPr')
  const u = rPr && Array.from(rPr.children).find((c) => c.localName === 'u')
  if (!u) return false
  const val = u.getAttributeNS(W, 'val') ?? u.getAttribute('w:val')
  return val !== 'none'
}

function attrNS(el: Element, ns: string, name: string): string | null {
  return el.getAttributeNS(ns, name) ?? el.getAttribute(`r:${name}`)
}

export function readParagraphs(documentXml: string, rels: Map<string, string>): { paragraphs: DocParagraph[]; layout: DocLayout } {
  const doc = new DOMParser().parseFromString(documentXml, 'application/xml')
  const body = doc.getElementsByTagNameNS(W, 'body')[0]
  const paragraphs: DocParagraph[] = []
  if (!body) return { paragraphs, layout: { columnWidthPt: null } }

  const readParagraph = (p: Element): DocParagraph => {
    const parts: DocPart[] = []
    /** 底線文字先累積，連在一起的底線合成一段 */
    let under = ''
    const flushUnder = () => {
      if (!under) return
      const text = under
      under = ''
      const last = parts[parts.length - 1]
      const before = last?.kind === 'text' ? last.text : ''
      let out: string
      if (text.replace(/[\s　()（）]/g, '')) out = `{{*u}}${text}{{/*}}`
      // 括號裡的空白本來就是作答格，底線只是排版習慣，照原樣留空白
      else if (/[()（）]/.test(text) || /[(（]$/.test(before)) out = text
      // 只有空白的底線是作答空格
      else out = '＿'.repeat([...text].length)
      if (last?.kind === 'text') last.text += out
      else parts.push({ kind: 'text', text: out })
    }
    const pushText = (text: string, underline: boolean) => {
      if (!text) return
      if (underline) {
        under += text
        return
      }
      flushUnder()
      const last = parts[parts.length - 1]
      if (last?.kind === 'text') last.text += text
      else parts.push({ kind: 'text', text })
    }
    const pushImage = (rid: string | null, widthPt?: number, heightPt?: number) => {
      const target = rid ? rels.get(rid) : undefined
      if (!target) return
      flushUnder()
      parts.push({ kind: 'image', image: { target, widthPt, heightPt } })
    }

    const walk = (el: Element, underline: boolean) => {
      for (const child of Array.from(el.children)) {
        const name = child.localName
        if (child.namespaceURI === W) {
          if (name === 'r') walk(child, isUnderlined(child))
          else if (name === 't') pushText(child.textContent ?? '', underline)
          else if (name === 'tab' || name === 'ptab') pushText('　', underline)
          else if (name === 'br' || name === 'cr') pushText('\n', false)
          else if (name === 'noBreakHyphen') pushText('-', underline)
          else if (name === 'sym') {
            const code = parseInt(child.getAttributeNS(W, 'char') ?? '', 16)
            if (Number.isFinite(code)) pushText(String.fromCharCode(code >= 0xf000 ? code - 0xf000 : code), underline)
          } else if (name === 'object' || name === 'pict') {
            const img = child.getElementsByTagNameNS(V, 'imagedata')[0]
            const shape = img?.parentElement
            const style = shape?.getAttribute('style') ?? ''
            if (img) pushImage(attrNS(img, R, 'id'), cssLengthPt(style, 'width'), cssLengthPt(style, 'height'))
          } else if (name === 'drawing') {
            const blip = child.getElementsByTagNameNS(A, 'blip')[0]
            const extent = child.getElementsByTagNameNS(WP, 'extent')[0]
            const emu = (k: string) => {
              const n = Number(extent?.getAttribute(k))
              return Number.isFinite(n) && n > 0 ? n / 12700 : undefined
            }
            if (blip) pushImage(attrNS(blip, R, 'embed'), emu('cx'), emu('cy'))
          } else if (name === 'del' || name === 'rPr' || name === 'pPr' || name === 'instrText' || name === 'delText') {
            // 刪除線修訂、格式、欄位指令都不是內容
          } else walk(child, underline)
        } else if (name === 'AlternateContent') {
          const choice = Array.from(child.children).find((c) => c.localName === 'Choice' || c.localName === 'Fallback')
          if (choice) walk(choice, underline)
        } else walk(child, underline)
      }
    }
    walk(p, false)
    flushUnder()
    const pPr = Array.from(p.children).find((c) => c.localName === 'pPr')
    const numbered = !!pPr && Array.from(pPr.children).some((c) => c.localName === 'numPr')
    return { numbered, parts }
  }

  const visit = (el: Element) => {
    for (const child of Array.from(el.children)) {
      if (child.namespaceURI !== W) continue
      if (child.localName === 'p') paragraphs.push(readParagraph(child))
      else if (child.localName === 'tbl' || child.localName === 'tr' || child.localName === 'tc' || child.localName === 'sdt' || child.localName === 'sdtContent') visit(child)
    }
  }
  visit(body)

  // 版面：取最後一個分節設定的頁寬、邊界與欄數
  let columnWidthPt: number | null = null
  const sects = doc.getElementsByTagNameNS(W, 'sectPr')
  const sect = sects[sects.length - 1]
  if (sect) {
    const pick = (tag: string) => sect.getElementsByTagNameNS(W, tag)[0]
    const num = (el: Element | undefined, a: string) => Number(el?.getAttributeNS(W, a) ?? el?.getAttribute(`w:${a}`))
    const pageW = num(pick('pgSz'), 'w')
    const left = num(pick('pgMar'), 'left')
    const right = num(pick('pgMar'), 'right')
    const cols = pick('cols')
    const count = Math.max(1, num(cols, 'num') || 1)
    const space = num(cols, 'space') || 0
    if (pageW > 0) columnWidthPt = (pageW - (left || 0) - (right || 0) - space * (count - 1)) / count / 20
  }
  return { paragraphs, layout: { columnWidthPt } }
}
