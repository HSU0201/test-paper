import { type KeyboardEvent, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { AnimatePresence, motion } from 'motion/react'

import { easeOut } from '../../motion/presets'

export type SelectOption<T extends string> = { value: T; label: string }
export type SelectGroup<T extends string> = { group: string; options: SelectOption<T>[] }
type Item<T extends string> = SelectOption<T> | SelectGroup<T>

type SelectProps<T extends string> = {
  value: T
  options: Item<T>[]
  onChange: (value: T) => void
  /** 沒有對應選項時顯示的字（例如「單位、符號…」這種當選單用的下拉） */
  placeholder?: string
  className?: string
  /** 加在彈出清單上的 class，例如符號選單改成格狀排列 */
  listClassName?: string
  disabled?: boolean
  'aria-label'?: string
}

const isGroup = <T extends string>(item: Item<T>): item is SelectGroup<T> => 'group' in item

const GAP = 4
const MAX_H = 300
const EDGE = 8

type Place = { left: number; top?: number; bottom?: number; width: number; maxHeight: number; up: boolean }

/**
 * 跟編輯器風格一致的下拉選單，取代瀏覽器原生 <select>（原生選單的清單無法套樣式）。
 * 清單掛在 .editor-root 下並用 fixed 定位，不會被側欄的捲動區裁掉；下方空間不夠就往上開。
 */
export function Select<T extends string>({
  value,
  options,
  onChange,
  placeholder,
  className,
  listClassName,
  disabled,
  'aria-label': ariaLabel,
}: SelectProps<T>) {
  const baseId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [place, setPlace] = useState<Place | null>(null)
  const typed = useRef({ text: '', at: 0 })

  const flat = useMemo(() => options.flatMap((o) => (isGroup(o) ? o.options : [o])), [options])
  const selectedIndex = flat.findIndex((o) => o.value === value)
  const current = selectedIndex >= 0 ? flat[selectedIndex] : null
  const optionId = (i: number) => `${baseId}-opt-${i}`

  const measure = useCallback(() => {
    const t = triggerRef.current
    if (!t) return
    const r = t.getBoundingClientRect()
    const below = window.innerHeight - r.bottom - GAP - EDGE
    const above = r.top - GAP - EDGE
    const want = Math.min(MAX_H, listRef.current?.scrollHeight ?? MAX_H)
    const up = below < want && above > below
    const width = Math.max(r.width, 120)
    const listW = Math.max(width, listRef.current?.offsetWidth ?? 0)
    const left = Math.max(EDGE, Math.min(r.left, window.innerWidth - listW - EDGE))
    setPlace(
      up
        ? { left, bottom: window.innerHeight - r.top + GAP, width, maxHeight: Math.min(MAX_H, above), up }
        : { left, top: r.bottom + GAP, width, maxHeight: Math.min(MAX_H, below), up },
    )
  }, [])

  const openList = (at = selectedIndex) => {
    if (disabled) return
    setActive(at >= 0 ? at : 0)
    setOpen(true)
  }

  const close = (refocus = true) => {
    setOpen(false)
    if (refocus) triggerRef.current?.focus({ preventScroll: true })
  }

  const choose = (i: number) => {
    const opt = flat[i]
    if (!opt) return
    setOpen(false)
    // 焦點一直留在按鈕上；onChange 若把焦點移走（例如插入符號後回到編輯框）就照它的
    onChange(opt.value)
  }

  useLayoutEffect(() => {
    if (open) measure()
  }, [open, measure])

  // 開著的時候：點外面關、視窗變動重新定位、外層捲動就關（避免清單跟按鈕分家）
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (listRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      setOpen(false)
    }
    const onScroll = (e: Event) => {
      if (listRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', onDown, true)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open, measure])

  useEffect(() => {
    if (!open || active < 0) return
    document.getElementById(optionId(active))?.scrollIntoView({ block: 'nearest' })
    // optionId 只依賴 baseId
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, active])

  const typeAhead = (key: string, now: number) => {
    const buf = now - typed.current.at > 700 ? key : typed.current.text + key
    typed.current = { text: buf, at: now }
    const start = buf.length === 1 ? active + 1 : active
    for (let k = 0; k < flat.length; k += 1) {
      const i = (start + k) % flat.length
      if (flat[i].label.toLowerCase().startsWith(buf.toLowerCase())) return i
    }
    return -1
  }

  /**
   * 焦點始終留在按鈕上（select-only combobox），清單只用 aria-activedescendant 標示目前項目。
   * 這樣按鈕所在的區塊不會因為失焦而收起（例如編輯框的工具列只在 :focus-within 時顯示）。
   */
  const onTriggerKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault()
        e.stopPropagation()
        openList()
      }
      return
    }
    // 不讓按鍵傳到編輯器的全域快捷鍵（Backspace 會刪除選取的題目、Esc 會取消選取）
    e.stopPropagation()
    const last = flat.length - 1
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        e.preventDefault()
        setActive((a) => Math.min(last, a + 1))
        return
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault()
        setActive((a) => Math.max(0, a - 1))
        return
      case 'Home':
      case 'PageUp':
        e.preventDefault()
        setActive(0)
        return
      case 'End':
      case 'PageDown':
        e.preventDefault()
        setActive(last)
        return
      case 'Enter':
      case ' ':
        e.preventDefault()
        choose(active)
        return
      case 'Escape':
        e.preventDefault()
        close()
        return
      case 'Tab':
        close(false)
        return
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          const i = typeAhead(e.key, e.timeStamp)
          if (i >= 0) setActive(i)
        }
    }
  }

  const renderOption = (o: SelectOption<T>) => {
    const i = flat.indexOf(o)
    const selected = o.value === value
    return (
      <div
        key={`${i}-${o.value}`}
        id={optionId(i)}
        role="option"
        aria-selected={selected}
        className={`ui-select__option${selected ? ' is-selected' : ''}${i === active ? ' is-active' : ''}`}
        onPointerMove={() => setActive(i)}
        onClick={() => choose(i)}
      >
        <span className="ui-select__option-label">{o.label}</span>
        {selected ? (
          <svg className="ui-select__check" width="14" height="14" viewBox="0 0 24 24" aria-hidden>
            <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : null}
      </div>
    )
  }

  const mount = typeof document !== 'undefined' ? document.querySelector('.editor-root') ?? document.body : null

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`ui-input ui-select${open ? ' is-open' : ''}${current ? '' : ' is-placeholder'}${className ? ` ${className}` : ''}`}
        data-ui-select=""
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${baseId}-list` : undefined}
        aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => {
          triggerRef.current?.focus({ preventScroll: true })
          if (open) close()
          else openList()
        }}
        onKeyDown={onTriggerKey}
        onBlur={() => setOpen(false)}
      >
        <span className="ui-select__value">{current?.label ?? placeholder ?? ''}</span>
        <svg className="ui-select__chevron" width="14" height="14" viewBox="0 0 24 24" aria-hidden>
          <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {mount
        ? createPortal(
            <AnimatePresence>
              {open ? (
                <motion.div
                  ref={listRef}
                  id={`${baseId}-list`}
                  role="listbox"
                  data-ui-select=""
                  aria-label={ariaLabel}
                  className={`ui-select__list${place?.up ? ' is-up' : ''}${listClassName ? ` ${listClassName}` : ''}`}
                  style={{
                    left: place?.left ?? 0,
                    top: place?.top,
                    bottom: place?.bottom,
                    minWidth: place?.width ?? 0,
                    maxHeight: place?.maxHeight ?? MAX_H,
                    visibility: place ? 'visible' : 'hidden',
                  }}
                  initial={{ opacity: 0, y: place?.up ? 4 : -4, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: place?.up ? 4 : -4, scale: 0.98, transition: { duration: 0.1 } }}
                  transition={{ duration: 0.16, ease: easeOut }}
                  // 點清單時不要讓按鈕失焦
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => e.stopPropagation()}
                >
                  {options.map((o) =>
                    isGroup(o) ? (
                      <div key={`g-${o.group}`} role="group" aria-label={o.group} className="ui-select__group">
                        <div className="ui-select__group-label" aria-hidden>
                          {o.group}
                        </div>
                        {o.options.map(renderOption)}
                      </div>
                    ) : (
                      renderOption(o)
                    ),
                  )}
                </motion.div>
              ) : null}
            </AnimatePresence>,
            mount,
          )
        : null}
    </>
  )
}
