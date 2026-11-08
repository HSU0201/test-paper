import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'

import { ensureZhuyin, readingOptions, withZhuyin } from '../editor/hanToZhuyin'
import {
  editRuby,
  editZhuyin,
  fracInsertHtml,
  htmlToMarkup,
  INK_PALETTE,
  markupToHtml,
  plainText,
  type RubyEdit,
  setNthReading,
  stripLeadingSub,
  SUB_HTML,
  SUB_TOKEN,
} from '../editor/richText'
import type { SubStyle } from '../editor/subItems'

type ColorFieldProps = {
  value: string
  onChange: (value: string) => void
  multiline?: boolean
  placeholder?: string
  ariaLabel: string
  rows?: number
  /** 子題號在編輯框裡的樣式，跟卷面一致 */
  subStyle?: SubStyle
  /** 顯示數學工具：分數、單位與符號 */
  mathTools?: boolean
}

/** 數學常用的單位與符號 */
const MATH_SYMBOLS: { group: string; items: string[] }[] = [
  { group: '運算', items: ['＋', '－', '×', '÷', '＝', '≠', '＞', '＜', '≧', '≦', '≒', '…'] },
  { group: '長度', items: ['mm', 'cm', 'm', 'km', '公分', '公尺', '公里'] },
  { group: '面積體積', items: ['cm²', 'm²', 'km²', 'cm³', 'm³', '平方公分', '立方公分'] },
  { group: '重量容量', items: ['g', 'kg', '公克', '公斤', 'mL', 'L', '毫公升', '公升'] },
  { group: '時間金錢', items: ['時', '分', '秒', '日', '元', '角'] },
  { group: '其他', items: ['°', '°C', '％', '□', '○', '△', '∠', '⊥', '∥', '√', 'π'] },
]

export type ColorFieldHandle = {
  insert: (token: string) => void
  /** 在游標處插入子題號。游標不在行首時，先換到下一行 */
  insertSub: () => void
  focus: () => void
}

const ZHUYIN_OPEN_KEY = 'color-field:zhuyin-open'

function readZhuyinOpen(): boolean {
  try {
    return localStorage.getItem(ZHUYIN_OPEN_KEY) === '1'
  } catch {
    return false
  }
}

function rememberZhuyinOpen(open: boolean) {
  try {
    localStorage.setItem(ZHUYIN_OPEN_KEY, open ? '1' : '0')
  } catch {
    // 存不了就下次不記得
  }
}

/**
 * 考卷文字欄位。先選取字，再點色盤，只改那些字的顏色；其餘維持黑色。
 * 工具列只在編輯這一格時出現，免得一整排工具列把畫面塞滿。
 */
