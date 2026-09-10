/**
 * Relative time, in the reader's language.
 *
 * Intl does the formatting rather than a hand-built string, because "2 hours
 * ago" has one shape in English and several in Arabic — which form applies
 * depends on the number, and getting it wrong is the kind of mistake that reads
 * as machine translation. `numeric: 'auto'` also gives "now" and "الآن" without
 * a special case.
 */
const UNITS: [unit: Intl.RelativeTimeFormatUnit, seconds: number][] = [
  ['year', 31_536_000],
  ['month', 2_592_000],
  ['day', 86_400],
  ['hour', 3600],
  ['minute', 60],
]

export function timeAgo(iso: string, locale: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'narrow' })

  for (const [unit, size] of UNITS) {
    const value = Math.floor(seconds / size)
    if (value >= 1) return format.format(-value, unit)
  }

  return format.format(0, 'second')
}

export function formatDateTime(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}
