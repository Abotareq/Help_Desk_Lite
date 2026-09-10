import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ar } from './ar'
import { en, type Catalogue, type MessageKey } from './en'
import { isPlural, type MessageVars } from './messages'
import {
  DIRECTION,
  I18nContext,
  LANGUAGE_KEY,
  LOCALE,
  isLanguage,
  type Language,
} from './i18nContext'

const CATALOGUES: Record<Language, Catalogue> = { en, ar }

function readStoredLanguage(): Language {
  try {
    const stored = localStorage.getItem(LANGUAGE_KEY)
    if (isLanguage(stored)) return stored
  } catch {
    /* Blocked storage is not worth failing over. */
  }

  // Nobody has chosen, so take the browser's word for it. An Arabic-speaking
  // employee should not have to find a setting before the tool speaks to them.
  const preferred = typeof navigator !== 'undefined' ? navigator.language : 'en'
  return preferred.startsWith('ar') ? 'ar' : 'en'
}

function interpolate(template: string, vars: MessageVars, locale: string): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = vars[name]
    if (value === undefined) return whole
    // Numbers go through Intl so grouping and digits follow the locale rather
    // than the machine's. Generic `ar` resolves to Latin digits in CLDR, which
    // is what we want here: reference numbers like HD-000004 are Latin
    // everywhere in this UI, and ٣ beside them would be the odd one out. A
    // region tag (ar-EG, ar-SA) would switch to Arabic-Indic if that is ever
    // wanted.
    return typeof value === 'number' ? new Intl.NumberFormat(locale).format(value) : value
  })
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(readStoredLanguage)

  const direction = DIRECTION[language]
  const locale = LOCALE[language]

  // On the documentElement, so it also covers the sign-in page, which renders
  // outside the app layout, and so CSS logical properties resolve correctly.
  useEffect(() => {
    document.documentElement.lang = language
    document.documentElement.dir = direction
  }, [language, direction])

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next)
    try {
      localStorage.setItem(LANGUAGE_KEY, next)
    } catch {
      /* The choice still applies for this session. */
    }
  }, [])

  const t = useCallback(
    (key: MessageKey, vars: MessageVars = {}) => {
      const message = CATALOGUES[language][key]

      if (!isPlural(message)) return interpolate(message, vars, locale)

      // Which plural form applies is the language's business, not ours: English
      // needs two, Arabic up to six. Intl knows the rules for both.
      const count = typeof vars.count === 'number' ? vars.count : 0
      const rule = new Intl.PluralRules(locale).select(count)
      const template = message[rule] ?? message.other

      return interpolate(template, vars, locale)
    },
    [language, locale],
  )

  const value = useMemo(
    () => ({ language, direction, locale, setLanguage, t }),
    [language, direction, locale, setLanguage, t],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
