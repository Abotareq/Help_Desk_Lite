import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

type Tone = 'error' | 'warning' | 'info'

const TONES: Record<Tone, string> = {
  error: 'border-red-200 bg-red-50 text-red-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  info: 'border-line bg-canvas text-ink-muted',
}

export function Alert({
  tone = 'error',
  children,
  className,
}: {
  tone?: Tone
  children: ReactNode
  className?: string
}) {
  return (
    <div
      role={tone === 'error' ? 'alert' : undefined}
      className={cn('rounded-md border px-3 py-2 text-sm', TONES[tone], className)}
    >
      {children}
    </div>
  )
}
