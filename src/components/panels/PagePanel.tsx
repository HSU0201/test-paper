import { motion } from 'motion/react'

import { useEditor } from '../../editor/EditorContext'
import { layoutSpring } from '../../motion/presets'
import { detectPaperPreset, PAPER_PRESETS, type PaperPresetKey,pxToMm } from '../../types/document'
import { NumberField, PanelSection, Segmented } from '../ui'

export function PagePanel() {
  const { state, dispatch } = useEditor()
  const landscape = state.pageWidth > state.pageHeight
  const presetKey = detectPaperPreset(state.pageWidth, state.pageHeight)

  const setSize = (pageWidth: number, pageHeight: number) =>
    dispatch({ type: 'SET_PAGE_SIZE', pageWidth, pageHeight })

  const applyPreset = (key: PaperPresetKey, isLandscape: boolean) => {
    const p = PAPER_PRESETS[key]
    setSize(isLandscape ? p.height : p.width, isLandscape ? p.width : p.height)
  }

  return (
    <>
      <PanelSection title="紙張">
        <div className="paper-presets">
          {(Object.keys(PAPER_PRESETS) as PaperPresetKey[]).map((k) => {
            const p = PAPER_PRESETS[k]
            return (
              <motion.button
                key={k}
                type="button"
                className={`paper-preset${presetKey === k ? ' is-active' : ''}`}
                onClick={() => applyPreset(k, landscape)}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.97 }}
                transition={layoutSpring}
              >
                <span
                  className="paper-preset__thumb"
                  style={{ aspectRatio: landscape ? `${p.height} / ${p.width}` : `${p.width} / ${p.height}` }}
                />
                <span className="paper-preset__label">{p.label}</span>
                <span className="paper-preset__meta">
                  {pxToMm(p.width)}×{pxToMm(p.height)}
                </span>
              </motion.button>
            )
          })}
        </div>
        <Segmented
          label="紙張方向"
          value={landscape ? 'landscape' : 'portrait'}
          options={[
            { value: 'portrait', label: '直向' },
            { value: 'landscape', label: '橫向' },
          ]}
          onChange={(v) => {
            if ((v === 'landscape') !== landscape) setSize(state.pageHeight, state.pageWidth)
          }}
        />
      </PanelSection>

      <PanelSection
        title="自訂尺寸"
        description={`約 ${pxToMm(state.pageWidth)} × ${pxToMm(state.pageHeight)} mm（以 96 DPI 換算）`}
      >
        <div className="ui-grid-2">
          <NumberField
            label="寬"
            suffix="px"
            min={120}
            max={4000}
            value={state.pageWidth}
            onChange={(v) => setSize(v, state.pageHeight)}
          />
          <NumberField
            label="高"
            suffix="px"
            min={120}
            max={4000}
            value={state.pageHeight}
            onChange={(v) => setSize(state.pageWidth, v)}
          />
        </div>
      </PanelSection>
    </>
  )
}
