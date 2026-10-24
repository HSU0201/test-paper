import type { ReactNode } from 'react'

type PanelSectionProps = {
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
}

export function PanelSection({ title, description, actions, children }: PanelSectionProps) {
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
