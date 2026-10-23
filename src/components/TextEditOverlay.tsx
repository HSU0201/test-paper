import { useEffect, useLayoutEffect, useRef } from 'react'
import { useEditor } from '../editor/EditorContext'
import { EDITOR_SELECTION } from '../editor/theme'
import { TEXT_BOX_PADDING } from '../types/document'

type TextEditOverlayProps = {
  editingId: string | null
  scale: number
  onClose: () => void
}

export function TextEditOverlay({ editingId, scale, onClose }: TextEditOverlayProps) {
  const { state, dispatch } = useEditor()
  const taRef = useRef<HTMLTextAreaElement>(null)
  const snapshotRef = useRef('')
  const skipBlurCommit = useRef(false)

  const obj = editingId ? state.objects.find((o) => o.id === editingId) : null
  const textObj = obj?.type === 'text' ? obj : null

  useLayoutEffect(() => {
    if (!editingId || !textObj) return
    snapshotRef.current = textObj.text
  }, [editingId, textObj])

  useEffect(() => {
    if (!textObj) return
    const el = taRef.current
    if (!el) return
    el.focus()
    el.select()
  }, [textObj])

  if (!textObj) return null

  const commit = () => {
    const el = taRef.current
    if (!el) return
    dispatch({
      type: 'SET_TEXT_STYLE',
      id: textObj.id,
      patch: { text: el.value },
    })
    onClose()
  }

  return (
    <textarea
      key={editingId}
      ref={taRef}
      className="text-edit-overlay"
      style={{
        position: 'absolute',
        left: (textObj.x + TEXT_BOX_PADDING) * scale,
        top: (textObj.y + TEXT_BOX_PADDING) * scale,
        width: Math.max(40, textObj.width - TEXT_BOX_PADDING * 2) * scale,
        minHeight: textObj.fontSize * scale * 3,
        fontSize: textObj.fontSize * scale,
        fontFamily: textObj.fontFamily,
        color: textObj.fill,
        fontWeight: textObj.fontStyle.includes('bold') ? 'bold' : 'normal',
        fontStyle: textObj.fontStyle.includes('italic') ? 'italic' : 'normal',
        textAlign: textObj.align,
        lineHeight: 1.25,
        padding: 2 * scale,
        boxSizing: 'border-box',
        border: `1px solid ${EDITOR_SELECTION}`,
        borderRadius: 4,
        background: 'rgba(255,255,255,0.96)',
        resize: 'vertical',
        zIndex: 20,
      }}
      defaultValue={textObj.text}
      onBlur={() => {
        if (skipBlurCommit.current) {
          skipBlurCommit.current = false
          return
        }
        commit()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          skipBlurCommit.current = true
          dispatch({
            type: 'SET_TEXT_STYLE',
            id: textObj.id,
            patch: { text: snapshotRef.current },
          })
          onClose()
        }
      }}
    />
  )
}
