import { MotionConfig } from 'motion/react'

import { EditorApp } from './components/EditorApp'

export function App() {
  return (
    <MotionConfig reducedMotion="user">
      <EditorApp />
    </MotionConfig>
  )
}
