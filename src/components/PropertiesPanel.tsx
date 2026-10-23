import { AnimatePresence } from 'motion/react'
import { useState } from 'react'
import { useEditor } from '../editor/EditorContext'
import type {
  BuiltinTextLevelKey,
  FontStyle,
  TextAlign,
  TextLevelPreset,
  TextLevelOverrides,
  UserTextTier,
} from '../types/document'
import {
  createDefaultUserTextTier,
  getTextTierLabel,
  mergeTextLevelPreset,
  TEXT_LEVEL_PRESETS,
  TEXT_PRESET_LEVEL_KEYS,
} from '../types/document'
import { MotionDialog } from './MotionDialog'
import { PAPER_FONTS } from '../fonts/paperFont'

function buildLevelDraft(overrides: TextLevelOverrides): Record<BuiltinTextLevelKey, TextLevelPreset> {
  const out = {} as Record<BuiltinTextLevelKey, TextLevelPreset>
  for (const key of TEXT_PRESET_LEVEL_KEYS) {
    const m = mergeTextLevelPreset(key, overrides)
    out[key] = { label: m.label, fontSize: m.fontSize, fill: m.fill, boxStroke: m.boxStroke }
  }
  return out
}

export function PropertiesPanel() {
  const { state, dispatch } = useEditor()
  const [levelDialogOpen, setLevelDialogOpen] = useState(false)
  const [levelDraft, setLevelDraft] = useState<Record<BuiltinTextLevelKey, TextLevelPreset> | null>(null)
  const [userTierDraft, setUserTierDraft] = useState<UserTextTier[] | null>(null)
  const selId = state.selectedId
  const obj = selId ? state.objects.find((o) => o.id === selId) : null

  const openLevelDialog = () => {
    setLevelDraft(buildLevelDraft(state.textLevelOverrides))
    setUserTierDraft(state.userTextTiers.map((t) => ({ ...t })))
    setLevelDialogOpen(true)
  }
  const closeLevelDialog = () => {
    setLevelDialogOpen(false)
    setLevelDraft(null)
    setUserTierDraft(null)
  }

  if (!obj) {
    return (
      <aside className="properties-panel">
        <h2 className="properties-panel__title">屬性</h2>
        <p className="properties-panel__hint">點選畫布上的物件以編輯樣式。</p>
      </aside>
    )
  }

  if (obj.type === 'text') {
    const levelLocked = obj.textLevel !== 'custom'
    const currentLevelLabel = getTextTierLabel(obj.textLevel, state.textLevelOverrides, state.userTextTiers)
    return (
      <>
        <aside className="properties-panel">
          <h2 className="properties-panel__title">文字</h2>
          <div className="field field--row">
            <span>階層</span>
            <div className="properties-panel__level-summary">
              <span className="properties-panel__level-summary-v">{currentLevelLabel}</span>
              <button type="button" className="properties-panel__level-btn" onClick={openLevelDialog}>
                階層總表…
              </button>
            </div>
          </div>
          <label className="field">
            <span>套用階層</span>
            <select
              value={obj.textLevel}
              onChange={(e) =>
                dispatch({ type: 'SET_TEXT_STYLE', id: obj.id, patch: { textLevel: e.target.value } })
              }
            >
              {TEXT_PRESET_LEVEL_KEYS.map((key) => (
                <option key={key} value={key}>
                  {getTextTierLabel(key, state.textLevelOverrides, state.userTextTiers)}
                </option>
              ))}
              {state.userTextTiers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
              <option value="custom">自訂（不套階層）</option>
            </select>
          </label>
          {levelLocked ? (
            <p className="properties-panel__hint">
              此階層的字級與文字顏色依總表預設；此處可改對齊、區塊寬度與字型家族。
            </p>
          ) : null}
        <label className="field">
          <span>字級</span>
          <input
            type="number"
            min={8}
            max={120}
            value={obj.fontSize}
            disabled={levelLocked}
            onChange={(e) =>
              dispatch({
                type: 'SET_TEXT_STYLE',
                id: obj.id,
                patch: { fontSize: Number(e.target.value) || obj.fontSize },
              })
            }
          />
        </label>
        <label className="field">
          <span>字型</span>
          <select
            value={obj.fontFamily}
            onChange={(e) =>
              dispatch({
                type: 'SET_TEXT_STYLE',
                id: obj.id,
                patch: { fontFamily: e.target.value },
              })
            }
          >
            {PAPER_FONTS.map((font) => (
              <option key={font.id} value={font.family}>
                {font.label}
              </option>
            ))}
            {PAPER_FONTS.some((font) => font.family === obj.fontFamily) ? null : (
              <option value={obj.fontFamily}>目前字型</option>
            )}
          </select>
        </label>
        <label className="field">
          <span>文字顏色</span>
          <input
            type="color"
            value={obj.fill.length === 7 ? obj.fill : '#111827'}
            disabled={levelLocked}
            onChange={(e) =>
              dispatch({
                type: 'SET_TEXT_STYLE',
                id: obj.id,
                patch: { fill: e.target.value },
              })
            }
          />
        </label>
        {!levelLocked ? (
          <label className="field">
            <span>選取時外框</span>
            <input
              type="color"
              value={obj.boxStroke.length === 7 ? obj.boxStroke : '#64748b'}
              onChange={(e) =>
                dispatch({
                  type: 'SET_TEXT_STYLE',
                  id: obj.id,
                  patch: { boxStroke: e.target.value },
                })
              }
            />
          </label>
        ) : null}
        <label className="field">
          <span>樣式</span>
          <select
            value={obj.fontStyle}
            onChange={(e) =>
              dispatch({
                type: 'SET_TEXT_STYLE',
                id: obj.id,
                patch: { fontStyle: e.target.value as FontStyle },
              })
            }
          >
            <option value="normal">一般</option>
            <option value="bold">粗體</option>
            <option value="italic">斜體</option>
            <option value="bold italic">粗斜體</option>
          </select>
        </label>
        <label className="field">
          <span>對齊</span>
          <select
            value={obj.align}
            onChange={(e) =>
              dispatch({
                type: 'SET_TEXT_STYLE',
                id: obj.id,
                patch: { align: e.target.value as TextAlign },
              })
            }
          >
            <option value="left">靠左</option>
            <option value="center">置中</option>
            <option value="right">靠右</option>
          </select>
        </label>
        <label className="field">
          <span>區塊寬度</span>
          <input
            type="number"
            min={40}
            max={state.pageWidth}
            value={Math.round(obj.width)}
            onChange={(e) =>
              dispatch({
                type: 'SET_TEXT_STYLE',
                id: obj.id,
                patch: { width: Number(e.target.value) || obj.width },
              })
            }
          />
        </label>
        </aside>
        <AnimatePresence>
        {levelDialogOpen && levelDraft && userTierDraft ? (
          <MotionDialog key="text-levels" titleId="text-level-dialog-title" onClose={closeLevelDialog}>
              <h3 id="text-level-dialog-title" className="text-level-dialog__title">
                文字階層總表
              </h3>
              <p className="text-level-dialog__intro">
                內建四列與下方自訂階層為整份文件共用。按「儲存階層目錄」後會更新所有使用該階層的文字。方塊本體維持透明，僅在選取時顯示外框色。
              </p>
              <div className="text-level-dialog__quick">
                <span className="text-level-dialog__quick-label">目前這段文字改為：</span>
                <div className="text-level-dialog__chips">
                  {TEXT_PRESET_LEVEL_KEYS.map((key) => (
                    <button
                      key={key}
                      type="button"
                      className={`text-level-dialog__chip${obj.textLevel === key ? ' is-active' : ''}`}
                      onClick={() =>
                        dispatch({
                          type: 'SET_TEXT_STYLE',
                          id: obj.id,
                          patch: { textLevel: key },
                        })
                      }
                    >
                      {levelDraft[key].label}
                    </button>
                  ))}
                  {userTierDraft.map((tier) => (
                    <button
                      key={tier.id}
                      type="button"
                      className={`text-level-dialog__chip${obj.textLevel === tier.id ? ' is-active' : ''}`}
                      onClick={() =>
                        dispatch({
                          type: 'SET_TEXT_STYLE',
                          id: obj.id,
                          patch: { textLevel: tier.id },
                        })
                      }
                    >
                      {tier.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={`text-level-dialog__chip${obj.textLevel === 'custom' ? ' is-active' : ''}`}
                    onClick={() =>
                      dispatch({
                        type: 'SET_TEXT_STYLE',
                        id: obj.id,
                        patch: { textLevel: 'custom' },
                      })
                    }
                  >
                    自訂
                  </button>
                </div>
              </div>
              <div className="text-level-dialog__table-wrap">
                <table className="text-level-dialog__table">
                  <thead>
                    <tr>
                      <th>類型</th>
                      <th>顯示名稱</th>
                      <th>字級 (px)</th>
                      <th>文字色</th>
                      <th>選取外框</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {TEXT_PRESET_LEVEL_KEYS.map((key) => (
                      <tr key={key}>
                        <td className="text-level-dialog__td-type">{TEXT_LEVEL_PRESETS[key].label}</td>
                        <td>
                          <input
                            className="text-level-dialog__input"
                            type="text"
                            value={levelDraft[key].label}
                            onChange={(e) =>
                              setLevelDraft((d) =>
                                d ? { ...d, [key]: { ...d[key], label: e.target.value } } : d,
                              )
                            }
                          />
                        </td>
                        <td>
                          <input
                            className="text-level-dialog__input text-level-dialog__input--num"
                            type="number"
                            min={8}
                            max={120}
                            value={levelDraft[key].fontSize}
                            onChange={(e) =>
                              setLevelDraft((d) =>
                                d
                                  ? {
                                      ...d,
                                      [key]: {
                                        ...d[key],
                                        fontSize: Number(e.target.value) || d[key].fontSize,
                                      },
                                    }
                                  : d,
                              )
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="color"
                            value={levelDraft[key].fill.length === 7 ? levelDraft[key].fill : '#111827'}
                            onChange={(e) =>
                              setLevelDraft((d) =>
                                d ? { ...d, [key]: { ...d[key], fill: e.target.value } } : d,
                              )
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="color"
                            value={
                              levelDraft[key].boxStroke.length === 7 ? levelDraft[key].boxStroke : '#64748b'
                            }
                            onChange={(e) =>
                              setLevelDraft((d) =>
                                d ? { ...d, [key]: { ...d[key], boxStroke: e.target.value } } : d,
                              )
                            }
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            className="text-level-dialog__link"
                            onClick={() =>
                              dispatch({
                                type: 'SET_TEXT_STYLE',
                                id: obj.id,
                                patch: { textLevel: key },
                              })
                            }
                          >
                            套用至目前文字
                          </button>
                        </td>
                      </tr>
                    ))}
                    {userTierDraft.map((tier) => (
                      <tr key={tier.id}>
                        <td className="text-level-dialog__td-type">自訂</td>
                        <td>
                          <input
                            className="text-level-dialog__input"
                            type="text"
                            value={tier.label}
                            onChange={(e) => {
                              const v = e.target.value
                              setUserTierDraft((list) =>
                                list?.map((t) => (t.id === tier.id ? { ...t, label: v } : t)) ?? null,
                              )
                            }}
                          />
                        </td>
                        <td>
                          <input
                            className="text-level-dialog__input text-level-dialog__input--num"
                            type="number"
                            min={8}
                            max={120}
                            value={tier.fontSize}
                            onChange={(e) => {
                              const n = Number(e.target.value) || tier.fontSize
                              setUserTierDraft((list) =>
                                list?.map((t) => (t.id === tier.id ? { ...t, fontSize: n } : t)) ?? null,
                              )
                            }}
                          />
                        </td>
                        <td>
                          <input
                            type="color"
                            value={tier.fill.length === 7 ? tier.fill : '#111827'}
                            onChange={(e) =>
                              setUserTierDraft((list) =>
                                list?.map((t) => (t.id === tier.id ? { ...t, fill: e.target.value } : t)) ?? null,
                              )
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="color"
                            value={tier.boxStroke.length === 7 ? tier.boxStroke : '#64748b'}
                            onChange={(e) =>
                              setUserTierDraft((list) =>
                                list?.map((t) =>
                                  t.id === tier.id ? { ...t, boxStroke: e.target.value } : t,
                                ) ?? null,
                              )
                            }
                          />
                        </td>
                        <td>
                          <div className="text-level-dialog__cell-actions">
                            <button
                              type="button"
                              className="text-level-dialog__link text-level-dialog__link--danger"
                              onClick={() =>
                                setUserTierDraft((list) => list?.filter((t) => t.id !== tier.id) ?? null)
                              }
                            >
                              刪除
                            </button>
                            <button
                              type="button"
                              className="text-level-dialog__link"
                              onClick={() =>
                                dispatch({
                                  type: 'SET_TEXT_STYLE',
                                  id: obj.id,
                                  patch: { textLevel: tier.id },
                                })
                              }
                            >
                              套用至目前文字
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="text-level-dialog__add-tier">
                <button
                  type="button"
                  className="text-level-dialog__btn text-level-dialog__btn--ghost"
                  onClick={() =>
                    setUserTierDraft((list) => [...(list ?? []), createDefaultUserTextTier()])
                  }
                >
                  ＋ 新增自訂階層
                </button>
              </div>
              <div className="text-level-dialog__footer">
                <button type="button" className="text-level-dialog__btn text-level-dialog__btn--ghost" onClick={closeLevelDialog}>
                  取消
                </button>
                <button
                  type="button"
                  className="text-level-dialog__btn text-level-dialog__btn--primary"
                  onClick={() => {
                    const overridesPatch: TextLevelOverrides = {}
                    for (const key of TEXT_PRESET_LEVEL_KEYS) {
                      overridesPatch[key] = { ...levelDraft[key] }
                    }
                    dispatch({
                      type: 'COMMIT_TEXT_TIER_CATALOG',
                      overridesPatch,
                      userTiers: userTierDraft.map((t) => ({ ...t })),
                    })
                    closeLevelDialog()
                  }}
                >
                  儲存階層目錄
                </button>
              </div>
          </MotionDialog>
        ) : null}
        </AnimatePresence>
      </>
    )
  }

  if (obj.type === 'line') {
    return (
      <aside className="properties-panel">
        <h2 className="properties-panel__title">線條</h2>
        <label className="field">
          <span>顏色</span>
          <input
            type="color"
            value={obj.stroke.length === 7 ? obj.stroke : '#111827'}
            onChange={(e) =>
              dispatch({
                type: 'SET_LINE_STYLE',
                id: obj.id,
                patch: { stroke: e.target.value },
              })
            }
          />
        </label>
        <label className="field">
          <span>線寬</span>
          <input
            type="number"
            min={1}
            max={24}
            value={obj.strokeWidth}
            onChange={(e) =>
              dispatch({
                type: 'SET_LINE_STYLE',
                id: obj.id,
                patch: { strokeWidth: Number(e.target.value) || obj.strokeWidth },
              })
            }
          />
        </label>
      </aside>
    )
  }

  if (obj.type === 'rect') {
    return (
      <aside className="properties-panel">
        <h2 className="properties-panel__title">矩形</h2>
        <label className="field">
          <span>填色</span>
          <input
            type="color"
            value={obj.fill === 'transparent' ? '#ffffff' : obj.fill}
            onChange={(e) =>
              dispatch({
                type: 'SET_RECT_STYLE',
                id: obj.id,
                patch: { fill: e.target.value },
              })
            }
          />
        </label>
        <label className="field">
          <span>透明填色</span>
          <input
            type="checkbox"
            checked={obj.fill === 'transparent'}
            onChange={(e) =>
              dispatch({
                type: 'SET_RECT_STYLE',
                id: obj.id,
                patch: { fill: e.target.checked ? 'transparent' : '#ffffff' },
              })
            }
          />
        </label>
        <label className="field">
          <span>框線顏色</span>
          <input
            type="color"
            value={obj.stroke.length === 7 ? obj.stroke : '#374151'}
            onChange={(e) =>
              dispatch({
                type: 'SET_RECT_STYLE',
                id: obj.id,
                patch: { stroke: e.target.value },
              })
            }
          />
        </label>
        <label className="field">
          <span>框線寬度</span>
          <input
            type="number"
            min={0}
            max={24}
            value={obj.strokeWidth}
            onChange={(e) =>
              dispatch({
                type: 'SET_RECT_STYLE',
                id: obj.id,
                patch: { strokeWidth: Number(e.target.value) },
              })
            }
          />
        </label>
        <label className="field">
          <span>圓角</span>
          <input
            type="number"
            min={0}
            max={80}
            value={obj.cornerRadius}
            onChange={(e) =>
              dispatch({
                type: 'SET_RECT_STYLE',
                id: obj.id,
                patch: { cornerRadius: Number(e.target.value) },
              })
            }
          />
        </label>
      </aside>
    )
  }

  if (obj.type === 'image') {
    return (
      <aside className="properties-panel">
        <h2 className="properties-panel__title">圖片</h2>
        <p className="properties-panel__hint">拖曳角落可縮放；拖曳本體可移動位置。</p>
      </aside>
    )
  }

  return null
}
