import { useState } from 'react'

import { motion } from 'motion/react'

import { easeOut } from '../motion/presets'
import { Icon } from './ui'

const DEVELOPER_NAME = '徐生'
const DEVELOPER_EMAIL = 'sylvapulse@gmail.com'
const APP_URL = 'https://hsu0201.github.io/TestPaper/'
const REPO_URL = 'https://github.com/HSU0201/TestPaper'
const SHARE_TEXT = '推薦一個免費的線上出考卷工具：注音、分欄、配圖都能排，直接匯出 PDF，免安裝。'

function ShareActions() {
  const [copied, setCopied] = useState(false)

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: '試卷編輯器', text: SHARE_TEXT, url: APP_URL })
        return
      } catch (err) {
        if ((err as DOMException).name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(`${SHARE_TEXT}\n${APP_URL}`)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('複製以下連結分享給同事：', APP_URL)
    }
  }

  return (
    <div className="contact__share">
      <p className="contact__share-title">覺得好用？分享給同事吧</p>
      <div className="contact__share-actions">
        <button type="button" className="btn btn--primary" onClick={share}>
          {copied ? '已複製連結' : '分享給同事'}
        </button>
        <a
          className="btn btn--ghost"
          href={`https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(APP_URL)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          LINE 分享
        </a>
        <a className="btn btn--ghost" href={REPO_URL} target="_blank" rel="noopener noreferrer">
          GitHub 給顆星
        </a>
      </div>
    </div>
  )
}

export function ContactPage({ onBack }: { onBack: () => void }) {
  return (
    <motion.div
      className="contact"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.28, ease: easeOut }}
    >
      <header className="contact__bar">
        <button type="button" className="btn btn--ghost" onClick={onBack}>
          <Icon name="undo" />
          返回編輯器
        </button>
        <h1 className="contact__bar-title">聯繫開發者</h1>
      </header>
      <div className="contact__body">
        <article className="contact__card">
          <motion.div
            className="contact__avatar"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: easeOut, delay: 0.05 }}
          >
            <img src={`${import.meta.env.BASE_URL}favicon.png`} alt="" />
          </motion.div>
          <p className="contact__kicker">開發者</p>
          <p className="contact__name">{DEVELOPER_NAME}</p>
          <a className="contact__mail" href={`mailto:${DEVELOPER_EMAIL}`}>
            <span className="contact__mail-label">信箱</span>
            {DEVELOPER_EMAIL}
          </a>
          <p className="contact__note">試卷格式、注音或匯出有問題，直接寫信就好。</p>
          <ShareActions />
        </article>
      </div>
    </motion.div>
  )
}
