/** "2h ago" — compact enough for a dense table column. */
export function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)

  if (seconds < 60) return 'just now'

  const units: [label: string, seconds: number][] = [
    ['y', 31_536_000],
    ['mo', 2_592_000],
    ['d', 86_400],
    ['h', 3600],
    ['m', 60],
  ]

  for (const [label, size] of units) {
    const value = Math.floor(seconds / size)
    if (value >= 1) return `${value}${label} ago`
  }

  return 'just now'
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}
