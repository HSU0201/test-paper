import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './App.tsx'
import { BOPOMOFO_FAMILY } from './fonts/paperFont'

import './index.css'
import './fonts/bopomofo.css'

const rootEl = document.getElementById('root')!
const boot = () => {
  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

const face = `16px "${BOPOMOFO_FAMILY}"`
const loaded = document.fonts?.load ? document.fonts.load(face).then(() => undefined) : Promise.resolve()
void Promise.race([loaded.catch(() => undefined), new Promise((resolve) => setTimeout(resolve, 2000))]).then(boot)
