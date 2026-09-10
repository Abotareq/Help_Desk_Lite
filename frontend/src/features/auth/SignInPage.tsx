import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { FormField } from '../../components/ui/FormField'
import { Input } from '../../components/ui/Input'
import { Spinner } from '../../components/ui/Spinner'
import { useAuth } from '../../hooks/useAuth'
import { useI18n } from '../../hooks/useI18n'

export function SignInPage() {
  const { t } = useI18n()

  const { user, initialising, signIn } = useAuth()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<ApiError | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (initialising) {
    return (
      <div className="flex h-full items-center justify-center text-ink-subtle">
        <Spinner size={20} />
      </div>
    )
  }

  if (user) {
    const from = (location.state as { from?: string } | null)?.from
    return <Navigate to={from ?? '/'} replace />
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      await signIn(email, password)
    } catch (err) {
      // The API's own message is more useful than a generic one: it
      // distinguishes a bad credential from a deactivated account.
      setError(err instanceof ApiError ? err : new ApiError(0, 'NETWORK', t('signIn.networkError')))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex h-full items-center justify-center bg-canvas p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex size-9 items-center justify-center rounded-lg bg-brand text-sm font-bold text-on-brand">
            H
          </div>
          <h1 className="text-base font-semibold text-ink">{t('app.name')}</h1>
          <p className="mt-0.5 text-sm text-ink-muted">{t('signIn.title')}</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-lg border border-line bg-surface p-5"
          noValidate
        >
          {error ? <Alert>{error.message}</Alert> : null}

          <FormField label={t('signIn.email')} htmlFor="email" error={error?.fieldError('email')}>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              autoFocus
              value={email}
              invalid={Boolean(error?.fieldError('email'))}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('signIn.emailPlaceholder')}
            />
          </FormField>

          <FormField label={t('signIn.password')} htmlFor="password" error={error?.fieldError('password')}>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              invalid={Boolean(error?.fieldError('password'))}
              onChange={(e) => setPassword(e.target.value)}
            />
          </FormField>

          <Button type="submit" variant="primary" loading={submitting} className="w-full">
            {t('signIn.submit')}
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-ink-subtle">
          {t('signIn.noSelfSignUp')}
        </p>
      </div>
    </div>
  )
}
