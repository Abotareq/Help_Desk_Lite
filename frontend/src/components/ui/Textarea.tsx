import type { TextareaHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean
}

export function Textarea({ invalid, className, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        'w-full rounded-md border bg-surface px-2.5 py-2 text-sm text-ink',
        'placeholder:text-ink-subtle disabled:bg-canvas',
        invalid ? 'border-priority-high' : 'border-line-strong',
        className,
      )}
      aria-invalid={invalid || undefined}
      {...props}
    />
  )
}
