import { useEffect } from 'react'

import { useEditor } from '../../editor/EditorContext'

function isTypingTarget(target: EventTarget | null) {
  const el =
    target instanceof HTMLElement
      ? target
      : document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
  if (!el) return false
  const tag = el.tagName
  if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT') return true
  return el.isContentEditable || !!el.closest('[contenteditable="true"]')
}

export function useEditorHotkeys(contactOpen: boolean, closeContact: () => void) {
  const { state, dispatch, undo, redo } = useEditor()

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (contactOpen) {
        if (event.key === 'Escape') closeContact()
        return
      }
      if (isTypingTarget(event.target) || isTypingTarget(document.activeElement)) return
      const mod = event.ctrlKey || event.metaKey
      if (mod && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
        return
      }
      if (mod && event.key.toLowerCase() === 'y') {
        event.preventDefault()
        redo()
        return
      }
      if (event.key === 'Escape') {
        if (state.textPlacementMode) dispatch({ type: 'CANCEL_TEXT_PLACEMENT' })
        else if (state.selectedId) dispatch({ type: 'SELECT', id: null })
        else if (state.selectedBlock) dispatch({ type: 'SELECT_BLOCK', ref: null })
        return
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && (state.selectedId || state.selectedBlock)) {
        event.preventDefault()
        dispatch({ type: 'DELETE_SELECTED' })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [contactOpen, closeContact, dispatch, undo, redo, state.selectedId, state.selectedBlock, state.textPlacementMode])
}
