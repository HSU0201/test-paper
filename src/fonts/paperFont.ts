/**
 * 全卷國字只用正黑體或標楷體。電腦沒有同名字型時，會改用同一行裡後面的相似字型。
 * 注音符號另外用內建芫荽子集（PaperBopomofo），見 withBopomofoFont。
 */

/** 只含注音與聲調的芫荽子集，CSS 名稱刻意不叫 Iansui，避免和電腦裡的完整芫荽搶國字。 */
export const BOPOMOFO_FAMILY = 'PaperBopomofo'

export function withBopomofoFont(family: string): string {
  const names = family.split(',').map((part) => part.trim().replace(/^['"]|['"]$/g, ''))
  if (names.includes(BOPOMOFO_FAMILY)) return family
  return `"${BOPOMOFO_FAMILY}", ${family}`
}

export type PaperFont = {
  id: 'hei' | 'kai'
  label: string
  family: string
  note: string
}

export const PAPER_FONTS: PaperFont[] = [
  {
    id: 'hei',
    label: '正黑體',
    family: '"Microsoft JhengHei", "微軟正黑體", "PingFang TC", "Noto Sans TC", sans-serif',
    note: '沒有微軟正黑體時，改用蘋方或 Noto Sans TC',
  },
  {
    id: 'kai',
    label: '標楷體',
    family: '"DFKai-SB", "標楷體", "BiauKai", "KaiTi", serif',
    note: '沒有標楷體時，改用楷體',
  },
]

export const DEFAULT_PAPER_FONT = PAPER_FONTS[0].family

const LEGACY_HEI = '"Microsoft JhengHei", "PingFang TC", sans-serif'

export function normalizePaperFont(value: unknown): string {
  if (value === LEGACY_HEI) return DEFAULT_PAPER_FONT
  if (typeof value === 'string' && PAPER_FONTS.some((font) => font.family === value)) return value
  return DEFAULT_PAPER_FONT
}
