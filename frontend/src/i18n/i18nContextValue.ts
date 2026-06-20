import { createContext } from 'react'
import type { Lang, MessageKey } from './messages'

export interface I18nContextType {
  lang: Lang
  setLang: (lang: Lang) => void
  toggle: () => void
  t: (key: MessageKey) => string
}

export const I18nContext = createContext<I18nContextType | undefined>(undefined)
