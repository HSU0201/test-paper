import { useEffect } from 'react'

import { AnimatePresence, motion } from 'motion/react'

import { useEditor } from '../../editor/EditorContext'
import { easeOut } from '../../motion/presets'
import { HEADER_ROLE_LABEL, type HeaderItem, resolveSplit, type SpacingSettings } from '../../types/layout'
import { NumberField, PanelSection, Segmented, Switch } from '../ui'

function HeaderItemRow({ item, selected }: { item: HeaderItem; selected: boolean }) {
  const { dispatch } = useEditor()
  const set = (patch: Partial<HeaderItem>) => dispatch({ type: 'UPDATE_HEADER_ITEM', id: item.id, patch })
  const name = item.role === 'custom' ? item.label || '自訂欄位' : HEADER_ROLE_LABEL[item.role]
  return (
    <div
      className={`header-field${item.visible ? '' : ' is-off'}${selected ? ' is-selected' : ''}`}
      data-header-id={item.id}
      onClick={() => item.visible && dispatch({ type: 'SELECT_BLOCK', ref: { kind: 'header', id: item.id } })}
    >
      <div className="header-field__top">
        <span className="header-field__label">{name}</span>
        {item.role === 'custom' ? <span className="header-field__tag">自訂</span> : null}
        <span onClick={(e) => e.stopPropagation()}>
          <Switch checked={item.visible} label={`顯示${name}`} onChange={(v) => set({ visible: v })} />
        </span>
      </div>
      <AnimatePresence initial={false}>
        {item.visible ? (
          <motion.div
            key="value"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: easeOut }}
            style={{ overflow: 'hidden' }}
          >
            <input
              className="ui-input"
              value={item.value}
              placeholder={item.showLabel ? '留白則印出底線供學生填寫' : `輸入${name}`}
              onClick={(e) => e.stopPropagation()}
              onFocus={() => dispatch({ type: 'SELECT_BLOCK', ref: { kind: 'header', id: item.id } })}
              onChange={(e) => set({ value: e.target.value })}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

function RangeRow({
  label,
  k,
  step,
  min,
  max,
  suffix,
}: {
  label: string
  k: Exclude<keyof SpacingSettings, 'allowSqueeze'>
  step: number
  min: number
  max: number
  suffix?: string
}) {
  const { state, dispatch } = useEditor()
  const r = state.layout.spacing[k]
  const allow = state.layout.spacing.allowSqueeze
  return (
    <div className="range-row">
      <span className="range-row__label">{label}</span>
      <NumberField
        label="標準"
        value={r.nominal}
        step={step}
        min={min}
        max={max}
        suffix={suffix}
        onChange={(v) => dispatch({ type: 'SET_SPACING', patch: { [k]: { nominal: v, min: Math.min(r.min, v) } } })}
      />
      {allow ? (
        <NumberField
          label="最小"
          value={r.min}
          step={step}
          min={min}
          max={r.nominal}
          suffix={suffix}
          onChange={(v) => dispatch({ type: 'SET_SPACING', patch: { [k]: { nominal: r.nominal, min: v } } })}
        />
      ) : null}
    </div>
  )
}

export function LayoutPanel({ part = 'all' }: { part?: 'all' | 'header' | 'flow' }) {
  const { state, dispatch, flow } = useEditor()
  const { columns, margin, header, spacing } = state.layout
  const selectedHeader = state.selectedBlock?.kind === 'header' ? state.selectedBlock.id : null
  const landscape = state.pageWidth > state.pageHeight
  const effective = resolveSplit(columns, state.pageWidth, state.pageHeight)

  useEffect(() => {
    if (part === 'flow' || !selectedHeader) return
    document.querySelector<HTMLElement>(`[data-header-id="${CSS.escape(selectedHeader)}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [part, selectedHeader])

  return (
    <div className={part === 'all' ? 'side-panel__scroll' : 'sheet-part'}>
      {part !== 'flow' ? (
        <PanelSection
          title="頁首"
          description={
            landscape
              ? '橫向紙張的頁首改放在最右側，文字由上往下直排。拖曳可調整位置，上下把手調整長度。'
              : '學校名稱和試卷名稱同一列、幾乎整行寬時，會合成一行置中標題。字級與粗體可在右側調整。其他欄位可直接拖曳，兩側把手改寬度。'
          }
          actions={
            <button type="button" className="text-btn" onClick={() => dispatch({ type: 'RESET_HEADER_LAYOUT' })}>
              還原版型
            </button>
          }
        >
          {header.items.map((it) => (
            <HeaderItemRow key={it.id} item={it} selected={selectedHeader === it.id} />
          ))}
          <button type="button" className="btn btn--ghost btn--block" onClick={() => dispatch({ type: 'ADD_HEADER_ITEM' })}>
            ＋ 新增自訂欄位
          </button>
          <div className="ui-grid-2">
            <NumberField
              label={landscape ? '頁首寬度' : '頁首高度'}
              suffix="px"
              min={20}
              max={260}
              value={header.height}
              onChange={(v) => dispatch({ type: 'SET_HEADER', patch: { height: v } })}
            />
            <div className="ui-row ui-row--stack">
              <span className="ui-row__label">{landscape ? '左側分隔線' : '下方分隔線'}</span>
              <Switch
                checked={header.rule}
                label="頁首分隔線"
                onChange={(v) => dispatch({ type: 'SET_HEADER', patch: { rule: v } })}
              />
            </div>
          </div>
          <div className="ui-row">
            <span className="ui-row__label">每一頁都印頁首</span>
            <Switch
              checked={header.repeat}
              label="每一頁都印頁首"
              onChange={(v) => dispatch({ type: 'SET_HEADER', patch: { repeat: v } })}
            />
          </div>
        </PanelSection>
      ) : null}

      {part !== 'header' ? (
        <>
          <PanelSection title="分欄">
            <Segmented
              label="欄數"
              value={columns.count}
              options={[
                { value: 1, label: '單欄' },
                { value: 2, label: '雙欄' },
              ]}
              onChange={(v) => dispatch({ type: 'SET_COLUMNS', patch: { count: v } })}
            />
            {columns.count === 2 ? (
              <>
                <Segmented
                  label="分欄方向"
                  value={columns.split}
                  options={[
                    { value: 'auto', label: '自動' },
                    { value: 'vertical', label: '左右' },
                    { value: 'horizontal', label: '上下' },
                  ]}
                  onChange={(v) => dispatch({ type: 'SET_COLUMNS', patch: { split: v } })}
                />
                {columns.split === 'auto' ? (
                  <p className="panel-hint">
                    直式左右分欄。橫式分成上下兩區，文字直排，先由上半部右邊排到左邊，再由下半部右邊排到左邊（目前：
                    {effective === 'vertical' ? '左右' : '上下'}）
                  </p>
                ) : null}
                <label className="ui-field">
                  <span className="ui-field__label">
                    {effective === 'vertical' ? '左右' : '上下'}比例{' '}
                    <strong>
                      {Math.round(columns.ratio * 100)} : {100 - Math.round(columns.ratio * 100)}
                    </strong>
                  </span>
                  <input
                    type="range"
                    min={30}
                    max={70}
                    step={5}
                    value={Math.round(columns.ratio * 100)}
                    onChange={(e) => dispatch({ type: 'SET_COLUMNS', patch: { ratio: Number(e.target.value) / 100 } })}
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
          </PanelSection>

          <PanelSection
            title="行距與間距"
            description="內容快排不下時，會先在「標準」與「最小」之間自動壓縮，能少一頁或避免標題落單才會壓。"
          >
            <div className="ui-row">
              <span className="ui-row__label">允許自動壓縮</span>
              <Switch
                checked={spacing.allowSqueeze}
                label="允許自動壓縮"
                onChange={(v) => dispatch({ type: 'SET_SPACING', patch: { allowSqueeze: v } })}
              />
            </div>
            <RangeRow label="行高" k="lineHeight" step={0.05} min={1} max={3} suffix="倍" />
            <RangeRow label="題距" k="questionGap" step={1} min={0} max={80} suffix="px" />
            <RangeRow label="大題間距" k="sectionGap" step={1} min={0} max={120} suffix="px" />
            {flow.squeeze > 0 ? (
              <p className="panel-hint is-info">目前已壓縮 {Math.round(flow.squeeze * 100)}%（行高 {flow.lineHeight}）</p>
            ) : null}
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
                  onChange={(v) => dispatch({ type: 'SET_MARGIN', patch: { [k]: v } })}
                />
              ))}
            </div>
          </PanelSection>
        </>
      ) : null}
    </div>
  )
}
