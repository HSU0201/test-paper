import { motion } from 'motion/react'
import { useRef, type ChangeEventHandler } from 'react'
import { useEditor } from '../../editor/EditorContext'
import { mergeTextLevelPreset, TEXT_PRESET_LEVEL_KEYS } from '../../types/document'
import { layoutSpring } from '../../motion/presets'
import { Icon, PanelSection } from '../ui'

export function InsertPanel() {
  const { state, dispatch } = useEditor()
  const fileRef = useRef<HTMLInputElement>(null)
  const placingTier = state.textPlacementMode ? state.defaultNewTextTierId : null

  const startPlacing = (tierId: string) => {
    if (placingTier === tierId) {
      dispatch({ type: 'CANCEL_TEXT_PLACEMENT' })
      return
    }
    dispatch({ type: 'SET_DEFAULT_NEW_TEXT_TIER', tierId })
    dispatch({ type: 'START_TEXT_PLACEMENT' })
  }

  const onImageFile: ChangeEventHandler<HTMLInputElement> = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      window.alert('請選擇圖片檔。')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const src = String(reader.result)
      const im = new Image()
      im.onload = () =>
        dispatch({ type: 'ADD_IMAGE', src, width: im.naturalWidth, height: im.naturalHeight })
      im.onerror = () => window.alert('圖片載入失敗。')
      im.src = src
    }
    reader.readAsDataURL(file)
  }

  const tiers = [
    ...TEXT_PRESET_LEVEL_KEYS.map((key) => {
      const m = mergeTextLevelPreset(key, state.textLevelOverrides)
      return { id: key, label: m.label, fontSize: m.fontSize, color: m.boxStroke }
    }),
    ...state.userTextTiers.map((t) => ({ id: t.id, label: t.label, fontSize: t.fontSize, color: t.boxStroke })),
  ]

  return (
    <div className="side-panel__scroll">
      <PanelSection title="文字" description="選一種階層，再到紙張上點一下放置；會自動對齊所在欄位。">
        <div className="insert-tiers">
          {tiers.map((t) => (
            <motion.button
              key={t.id}
              type="button"
              className={`insert-tier${placingTier === t.id ? ' is-active' : ''}`}
              onClick={() => startPlacing(t.id)}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.985 }}
              transition={layoutSpring}
            >
              <span className="insert-tier__swatch" style={{ background: t.color }} />
              <span className="insert-tier__label">{t.label}</span>
              <span className="insert-tier__meta">{t.fontSize}px</span>
            </motion.button>
          ))}
        </div>
      </PanelSection>

      <PanelSection title="圖形與媒體">
        <div className="insert-grid">
          <motion.button
            type="button"
            className="insert-tile"
            onClick={() => dispatch({ type: 'ADD_LINE' })}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.97 }}
            transition={layoutSpring}
          >
            <Icon name="line" />
            線條
          </motion.button>
          <motion.button
            type="button"
            className="insert-tile"
            onClick={() => dispatch({ type: 'ADD_RECT' })}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.97 }}
            transition={layoutSpring}
          >
            <Icon name="rect" />
            方框
          </motion.button>
          <motion.button
            type="button"
            className="insert-tile"
            onClick={() => fileRef.current?.click()}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.97 }}
            transition={layoutSpring}
          >
            <Icon name="image" />
            圖片
          </motion.button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="visually-hidden"
          onChange={onImageFile}
          aria-hidden
          tabIndex={-1}
        />
      </PanelSection>
    </div>
  )
}
