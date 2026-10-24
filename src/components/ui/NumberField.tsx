type NumberFieldProps = {
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  suffix?: string
  onChange: (value: number) => void
}

export function NumberField({ label, value, min, max, step, suffix, onChange }: NumberFieldProps) {
  return (
    <label className="ui-field ui-field--num">
      <span className="ui-field__label">{label}</span>
      <span className="ui-input-affix">
        <input
          type="number"
          className="ui-input"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(event) => {
            const next = Number(event.target.value)
            if (Number.isFinite(next)) onChange(next)
          }}
        />
        {suffix ? <span className="ui-input-affix__suffix">{suffix}</span> : null}
      </span>
    </label>
  )
}
