import { useState, type FormEvent } from 'react'
import { ApiError } from '../../api/client'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { FormField } from '../../components/ui/FormField'
import { Input } from '../../components/ui/Input'
import { useResetPassword } from '../../hooks/useUsers'
import type { User } from '../../types/domain'

/**
 * v1 has no self-service recovery, so a manager doing this is the only way
 * somebody locked out gets back in.
 */
export function ResetPasswordDialog({ user, onClose }: { user: User; onClose: () => void }) {
  const resetPassword = useResetPassword()
  const [password, setPassword] = useState('')
  const [done, setDone] = useState(false)

  const error = resetPassword.error instanceof ApiError ? resetPassword.error : null

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    resetPassword.mutate({ id: user.id, password }, { onSuccess: () => setDone(true) })
  }

  if (done) {
    return (
      <div className="space-y-2 rounded-md border border-line bg-surface p-3">
        <p className="text-sm text-ink">
          Password reset for <span className="font-medium">{user.name}</span>.
        </p>
        {/* Shown once, here, because nothing emails it — there are no
            notifications in v1, so this screen is the only handover point. */}
        <p className="text-sm text-ink-muted">
          Give them this now; it is not shown again and nothing sends it for you:
        </p>
        <code className="block rounded border border-line bg-canvas px-2 py-1 font-mono text-sm text-ink">
          {password}
        </code>
        <Button size="sm" onClick={onClose}>
          Done
        </Button>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="space-y-2 rounded-md border border-line bg-surface p-3"
    >
      <p className="text-sm text-ink">
        Set a new password for <span className="font-medium">{user.name}</span>
      </p>

      {error && error.details.length === 0 ? <Alert>{error.message}</Alert> : null}

      <FormField
        label="New password"
        htmlFor={`reset-${user.id}`}
        error={error?.fieldError('password')}
        hint="At least 8 characters. They will need it to sign in."
      >
        <Input
          id={`reset-${user.id}`}
          type="text"
          value={password}
          autoFocus
          invalid={Boolean(error?.fieldError('password'))}
          onChange={(e) => setPassword(e.target.value)}
        />
      </FormField>

      <div className="flex gap-2">
        <Button type="submit" variant="primary" size="sm" loading={resetPassword.isPending}>
          Reset password
        </Button>
        <Button size="sm" onClick={onClose} disabled={resetPassword.isPending}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
