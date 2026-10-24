import { motion } from 'motion/react'

import { easeOut } from '../motion/presets'
import { Icon } from './ui'

const DEVELOPER_NAME = '徐生'
const DEVELOPER_EMAIL = 'sylvapulse@gmail.com'

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
            <img src="/favicon.png" alt="" />
          </motion.div>
          <p className="contact__kicker">開發者</p>
          <p className="contact__name">{DEVELOPER_NAME}</p>
          <a className="contact__mail" href={`mailto:${DEVELOPER_EMAIL}`}>
            <span className="contact__mail-label">信箱</span>
            {DEVELOPER_EMAIL}
          </a>
          <p className="contact__note">試卷格式、注音或匯出有問題，直接寫信就好。</p>
        </article>
      </div>
    </motion.div>
  )
}
