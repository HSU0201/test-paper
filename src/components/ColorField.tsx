import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'
import { editRuby, editZhuyin, htmlToMarkup, INK_PALETTE, markupToHtml, plainText, type RubyEdit } from '../editor/richText'

type ColorFieldProps = {
  value: string
  onChange: (value: string) => void
  multiline?: boolean
  placeholder?: string
  ariaLabel: string
  rows?: number
}

export type ColorFieldHandle = {
  insert: (token: string) => void
}

/** 考卷文字欄位。先選取字，再點色盤，只改那些字的顏色；其餘維持黑色。 */
export const ColorField = forwardRef<ColorFieldHandle, ColorFieldProps>(function ColorField(
  { value, onChange, multiline, placeholder, ariaLabel, rows = 4 },
  handle,
) {
  const ref = useRef<HTMLDivElement>(null)
  const rangeRef = useRef<Range | null>(null)
  const composing = useRef(false)
  const [msg, setMsg] = useState<string | null>(null)
  const empty = !plainText(value)

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

  useImperativeHandle(handle, () => ({
    insert(token: string) {
      const el = ref.current
      if (!el || !token) return
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
      document.execCommand('insertText', false, token)
      emit()
      saveSel()
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
    const next = editZhuyin(current, Math.min(start, end), Math.max(start, end), mode)
    if (next === current) {
      setMsg(mode === 'to-zhuyin' ? '選取的範圍裡沒有可換的國字' : '選取的範圍裡沒有注音')
      return
    }
    setMsg(null)
    el.innerHTML = markupToHtml(next)
    onChange(next)
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
    const next = editRuby(current, Math.min(start, end), Math.max(start, end), mode)
    if (next === current) {
      setMsg(mode === 'plain' ? '選取的範圍裡沒有右側注音' : '選取的範圍裡沒有可加注音的國字')
      return
    }
    setMsg(null)
    el.innerHTML = markupToHtml(next)
    onChange(next)
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
        spellCheck={false}
        onMouseUp={saveSel}
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
        <span className="color-field__actions">
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
          <button type="button" className="text-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => applyRuby('reading')}>
            只留注音
          </button>
          <button type="button" className="text-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => applyRuby('plain')}>
            去掉注音
          </button>
        </span>
      </div>
      {msg ? <p className="color-field__hint">{msg}</p> : null}
    </div>
  )
})
