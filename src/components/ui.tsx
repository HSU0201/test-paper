import type { ReactNode } from 'react'

export function PanelSection({
  title,
  description,
  actions,
  children,
}: {
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="panel-section">
      <header className="panel-section__head">
        <h3 className="panel-section__title">{title}</h3>
        {actions}
      </header>
      {description ? <p className="panel-section__desc">{description}</p> : null}
      <div className="panel-section__body">{children}</div>
    </section>
  )
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      className={`ui-switch${checked ? ' is-on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="ui-switch__thumb" />
    </button>
  )
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div className="ui-segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={value === o.value ? 'is-active' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function NumberField({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  suffix?: string
  onChange: (v: number) => void
}) {
  return (
    <label className="ui-field ui-field--num">
      <span className="ui-field__label">{label}</span>
      <span className="ui-input-affix">
        <input
          type="number"
          className="ui-input"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            const n = Number(e.target.value)
            if (Number.isFinite(n)) onChange(n)
          }}
        />
        {suffix ? <span className="ui-input-affix__suffix">{suffix}</span> : null}
      </span>
    </label>
  )
}

export function Icon({ name }: { name: IconName }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {ICON_PATHS[name]}
    </svg>
  )
}

export type IconName =
  | 'outline'
  | 'undo'
  | 'redo'
  | 'layout'
  | 'insert'
  | 'page'
  | 'text'
  | 'line'
  | 'rect'
  | 'image'
  | 'open'
  | 'save'
  | 'pdf'
  | 'trash'
  | 'up'
  | 'down'
  | 'minus'
  | 'plus'
  | 'fit'
  | 'grid'
  | 'backup'

const ICON_PATHS: Record<IconName, ReactNode> = {
  outline: <path d="M4 6h2M9 6h11M6 12h2M11 12h9M6 18h2M11 18h9" />,
  undo: <path d="M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" />,
  redo: <path d="m15 14 5-5-5-5M20 9H10a6 6 0 0 0 0 12h3" />,
  layout: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M12 9v12" />
    </>
  ),
  insert: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12h8" />
    </>
  ),
  page: (
    <>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M15 3v4h4" />
    </>
  ),
  text: <path d="M5 6V4h14v2M12 4v16M9 20h6" />,
  line: <path d="M4 20 20 4" />,
  rect: <rect x="4" y="6" width="16" height="12" rx="1.5" />,
  image: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="m21 16-5-5-8 8" />
    </>
  ),
  open: <path d="M3 7h6l2 2h10v10H3z" />,
  save: (
    <>
      <path d="M12 4v11M7 10l5 5 5-5" />
      <path d="M4 19h16" />
    </>
  ),
  pdf: (
    <>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M9 13h6M9 17h4" />
    </>
  ),
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  up: <path d="m6 14 6-6 6 6" />,
  down: <path d="m6 10 6 6 6-6" />,
  minus: <path d="M6 12h12" />,
  plus: <path d="M12 6v12M6 12h12" />,
  fit: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  grid: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="1" strokeDasharray="3 3" />
      <path d="M12 4v16" strokeDasharray="3 3" />
    </>
  ),
  backup: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4.5l2.5 1.5" />
    </>
  ),
}
