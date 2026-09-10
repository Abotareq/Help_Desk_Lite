import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-lg border border-line bg-surface', className)}>{children}</div>
  )
}

export function CardHeader({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center justify-between border-b border-line px-4 py-2.5', className)}>
      {children}
    </div>
  )
}

/**
 * `dir` is forwarded rather than fixed, because a card title is sometimes ours
 * and sometimes the user's. Their text has to declare its own direction or it
 * inherits the page's and reads with its punctuation on the wrong end.
 */
export function CardTitle({ children, dir }: { children: ReactNode; dir?: 'auto' | 'ltr' | 'rtl' }) {
  return (
    <h2 dir={dir} className="text-sm font-semibold text-ink">
      {children}
    </h2>
  )
}
