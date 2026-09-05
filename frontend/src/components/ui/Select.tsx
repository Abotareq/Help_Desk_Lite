import type { SelectHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean
}

export function Select({ invalid, className, children, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        'h-8 w-full rounded-md border bg-surface px-2 text-sm text-ink',
        invalid ? 'border-priority-high' : 'border-line-strong',
        className,
      )}
      aria-invalid={invalid || undefined}
      {...props}
    >
      {children}
    </select>
  )
}
