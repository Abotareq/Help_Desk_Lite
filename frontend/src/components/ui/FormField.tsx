import type { ReactNode } from 'react'

interface FormFieldProps {
  label: string
  htmlFor: string
  /** Message from the API's error.details, rendered against this input. */
  error?: string
  hint?: string
  children: ReactNode
}

export function FormField({ label, htmlFor, error, hint, children }: FormFieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-xs font-medium text-ink-muted">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-priority-high">{error}</p>
      ) : hint ? (
        <p className="text-xs text-ink-subtle">{hint}</p>
      ) : null}
    </div>
  )
}
