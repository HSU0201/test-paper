import { useEffect, useState } from 'react'

/** phone：一次只顯示一個畫面；tablet：題目設定改成右側抽屜；desktop：四欄並排 */
export type Viewport = 'phone' | 'tablet' | 'desktop'

/** 和 editor.css 的斷點一致 */
export const PHONE_MAX = 640
export const TABLET_MAX = 1024

function read(): Viewport {
  if (typeof window === 'undefined' || !window.matchMedia) return 'desktop'
  if (window.matchMedia(`(max-width: ${PHONE_MAX}px)`).matches) return 'phone'
  if (window.matchMedia(`(max-width: ${TABLET_MAX}px)`).matches) return 'tablet'
  return 'desktop'
}

export function useViewport(): Viewport {
  const [vp, setVp] = useState<Viewport>(read)
  useEffect(() => {
    if (!window.matchMedia) return
    const queries = [`(max-width: ${PHONE_MAX}px)`, `(max-width: ${TABLET_MAX}px)`].map((q) => window.matchMedia(q))
    const update = () => setVp(read())
    queries.forEach((q) => q.addEventListener('change', update))
    return () => queries.forEach((q) => q.removeEventListener('change', update))
  }, [])
  return vp
}
