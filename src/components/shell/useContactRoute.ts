import { useCallback, useEffect, useState } from 'react'

export function useContactRoute() {
  const [contactOpen, setContactOpen] = useState(() => window.location.hash === '#contact')

  useEffect(() => {
    const sync = () => setContactOpen(window.location.hash === '#contact')
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])

  const openContact = useCallback(() => {
    if (window.location.hash !== '#contact') window.location.hash = 'contact'
    else setContactOpen(true)
  }, [])

  const closeContact = useCallback(() => {
    if (window.location.hash === '#contact') {
      const next = `${window.location.pathname}${window.location.search}`
      window.history.replaceState(null, '', next)
    }
    setContactOpen(false)
  }, [])

  useEffect(() => {
    const prev = document.title
    if (contactOpen) document.title = '聯繫開發者 — 試卷編輯器'
    return () => {
      document.title = prev
    }
  }, [contactOpen])

  return { contactOpen, openContact, closeContact }
}
