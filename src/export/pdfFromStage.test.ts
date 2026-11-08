// @vitest-environment jsdom
import type Konva from 'konva'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const calls = {
  init: null as unknown,
  pages: [] as unknown[][],
  images: [] as unknown[][],
  saved: '',
}

vi.mock('jspdf', () => ({
  jsPDF: class {
    constructor(opts: unknown) {
      calls.init = opts
    }
    addPage(...a: unknown[]) {
      calls.pages.push(a)
    }
    addImage(...a: unknown[]) {
      calls.images.push(a)
    }
    save(name: string) {
      calls.saved = name
    }
  },
}))

function fakeStage(): Konva.Stage {
  return {
    width: () => 794,
    height: () => 1123,
    find: () => [],
    toCanvas: () => document.createElement('canvas'),
  } as unknown as Konva.Stage
}

describe('exportStagesToPdf', () => {
  beforeEach(() => {
    calls.init = null
    calls.pages = []
    calls.images = []
    calls.saved = ''
    vi.stubGlobal('requestAnimationFrame', (fn: () => void) => setTimeout(fn, 0))
  })

  it('一張紙兩頁：紙寬加倍、橫向，第二頁放在右半邊', async () => {
    const { exportStagesToPdf } = await import('./pdfFromStage')
    await exportStagesToPdf([fakeStage(), fakeStage(), fakeStage()], 'a.pdf', { perSheet: 2 })
    expect(calls.init).toMatchObject({ orientation: 'landscape', format: [794 * 2, 1123] })
    expect(calls.images.map((a) => a[2])).toEqual([0, 794, 0])
    expect(calls.pages).toHaveLength(1)
    expect(calls.saved).toBe('a.pdf')
  })

  it('一張紙一頁：照原本的頁面大小', async () => {
    const { exportStagesToPdf } = await import('./pdfFromStage')
    await exportStagesToPdf([fakeStage(), fakeStage()], 'b.pdf')
    expect(calls.init).toMatchObject({ orientation: 'portrait', format: [794, 1123] })
    expect(calls.pages).toHaveLength(1)
  })
})
