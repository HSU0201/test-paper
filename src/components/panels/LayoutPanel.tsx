import { useEditor } from '../../editor/EditorContext'
import { HEADER_FIELD_DEFS, HEADER_FIELD_ORDER, type HeaderFieldKey } from '../../types/layout'
import { NumberField, PanelSection, Segmented, Switch } from '../ui'

const PLACEMENT_HINT: Record<string, string> = {
  title: '大標・置中',
  subtitle: '副標・置中',
  infoLeft: '資訊列・左',
  infoRight: '資訊列・右',
}

function HeaderFieldRow({ fieldKey }: { fieldKey: HeaderFieldKey }) {
  const { state, dispatch } = useEditor()
  const def = HEADER_FIELD_DEFS[fieldKey]
  const f = state.layout.header[fieldKey]
  const set = (patch: Partial<typeof f>) => dispatch({ type: 'SET_HEADER_FIELD', key: fieldKey, patch })
  return (
    <div className={`header-field${f.visible ? '' : ' is-off'}`}>
      <div className="header-field__top">
        {def.showLabel ? (
          <input
            className="header-field__label-input"
            value={f.label}
            aria-label={`${def.defaultLabel}的標籤文字`}
            onChange={(e) => set({ label: e.target.value })}
          />
        ) : (
          <span className="header-field__label">{f.label}</span>
        )}
        <span className="header-field__tag">{PLACEMENT_HINT[def.placement]}</span>
        <Switch checked={f.visible} label={`顯示${def.defaultLabel}`} onChange={(v) => set({ visible: v })} />
      </div>
      <input
        className="ui-input"
        value={f.value}
        placeholder={def.placeholder}
        disabled={!f.visible}
        onChange={(e) => set({ value: e.target.value })}
      />
    </div>
  )
}

export function LayoutPanel() {
  const { state, dispatch } = useEditor()
  const { columns, margin, headerRule } = state.layout
  const primary = HEADER_FIELD_ORDER.filter((k) => ['schoolName', 'examTitle', 'teacher'].includes(k))
  const extra = HEADER_FIELD_ORDER.filter((k) => !primary.includes(k))

  return (
    <div className="side-panel__scroll">
      <PanelSection title="頁首" description="學校名稱與出題老師為固定位置，只需填寫內容。">
        {primary.map((k) => (
          <HeaderFieldRow key={k} fieldKey={k} />
        ))}
      </PanelSection>

      <PanelSection title="資訊列欄位" description="打開需要的欄位；內容留白時會顯示底線供學生填寫。">
        {extra.map((k) => (
          <HeaderFieldRow key={k} fieldKey={k} />
        ))}
        <div className="ui-row">
          <span className="ui-row__label">頁首分隔線</span>
          <Switch
            checked={headerRule}
            label="頁首分隔線"
            onChange={(v) => dispatch({ type: 'SET_LAYOUT', patch: { headerRule: v } })}
          />
        </div>
      </PanelSection>

      <PanelSection title="分欄">
        <Segmented
          label="欄數"
          value={columns.count}
          options={[
            { value: 1, label: '單欄' },
            { value: 2, label: '左右雙欄' },
          ]}
          onChange={(v) => dispatch({ type: 'SET_COLUMNS', patch: { count: v } })}
        />
        {columns.count === 2 ? (
          <>
            <label className="ui-field">
              <span className="ui-field__label">
                左右比例 <strong>{Math.round(columns.leftRatio * 100)} : {100 - Math.round(columns.leftRatio * 100)}</strong>
              </span>
              <input
                type="range"
                min={30}
                max={70}
                step={5}
                value={Math.round(columns.leftRatio * 100)}
                onChange={(e) =>
                  dispatch({ type: 'SET_COLUMNS', patch: { leftRatio: Number(e.target.value) / 100 } })
                }
              />
            </label>
            <div className="ui-grid-2">
              <NumberField
                label="欄距"
                suffix="px"
                min={0}
                max={120}
                value={columns.gap}
                onChange={(v) => dispatch({ type: 'SET_COLUMNS', patch: { gap: v } })}
              />
              <div className="ui-row ui-row--stack">
                <span className="ui-row__label">中間分隔線</span>
                <Switch
                  checked={columns.divider}
                  label="中間分隔線"
                  onChange={(v) => dispatch({ type: 'SET_COLUMNS', patch: { divider: v } })}
                />
              </div>
            </div>
          </>
        ) : null}
        <div className="ui-row">
          <span className="ui-row__label">顯示欄標題</span>
          <Switch
            checked={columns.showTitles}
            label="顯示欄標題"
            onChange={(v) => dispatch({ type: 'SET_COLUMNS', patch: { showTitles: v } })}
          />
        </div>
        {columns.showTitles
          ? ([0, 1] as const).slice(0, columns.count).map((i) => (
              <label key={i} className="ui-field">
                <span className="ui-field__label">{columns.count === 1 ? '欄標題' : i === 0 ? '左欄標題' : '右欄標題'}</span>
                <input
                  className="ui-input"
                  value={columns.titles[i]}
                  onChange={(e) => dispatch({ type: 'SET_COLUMN_TITLE', index: i, title: e.target.value })}
                />
              </label>
            ))
          : null}
      </PanelSection>

      <PanelSection title="頁邊距">
        <div className="ui-grid-2">
          {(
            [
              ['top', '上'],
              ['bottom', '下'],
              ['left', '左'],
              ['right', '右'],
            ] as const
          ).map(([k, label]) => (
            <NumberField
              key={k}
              label={label}
              suffix="px"
              min={0}
              max={200}
              value={margin[k]}
              onChange={(v) => dispatch({ type: 'SET_LAYOUT', patch: { margin: { ...margin, [k]: v } } })}
            />
          ))}
        </div>
      </PanelSection>
    </div>
  )
}
