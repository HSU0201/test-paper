import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './App.tsx'
import { ensureZhuyin } from './editor/hanToZhuyin'
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
void Promise.race([loaded.catch(() => undefined), new Promise((resolve) => setTimeout(resolve, 2000))])
  .then(boot)
  // 畫面出來後再在背景載入注音詞庫
  .then(() => ensureZhuyin())
  .catch(() => undefined)
