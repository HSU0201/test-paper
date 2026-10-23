import { useEditor } from '../editor/EditorContext'
import { ColorField } from './ColorField'
import { HEADER_ROLE_LABEL, type HeaderItem } from '../types/layout'
import { NumberField, PanelSection, Segmented, Switch } from './ui'

export function HeaderItemInspector({ item }: { item: HeaderItem }) {
  const { state, dispatch } = useEditor()
  const set = (patch: Partial<HeaderItem>) => dispatch({ type: 'UPDATE_HEADER_ITEM', id: item.id, patch })
  const vertical = state.pageWidth > state.pageHeight
  const maxY = Math.max(0, state.layout.header.height - Math.round(item.fontSize * 1.4))

  return (
    <div className="inspector__body">
      <PanelSection title="內容">
        <div className="ui-field">
          <span className="ui-field__label">標籤</span>
          <ColorField
            ariaLabel="頁首標籤"
            value={item.label}
            placeholder={HEADER_ROLE_LABEL[item.role]}
            onChange={(label) => set({ label })}
          />
        </div>
        <div className="ui-row">
          <span className="ui-row__label">印出標籤（例如「班級：」）</span>
          <Switch checked={item.showLabel} label="印出標籤" onChange={(v) => set({ showLabel: v })} />
        </div>
        <div className="ui-field">
          <span className="ui-field__label">內容</span>
          <ColorField
            ariaLabel="頁首內容"
            value={item.value}
            placeholder={item.showLabel ? '留白則印出底線' : ''}
            onChange={(value) => set({ value })}
          />
        </div>
      </PanelSection>

      <PanelSection title="文字樣式">
        <NumberField label="字級" suffix="px" min={8} max={60} value={item.fontSize} onChange={(v) => set({ fontSize: v })} />
        <div className="ui-row">
          <span className="ui-row__label">粗體</span>
          <Switch checked={item.bold} label="粗體" onChange={(v) => set({ bold: v })} />
        </div>
        <Segmented
          label="對齊"
          value={item.align}
          options={[
            { value: 'left', label: vertical ? '靠上' : '靠左' },
            { value: 'center', label: '置中' },
            { value: 'right', label: vertical ? '靠下' : '靠右' },
          ]}
          onChange={(v) => set({ align: v })}
        />
      </PanelSection>

      <PanelSection
        title="位置"
        description={vertical ? '橫向時頁首在右側直排。拖曳可移動；上下把手調整長度。' : '也可以直接在紙上拖曳；左右把手調整寬度。'}
      >
        <div className="ui-grid-2">
          <NumberField
            label={vertical ? '距上 %' : '左側 %'}
            min={0}
            max={95}
            value={Math.round(item.xr * 100)}
            onChange={(v) => set({ xr: Math.min(v / 100, 1 - item.wr) })}
          />
          <NumberField
            label={vertical ? '長度 %' : '寬度 %'}
            min={5}
            max={100}
            value={Math.round(item.wr * 100)}
            onChange={(v) => set({ wr: v / 100, xr: Math.min(item.xr, 1 - v / 100) })}
          />
          <NumberField
            label={vertical ? '距右 px' : '上方 px'}
            min={0}
            max={maxY}
            value={Math.round(item.y)}
            onChange={(v) => set({ y: v })}
          />
        </div>
        <div className="ui-chip-row">
          <button type="button" className="ui-chip" onClick={() => set({ xr: 0, wr: 1, align: 'center' })}>
            {vertical ? '整欄置中' : '整行置中'}
          </button>
          <button type="button" className="ui-chip" onClick={() => set({ xr: 0, wr: 0.5, align: 'left' })}>
            {vertical ? '上半' : '左半'}
          </button>
          <button type="button" className="ui-chip" onClick={() => set({ xr: 0.5, wr: 0.5, align: 'right' })}>
            {vertical ? '下半' : '右半'}
          </button>
        </div>
      </PanelSection>
    </div>
  )
}
