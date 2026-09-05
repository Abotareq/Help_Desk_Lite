import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

/** Neutral chip for categories, roles and counts. */
export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded border border-line bg-canvas px-1.5 py-0.5',
        'text-xs font-medium text-ink-muted',
        className,
      )}
    >
      {children}
    </span>
  )
}
