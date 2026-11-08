import { type ReactNode, useState } from 'react'

type PanelSectionProps = {
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
  /** 可以收起來的區塊。不常用的設定預設收起，畫面只留常用的 */
  collapsible?: boolean
  defaultOpen?: boolean
  /** 收起時標題旁顯示的目前設定，例如「每題 2 分」 */
  summary?: string
  /** 記住開合狀態用；未設時用標題 */
  storeKey?: string
}

function readOpen(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key)
    return v == null ? fallback : v === '1'
  } catch {
    return fallback
  }
}

function writeOpen(key: string, open: boolean) {
  try {
    localStorage.setItem(key, open ? '1' : '0')
  } catch {
    // 無痕模式等情況存不了，只是下次不記得開合
  }
}

export function PanelSection({
  title,
  description,
  actions,
  children,
  collapsible,
  defaultOpen = false,
  summary,
  storeKey,
}: PanelSectionProps) {
  const key = `panel-open:${storeKey ?? title}`
  const [open, setOpen] = useState(() => (collapsible ? readOpen(key, defaultOpen) : true))
  if (!collapsible) {
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
  return (
    <section className={`panel-section panel-section--fold${open ? ' is-open' : ''}`}>
      <header className="panel-section__head">
        <button
          type="button"
          className="panel-section__toggle"
          aria-expanded={open}
          onClick={() => {
            setOpen(!open)
            writeOpen(key, !open)
          }}
        >
          <svg className="panel-section__chevron" width="12" height="12" viewBox="0 0 24 24" aria-hidden>
            <path d="m9 6 6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          <span className="panel-section__title">{title}</span>
          {!open && summary ? <span className="panel-section__summary">{summary}</span> : null}
        </button>
        {open ? actions : null}
      </header>
      {open && description ? <p className="panel-section__desc">{description}</p> : null}
      {open ? <div className="panel-section__body">{children}</div> : null}
    </section>
  )
}
