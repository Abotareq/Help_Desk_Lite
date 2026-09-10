import { createContext } from 'react'
import type { MessageKey } from './en'
import type { MessageVars } from './messages'

export type Language = 'en' | 'ar'
export type Direction = 'ltr' | 'rtl'

export const LANGUAGES: Language[] = ['en', 'ar']

/**
 * Arabic runs right to left. Translating the words while leaving the layout
 * running the other way is worse than not translating at all — it reads as a
 * broken page rather than as a foreign one.
 */
export const DIRECTION: Record<Language, Direction> = {
  en: 'ltr',
  ar: 'rtl',
}

/** BCP 47 tags for Intl. Not the same strings as our language codes by luck. */
export const LOCALE: Record<Language, string> = {
  en: 'en',
  ar: 'ar',
}

export interface I18nContextValue {
  language: Language
  direction: Direction
  locale: string
  setLanguage: (language: Language) => void
  t: (key: MessageKey, vars?: MessageVars) => string
}

export const I18nContext = createContext<I18nContextValue | null>(null)

export const LANGUAGE_KEY = 'helpdesk.language'

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as string[]).includes(value)
}
