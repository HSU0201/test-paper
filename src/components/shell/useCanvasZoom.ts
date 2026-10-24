import { useEffect, useLayoutEffect, useRef, useState } from 'react'

const ZOOM_STEPS = [0.5, 0.67, 0.75, 0.9, 1, 1.25, 1.5, 2]

type ZoomAnchor = {
  pageIndex: number
  fx: number
  fy: number
  clientX: number
  clientY: number
}

function nextZoom(current: number, direction: 1 | -1) {
  return direction > 0
    ? ZOOM_STEPS.find((step) => step > current + 0.001)
    : [...ZOOM_STEPS].reverse().find((step) => step < current - 0.001)
}

export function useCanvasZoom(pageWidth: number, pageHeight: number) {
  const canvasAreaRef = useRef<HTMLDivElement>(null)
  const canvasScrollRef = useRef<HTMLDivElement>(null)
  const scaleRef = useRef(1)
  const zoomAnchor = useRef<ZoomAnchor | null>(null)
  const [fitScale, setFitScale] = useState(1)
  const [zoom, setZoom] = useState<number | 'fit'>('fit')
  const scale = zoom === 'fit' ? fitScale : zoom

  useLayoutEffect(() => {
    scaleRef.current = scale
  }, [scale])

  useLayoutEffect(() => {
    const el = canvasAreaRef.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect()
      const pad = 64
      const sx = (rect.width - pad) / pageWidth
      const sy = (rect.height - pad) / pageHeight
      setFitScale(Math.max(0.3, Math.min(1.25, sx, sy)))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [pageWidth, pageHeight])

  useEffect(() => {
    const el = canvasAreaRef.current
    if (!el) return
    let pending = 0
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      const line = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1
      pending += event.deltaY * line
      if (Math.abs(pending) < 40) return
      const direction: 1 | -1 = pending > 0 ? -1 : 1
      pending = 0
      const next = nextZoom(scaleRef.current, direction)
      if (!next) return
      const scroller = canvasScrollRef.current
      const hit = event.target instanceof Element ? event.target.closest('.canvas-page') : null
      const paper = hit?.querySelector('.paper-stage-wrap')
      if (scroller && hit && paper) {
        const pages = [...scroller.querySelectorAll('.canvas-page')]
        const rect = paper.getBoundingClientRect()
        if (rect.width > 0 && rect.height > 0) {
          zoomAnchor.current = {
            pageIndex: pages.indexOf(hit),
            fx: (event.clientX - rect.left) / rect.width,
            fy: (event.clientY - rect.top) / rect.height,
            clientX: event.clientX,
            clientY: event.clientY,
          }
        }
      }
      setZoom(next)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  useLayoutEffect(() => {
    const anchor = zoomAnchor.current
    const scroller = canvasScrollRef.current
    if (!anchor || !scroller || anchor.pageIndex < 0) return
    zoomAnchor.current = null
    const paper = scroller.querySelectorAll('.canvas-page')[anchor.pageIndex]?.querySelector('.paper-stage-wrap')
    if (!paper) return
    const rect = paper.getBoundingClientRect()
    scroller.scrollLeft += rect.left + anchor.fx * rect.width - anchor.clientX
    scroller.scrollTop += rect.top + anchor.fy * rect.height - anchor.clientY
  }, [scale])

  const stepZoom = (direction: 1 | -1) => {
    const next = nextZoom(scaleRef.current, direction)
    if (next) setZoom(next)
  }

  return { canvasAreaRef, canvasScrollRef, scale, zoom, setZoom, stepZoom }
}
