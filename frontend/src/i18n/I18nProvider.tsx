import React, { useCallback, useEffect, useState } from 'react'
import { messages, type Lang, type MessageKey } from './messages'
import { I18nContext } from './i18nContextValue'

const STORAGE_KEY = 'smsim.lang'

function readInitialLang(): Lang {
  if (typeof window === 'undefined') return 'ja'
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'ja'
  } catch {
    return 'ja'
  }
}

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Lang>(readInitialLang)

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, lang)
    } catch {
      // ignore persistence errors (e.g. storage disabled)
    }
  }, [lang])

  const setLang = useCallback((next: Lang) => setLangState(next), [])
  const toggle = useCallback(() => setLangState(prev => (prev === 'ja' ? 'en' : 'ja')), [])
  const t = useCallback(
    (key: MessageKey) => messages[lang][key] ?? messages.ja[key] ?? key,
    [lang],
  )

  return (
    <I18nContext.Provider value={{ lang, setLang, toggle, t }}>
      {children}
    </I18nContext.Provider>
  )
}
