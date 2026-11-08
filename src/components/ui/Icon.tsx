import type { ReactNode } from 'react'

export type IconName =
  | 'outline'
  | 'undo'
  | 'redo'
  | 'layout'
  | 'insert'
  | 'page'
  | 'font'
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
  | 'word'
  | 'copy'
  | 'library'
  | 'shuffle'
  | 'table'
  | 'print'
  | 'tools'
  | 'more'

const ICON_PATHS: Record<IconName, ReactNode> = {
  more: (
    <>
      <circle cx="5" cy="12" r="1.4" fill="currentColor" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" />
      <circle cx="19" cy="12" r="1.4" fill="currentColor" />
    </>
  ),
  copy: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" />
    </>
  ),
  library: <path d="M5 4v16M10 4v16M15 5l4 14M3 20h18" />,
  shuffle: <path d="M4 7h3c5 0 5 10 10 10h3M17 14l3 3-3 3M4 17h3c1.5 0 2.6-.9 3.5-2M14 9.2C14.9 8 16 7 17 7h3M17 4l3 3-3 3" />,
  table: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="1.5" />
      <path d="M3 9h18M3 14h18M9 4v16" />
    </>
  ),
  print: (
    <>
      <path d="M7 9V3h10v6" />
      <rect x="3" y="9" width="18" height="8" rx="1.5" />
      <path d="M7 14h10v7H7z" />
    </>
  ),
  tools: <path d="M14 6a4 4 0 0 0-5.5 5L3 16.5 5.5 19l5.5-5.5A4 4 0 0 0 16 8l-2.5 2.5-2-2z" />,
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
  font: (
    <>
      <path d="M5 19 12 5l7 14" />
      <path d="M7.5 14h9" />
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
  word: (
    <>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M14 3v5h5M9 12l1.5 5 1.5-4 1.5 4 1.5-5" />
    </>
  ),
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

type IconProps = {
  name: IconName
}

export function Icon({ name }: IconProps) {
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
