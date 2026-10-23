import { MotionConfig } from 'motion/react'
import { EditorApp } from './components/EditorApp'

function App() {
  return (
    <MotionConfig reducedMotion="user">
      <EditorApp />
    </MotionConfig>
  )
}

export default App
