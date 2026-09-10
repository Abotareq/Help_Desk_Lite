import { useI18n } from '../../hooks/useI18n'
import { LANGUAGES } from '../../i18n/i18nContext'
import { cn } from '../../lib/cn'

/**
 * Each language is written in itself — English, العربية — rather than in the
 * language currently on screen. Someone looking for Arabic is looking for the
 * Arabic word, and they may not read the one it would otherwise be labelled in.
 */
export function LanguageToggle() {
  const { language, setLanguage, t } = useI18n()

  return (
    <div
      role="radiogroup"
      aria-label={t('language.label')}
      className="flex rounded-md border border-line bg-surface p-0.5"
    >
      {LANGUAGES.map((option) => {
        const selected = language === option

        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setLanguage(option)}
            className={cn(
              'flex-1 rounded px-2 py-1 text-[11px] font-medium transition-colors',
              selected
                ? 'bg-brand-soft text-ink'
                : 'text-ink-subtle hover:bg-line/60 hover:text-ink-muted',
            )}
          >
            {t(option === 'en' ? 'language.en' : 'language.ar')}
          </button>
        )
      })}
    </div>
  )
}
