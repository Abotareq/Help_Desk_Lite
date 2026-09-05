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

export function CardTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-sm font-semibold text-ink">{children}</h2>
}
