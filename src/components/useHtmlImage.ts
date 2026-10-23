import { useEffect, useState } from 'react'

export function useHtmlImage(src: string | undefined): HTMLImageElement | null {
  const [img, setImg] = useState<{ src: string; el: HTMLImageElement } | null>(null)
  useEffect(() => {
    if (!src) return
    const im = new Image()
    im.crossOrigin = 'anonymous'
    im.onload = () => setImg({ src, el: im })
    im.onerror = () => setImg(null)
    im.src = src
    return () => {
      im.onload = null
      im.onerror = null
    }
  }, [src])
  return img && img.src === src ? img.el : null
}
