import type { InputHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
}

export function Input({ invalid, className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        'h-8 w-full rounded-md border bg-surface px-2.5 text-sm text-ink',
        'placeholder:text-ink-subtle disabled:bg-canvas disabled:text-ink-muted',
        invalid ? 'border-priority-high' : 'border-line-strong',
        className,
      )}
      aria-invalid={invalid || undefined}
      {...props}
    />
  )
}
