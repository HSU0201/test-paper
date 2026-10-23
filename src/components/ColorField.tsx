import { useLayoutEffect, useRef, useState } from 'react'
import { htmlToMarkup, INK_PALETTE, markupToHtml, plainText } from '../editor/richText'

type ColorFieldProps = {
  value: string
  onChange: (value: string) => void
  multiline?: boolean
  placeholder?: string
  ariaLabel: string
  rows?: number
}

/** 考卷文字欄位。先選取字，再點色盤，只改那些字的顏色；其餘維持黑色。 */
export function ColorField({ value, onChange, multiline, placeholder, ariaLabel, rows = 4 }: ColorFieldProps) {
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

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || document.activeElement === el) return
    const html = markupToHtml(value)
    if (el.innerHTML !== html) el.innerHTML = html
  }, [value])

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
          if (!multiline && e.key === 'Enter') e.preventDefault()
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
      </div>
      {msg ? <p className="color-field__hint">{msg}</p> : null}
    </div>
  )
}
