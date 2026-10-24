import { motion } from 'motion/react'

import { layoutSpring } from '../../motion/presets'

type SwitchProps = {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}

export function Switch({ checked, onChange, label }: SwitchProps) {
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
      <motion.span
        className="ui-switch__thumb"
        initial={false}
        animate={{ x: checked ? 14 : 0 }}
        transition={layoutSpring}
      />
    </button>
  )
}
