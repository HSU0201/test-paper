import { motion } from 'motion/react'
import type { MouseEvent, ReactNode } from 'react'

import { easeOut } from '../motion/presets'

const dialogEase = { duration: 0.26, ease: easeOut }

export function MotionDialog({
  titleId,
  className,
  onClose,
  children,
}: {
  titleId: string
  className?: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <motion.div
      className="text-level-dialog-backdrop"
      role="presentation"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: easeOut }}
      onMouseDown={(e: MouseEvent) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <motion.div
        className={className ? `text-level-dialog ${className}` : 'text-level-dialog'}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.985 }}
        transition={dialogEase}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </motion.div>
    </motion.div>
  )
}
