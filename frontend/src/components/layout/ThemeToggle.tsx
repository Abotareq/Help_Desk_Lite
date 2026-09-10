import { useTheme } from '../../hooks/useTheme'
import { cn } from '../../lib/cn'
import { THEME_PREFERENCES, type ThemePreference } from '../../features/theme/themeContext'

const LABELS: Record<ThemePreference, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'Auto',
}

/**
 * Three states rather than a switch, because "follow the system" is a real
 * answer and a two-way toggle cannot express it: once you flip a switch you
 * have opted out of the OS setting forever without ever saying so.
 *
 * Rendered as radios, not buttons — one choice out of a set is what a radio
 * group is, and it gets arrow-key navigation and announces the current value
 * without any of that being written here.
 */
export function ThemeToggle() {
  const { preference, setPreference } = useTheme()

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className="flex rounded-md border border-line bg-surface p-0.5"
    >
      {THEME_PREFERENCES.map((option) => {
        const selected = preference === option

        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setPreference(option)}
            className={cn(
              'flex-1 rounded px-2 py-1 text-[11px] font-medium transition-colors',
              selected
                ? 'bg-brand-soft text-ink'
                : 'text-ink-subtle hover:bg-line/60 hover:text-ink-muted',
            )}
          >
            {LABELS[option]}
          </button>
        )
      })}
    </div>
  )
}