export const ColorField = forwardRef<ColorFieldHandle, ColorFieldProps>(function ColorField(
  { value, onChange, multiline, placeholder, ariaLabel, rows = 4, subStyle, mathTools },
  handle,
) {
  const ref = useRef<HTMLDivElement>(null)
  /** 注音工具平常收起來；國語老師打開後會記住 */
  const [zyOpen, setZyOpen] = useState(readZhuyinOpen)
  /** 分數輸入框：null 表示收起來 */
  const [frac, setFrac] = useState<{ num: string; den: string } | null>(null)
  const rangeRef = useRef<Range | null>(null)
  const composing = useRef(false)
  const [msg, setMsg] = useState<string | null>(null)
  /** 點到破音字時，列出可選的讀音 */
  const [poly, setPoly] = useState<{ n: number; han: string; current: string; options: string[] } | null>(null)
  const empty = !plainText(value) && !value.includes(SUB_TOKEN)

  /** 有好幾個讀音的字加上虛線底，提示可以點來換讀音 */
  const markPoly = () => {
    const el = ref.current
    if (!el) return
    el.querySelectorAll<HTMLElement>('.zy, .ruby').forEach((span) => {
      const han = span.dataset.han ?? ''
      const many = readingOptions(han).length > 1
      span.classList.toggle('is-poly', many)
      if (many) span.title = `「${han}」有好幾個讀音，點一下可以換`
    })
  }
  useEffect(() => {
    if (!/{{(?:z|y[brn]?):/.test(value)) return
    let alive = true
    ensureZhuyin().then(
      () => {
        if (alive) markPoly()
      },
      () => undefined,
    )
    return () => {
      alive = false
    }
  }, [value])

  const pickPoly = (target: EventTarget | null) => {
    const el = ref.current
    const span = target instanceof Element ? target.closest<HTMLElement>('.zy, .ruby') : null
    if (!el || !span || !el.contains(span)) {
      setPoly(null)
      return
    }
    const n = [...el.querySelectorAll('.zy, .ruby')].indexOf(span)
    const han = span.dataset.han ?? ''
    const current = span.dataset.reading ?? span.textContent ?? ''
    withZhuyin(() => {
      const options = readingOptions(han)
      setPoly(options.length > 1 ? { n, han, current, options } : null)
    })
  }

  const choosePoly = (reading: string) => {
    const el = ref.current
    if (!el || !poly) return
    const next = setNthReading(htmlToMarkup(el), poly.n, reading)
    el.innerHTML = markupToHtml(next)
    onChange(next)
    setPoly(null)
    markPoly()
  }

  const saveSel = () => {
    const sel = window.getSelection()
    const el = ref.current
    if (!sel || sel.rangeCount === 0 || !el?.contains(sel.anchorNode)) return
    rangeRef.current = sel.getRangeAt(0).cloneRange()
  }

  const emit = () => {
    const el = ref.current
    if (!el) return
    const next = htmlToMarkup(el)
    if (next !== value) onChange(next)
  }

  /** 把游標放回上次的位置；沒有記錄時放在最後面 */
  const restoreCaret = (el: HTMLDivElement) => {
    el.focus()
    const sel = window.getSelection()
    const range = rangeRef.current
    if (sel && range && el.contains(range.startContainer)) {
      sel.removeAllRanges()
      sel.addRange(range)
    } else {
      const end = document.createRange()
      end.selectNodeContents(el)
      end.collapse(false)
      sel?.removeAllRanges()
      sel?.addRange(end)
    }
  }

  /** 游標前（或後）的內容，存成標記 */
  const markupAround = (range: Range, side: 'before' | 'after') => {
    const el = ref.current!
    const r = document.createRange()
    if (side === 'before') {
      r.setStart(el, 0)
      r.setEnd(range.startContainer, range.startOffset)
    } else {
      r.setStart(range.endContainer, range.endOffset)
      r.setEnd(el, el.childNodes.length)
    }
    const holder = document.createElement('div')
    holder.appendChild(r.cloneContents())
    return htmlToMarkup(holder)
  }

  const liveRange = () => {
    const el = ref.current
    const sel = window.getSelection()
    if (!el || !sel || sel.rangeCount === 0) return null
    const range = sel.getRangeAt(0)
    return el.contains(range.startContainer) && el.contains(range.endContainer) ? range : null
  }

  /**
   * 在子題那一行按 Enter：下一行自動接下一個子題號。
   * 子題號後面還沒打字就按 Enter，拿掉這個子題號，像 Word 的清單一樣結束。
   */
  const continueSub = (): boolean => {
    const el = ref.current
    const range = liveRange()
    if (!el || !range) return false
    const before = markupAround(range, 'before')
    const line = before.slice(before.lastIndexOf('\n') + 1)
    const rest = stripLeadingSub(line)
    if (rest == null) return false
    const after = markupAround(range, 'after').split('\n')[0]
    if (!plainText(rest).trim() && !plainText(after).trim() && !after.includes(SUB_TOKEN)) {
      const index = before.split(SUB_TOKEN).length - 2
      const chip = el.querySelectorAll('[data-sub]')[index]
      if (chip?.parentNode) {
        // 游標留在原本這一行。行尾沒有東西時補一個 br，空行才看得到、點得到
        const parent = chip.parentNode
        const next = chip.nextSibling
        chip.remove()
        let anchor = next
        if (!next || (next.nodeType === Node.ELEMENT_NODE && (next as HTMLElement).tagName !== 'BR' && !next.textContent)) {
          anchor = document.createElement('br')
          parent.insertBefore(anchor, next)
        }
        const caret = document.createRange()
        if (anchor) caret.setStartBefore(anchor)
        caret.collapse(true)
        const sel = window.getSelection()
        sel?.removeAllRanges()
        sel?.addRange(caret)
      }
      emit()
      saveSel()
      return true
    }
    document.execCommand('insertHTML', false, `<br>${SUB_HTML}`)
    emit()
    saveSel()
    return true
  }

  useImperativeHandle(handle, () => ({
    insert(token: string) {
      const el = ref.current
      if (!el || !token) return
      restoreCaret(el)
      document.execCommand('insertText', false, token)
      emit()
      saveSel()
    },
    insertSub() {
      const el = ref.current
      if (!el) return
      restoreCaret(el)
      const range = liveRange()
      if (!range) return
      const before = markupAround(range, 'before')
      const line = before.slice(before.lastIndexOf('\n') + 1)
      const midLine = plainText(line).trim() !== '' || line.includes(SUB_TOKEN)
      document.execCommand('insertHTML', false, `${midLine ? '<br>' : ''}${SUB_HTML}`)
      emit()
      saveSel()
    },
    focus() {
      ref.current?.focus()
    },
  }))

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || document.activeElement === el) return
    const html = markupToHtml(value)
    if (el.innerHTML !== html) el.innerHTML = html
  }, [value])

  const displayIndex = (node: Node, offset: number) => {
    const el = ref.current
    if (!el) return 0
    const range = document.createRange()
    range.setStart(el, 0)
    range.setEnd(node, offset)
    const holder = document.createElement('div')
    holder.appendChild(range.cloneContents())
    return plainText(htmlToMarkup(holder)).length
  }

  const applyZhuyin = (mode: 'to-zhuyin' | 'to-han') => {
    const el = ref.current
    const sel = window.getSelection()
    const live = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null
    const range =
      live && el?.contains(live.startContainer) && el.contains(live.endContainer) ? live : rangeRef.current
    if (!el || !range || range.collapsed || !el.contains(range.startContainer) || !el.contains(range.endContainer)) {
      setMsg(mode === 'to-zhuyin' ? '請先選取要換成注音的字' : '請先選取要改回國字的注音')
      return
    }
    const start = displayIndex(range.startContainer, range.startOffset)
    const end = displayIndex(range.endContainer, range.endOffset)
    const current = htmlToMarkup(el)
    withZhuyin(() => {
      const next = editZhuyin(current, Math.min(start, end), Math.max(start, end), mode)
      if (next === current) {
        setMsg(mode === 'to-zhuyin' ? '選取的範圍裡沒有可換的國字' : '選取的範圍裡沒有注音')
        return
      }
      setMsg(null)
      el.innerHTML = markupToHtml(next)
      onChange(next)
    })
  }

  const applyRuby = (mode: RubyEdit) => {
    const el = ref.current
    const range = rangeRef.current
    const hint =
      mode === 'plain'
        ? '請先選取要去掉注音的字'
        : mode === 'char'
          ? '請先選取要加上注音的國字'
          : '請先選取國字，或已經加了注音的字'
    if (!el || !range || range.collapsed || !el.contains(range.startContainer) || !el.contains(range.endContainer)) {
      setMsg(hint)
      return
    }
    const start = displayIndex(range.startContainer, range.startOffset)
    const end = displayIndex(range.endContainer, range.endOffset)
    const current = htmlToMarkup(el)
    withZhuyin(() => {
      const next = editRuby(current, Math.min(start, end), Math.max(start, end), mode)
      if (next === current) {
        setMsg(mode === 'plain' ? '選取的範圍裡沒有右側注音' : '選取的範圍裡沒有可加注音的國字')
        return
      }
      setMsg(null)
      el.innerHTML = markupToHtml(next)
      onChange(next)
    })
  }

  const applyFormat = (command: 'bold' | 'italic' | 'underline' | 'strikeThrough') => {
    const el = ref.current
    const range = rangeRef.current
    if (!el || !range || range.collapsed) {
      setMsg('請先在文字裡選取要設定的字')
      return
    }
    setMsg(null)
    el.focus()
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
    document.execCommand('styleWithCSS', false, 'false')
    document.execCommand(command)
    document.execCommand('styleWithCSS', false, 'true')
    emit()
    saveSel()
  }

  const apply = (color: string) => {
    const el = ref.current
    const range = rangeRef.current
    if (!el || !range || range.collapsed) {
      setMsg('請先在文字裡選取要變色的字')
      return
    }
    setMsg(null)
    el.focus()
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
    document.execCommand('styleWithCSS', false, 'true')
    document.execCommand('foreColor', false, color)
    emit()
    saveSel()
  }

  return (
    <div className="color-field">
      <div
        ref={ref}
        className={`ui-input color-field__box${multiline ? ' is-multi' : ''}${empty ? ' is-empty' : ''}`}
        style={multiline ? { minHeight: rows * 24 } : undefined}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-label={ariaLabel}
        aria-multiline={multiline || undefined}
        data-placeholder={placeholder}
        data-sub-style={subStyle}
        spellCheck={false}
        onMouseUp={saveSel}
        onClick={(e) => pickPoly(e.target)}
        onKeyUp={saveSel}
        onCompositionStart={() => {
          composing.current = true
        }}
        onCompositionEnd={() => {
          composing.current = false
          emit()
        }}
        onInput={() => {
          if (!composing.current) emit()
        }}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (!multiline && e.key === 'Enter') e.preventDefault()
          if (
            multiline &&
            e.key === 'Enter' &&
            !e.shiftKey &&
            !e.nativeEvent.isComposing &&
            !composing.current &&
            continueSub()
          ) {
            e.preventDefault()
          }
        }}
        onBlur={() => {
          saveSel()
          emit()
        }}
        onPaste={(e) => {
          e.preventDefault()
          document.execCommand('insertText', false, e.clipboardData.getData('text/plain'))
        }}
      />
      <div className="color-field__tools">
      <div className="color-field__palette" role="group" aria-label="文字色盤" onPointerDown={saveSel}>
        {INK_PALETTE.map((sw) => (
          <button
            key={sw.hex}
            type="button"
            className="color-field__swatch"
            style={{ background: sw.hex }}
            title={sw.hex === '#000000' ? '恢復黑色' : sw.label}
            aria-label={sw.hex === '#000000' ? '恢復黑色' : sw.label}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => apply(sw.hex)}
          />
        ))}
        <label className="color-field__custom" title="自訂顏色">
          <span className="visually-hidden">自訂顏色</span>
          <input type="color" defaultValue="#d92d20" onChange={(e) => apply(e.target.value)} />
        </label>
        <span className="color-field__format" role="group" aria-label="文字樣式">
          {(
            [
              ['is-bold', 'bold', '粗體', 'B'],
              ['is-italic', 'italic', '斜體', 'I'],
              ['is-underline', 'underline', '底線', 'U'],
              ['is-strike', 'strikeThrough', '刪除線', 'S'],
            ] as const
          ).map(([cls, cmd, name, short]) => (
            <button
              key={cmd}
              type="button"
              className={`text-btn ${cls}`}
              title={`${name}（先選取字）`}
              aria-label={name}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyFormat(cmd)}
            >
              {short}
            </button>
          ))}
        </span>
        <button
          type="button"
          className={zyOpen ? 'text-btn is-current' : 'text-btn'}
          aria-expanded={zyOpen}
          title="轉成注音、加上右側注音、改成方格等"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setZyOpen(!zyOpen)
            rememberZhuyinOpen(!zyOpen)
          }}
        >
          注音 {zyOpen ? '▴' : '▾'}
        </button>
      </div>
      {zyOpen ? (
        <div className="color-field__actions" role="group" aria-label="注音工具" onPointerDown={saveSel}>
          <button
            type="button"
            className="text-btn"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyZhuyin('to-zhuyin')}
          >
            轉成注音
          </button>
          <button
            type="button"
            className="text-btn"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyZhuyin('to-han')}
          >
            改回國字
          </button>
          <button type="button" className="text-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => applyRuby('char')}>
            加上注音
          </button>
          <button type="button" className="text-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => applyRuby('box')}>
            改成方格
          </button>
          <button type="button" className="text-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => applyRuby('blank')}>
            注音留白
          </button>
          <button type="button" className="text-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => applyRuby('reading')}>
            只留注音
          </button>
          <button type="button" className="text-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => applyRuby('plain')}>
            去掉注音
          </button>
        </div>
      ) : null}
      {poly ? (
        <div className="color-field__poly" role="group" aria-label={`「${poly.han}」的讀音`}>
          <span>「{poly.han}」的讀音：</span>
          {poly.options.map((reading) => (
            <button
              key={reading}
              type="button"
              className={reading === poly.current ? 'text-btn is-current' : 'text-btn'}
              aria-pressed={reading === poly.current}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choosePoly(reading)}
            >
              {reading}
            </button>
          ))}
          <button type="button" className="text-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => setPoly(null)}>
            關閉
          </button>
        </div>
      ) : null}
      {mathTools ? (
        <div className="color-field__math" role="group" aria-label="數學工具" onPointerDown={saveSel}>
          <button
            type="button"
            className={frac ? 'text-btn is-current' : 'text-btn'}
            aria-expanded={frac != null}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setFrac(frac ? null : { num: '', den: '' })}
          >
            分數
          </button>
          <select
            className="ui-input color-field__symbols"
            aria-label="插入單位或符號"
            value=""
            onChange={(e) => {
              const el = ref.current
              const sym = e.target.value
              if (!el || !sym) return
              restoreCaret(el)
              document.execCommand('insertText', false, sym)
              emit()
              saveSel()
            }}
          >
            <option value="">單位、符號…</option>
            {MATH_SYMBOLS.map((g) => (
              <optgroup key={g.group} label={g.group}>
                {g.items.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {frac ? (
            <form
              className="color-field__frac"
              onSubmit={(e) => {
                e.preventDefault()
                const el = ref.current
                if (!el || (!frac.num.trim() && !frac.den.trim())) return
                restoreCaret(el)
                document.execCommand('insertHTML', false, fracInsertHtml(frac.num, frac.den))
                emit()
                saveSel()
                setFrac({ num: '', den: '' })
              }}
            >
              <input
                className="ui-input"
                aria-label="分子"
                placeholder="分子"
                value={frac.num}
                autoFocus
                onChange={(e) => setFrac({ ...frac, num: e.target.value })}
              />
              <span aria-hidden>／</span>
              <input
                className="ui-input"
                aria-label="分母"
                placeholder="分母"
                value={frac.den}
                onChange={(e) => setFrac({ ...frac, den: e.target.value })}
              />
              <button type="submit" className="text-btn">
                插入
              </button>
            </form>
          ) : null}
        </div>
      ) : null}
      </div>
      {msg ? <p className="color-field__hint">{msg}</p> : null}
    </div>
  )
})
