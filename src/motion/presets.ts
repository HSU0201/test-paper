import type { Transition, Variants } from 'motion/react'

/** 出場曲線：快進、緩收，適合工具型介面。 */
export const easeOut = [0.22, 1, 0.36, 1] as const

export const fadeEase: Transition = { duration: 0.22, ease: easeOut }

/** 幾乎無回彈的位移彈簧，用來滑動選取指示。 */
export const layoutSpring: Transition = {
  type: 'spring',
  stiffness: 520,
  damping: 40,
  mass: 0.72,
}

export const paneVariants: Variants = {
  enter: (d: number) => ({ opacity: 0, x: (d || 1) * 18 }),
  center: { opacity: 1, x: 0, pointerEvents: 'auto' },
  exit: (d: number) => ({ opacity: 0, x: (d || 1) * -16, pointerEvents: 'none' }),
}
