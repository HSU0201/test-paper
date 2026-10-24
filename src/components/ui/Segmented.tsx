import { useId } from 'react'

import { motion } from 'motion/react'

import { layoutSpring } from '../../motion/presets'

export type SegmentedOption<T extends string | number> = {
  value: T
  label: string
}

type SegmentedProps<T extends string | number> = {
  value: T
  options: SegmentedOption<T>[]
  onChange: (value: T) => void
  label: string
}

export function Segmented<T extends string | number>({ value, options, onChange, label }: SegmentedProps<T>) {
  const pillId = useId()
  return (
    <div className="ui-segmented" role="radiogroup" aria-label={label}>
      {options.map((option) => {
        const active = value === option.value
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={active}
            className={active ? 'is-active' : ''}
            onClick={() => onChange(option.value)}
          >
            {active ? (
              <motion.span layoutId={pillId} className="ui-segmented__pill" transition={layoutSpring} />
            ) : null}
            <span className="ui-segmented__label">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
