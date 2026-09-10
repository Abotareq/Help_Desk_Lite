import { useState, type FormEvent } from 'react'
import { ApiError } from '../../api/client'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { FormField } from '../../components/ui/FormField'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { useCreateUser } from '../../hooks/useUsers'
import { UserRole } from '../../types/domain'
import { useI18n } from '../../hooks/useI18n'
import type { MessageKey } from '../../i18n/en'

/**
 * Keys, not text: a map at module scope has no hook to call, and the sentence
 * explaining what a role actually does is exactly the part someone needs in
 * their own language.
 */
const ROLE_HINTS: Record<UserRole, MessageKey> = {
  [UserRole.EMPLOYEE]: 'people.roleEmployeeHint',
  [UserRole.AGENT]: 'people.roleAgentHint',
  [UserRole.MANAGER]: 'people.roleManagerHint',
}

/** v1 has no self sign-up, so this is the only way an account comes into being. */
export function NewUserForm({ onDone }: { onDone: () => void }) {
  const { t } = useI18n()

  const createUser = useCreateUser()

  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<UserRole>(UserRole.EMPLOYEE)
  const [password, setPassword] = useState('')

  const error = createUser.error instanceof ApiError ? createUser.error : null

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    createUser.mutate({ email, name, role, password }, { onSuccess: onDone })
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="max-w-3xl space-y-3">
      {error && error.details.length === 0 ? <Alert>{error.message}</Alert> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FormField label={t('people.name')} htmlFor="new-name" error={error?.fieldError('name')}>
          <Input
            id="new-name"
            value={name}
            autoFocus
            invalid={Boolean(error?.fieldError('name'))}
            onChange={(e) => setName(e.target.value)}
          />
        </FormField>

        <FormField label={t('people.email')} htmlFor="new-email" error={error?.fieldError('email')}>
          <Input
            id="new-email"
            type="email"
            value={email}
            invalid={Boolean(error?.fieldError('email'))}
            onChange={(e) => setEmail(e.target.value)}
          />
        </FormField>

        <FormField
          label={t('people.role')}
          htmlFor="new-role"
          error={error?.fieldError('role')}
          hint={t(ROLE_HINTS[role])}
        >
          <Select id="new-role" value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
            {Object.values(UserRole).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField
          label={t('people.tempPassword')}
          htmlFor="new-password"
          error={error?.fieldError('password')}
          hint={t('people.passwordHint')}
        >
          <Input
            id="new-password"
            type="text"
            value={password}
            invalid={Boolean(error?.fieldError('password'))}
            onChange={(e) => setPassword(e.target.value)}
          />
        </FormField>
      </div>

      <div className="flex gap-2">
        <Button type="submit" variant="primary" size="sm" loading={createUser.isPending}>
          {t('people.createAccount')}
        </Button>
        <Button size="sm" onClick={onDone} disabled={createUser.isPending}>
          {t('common.cancel')}
        </Button>
      </div>
    </form>
  )
}
