import { useState, type FormEvent } from 'react'
import { ApiError } from '../../api/client'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { FormField } from '../../components/ui/FormField'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { useCreateUser } from '../../hooks/useUsers'
import { UserRole } from '../../types/domain'

const ROLE_HINTS: Record<UserRole, string> = {
  [UserRole.EMPLOYEE]: 'Submits requests and tracks their own',
  [UserRole.AGENT]: 'Support staff — claims, works and resolves requests',
  [UserRole.MANAGER]: 'Sees everything, assigns work, manages accounts',
}

/** v1 has no self sign-up, so this is the only way an account comes into being. */
export function NewUserForm({ onDone }: { onDone: () => void }) {
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
        <FormField label="Name" htmlFor="new-name" error={error?.fieldError('name')}>
          <Input
            id="new-name"
            value={name}
            autoFocus
            invalid={Boolean(error?.fieldError('name'))}
            onChange={(e) => setName(e.target.value)}
          />
        </FormField>

        <FormField label="Email" htmlFor="new-email" error={error?.fieldError('email')}>
          <Input
            id="new-email"
            type="email"
            value={email}
            invalid={Boolean(error?.fieldError('email'))}
            onChange={(e) => setEmail(e.target.value)}
          />
        </FormField>

        <FormField
          label="Role"
          htmlFor="new-role"
          error={error?.fieldError('role')}
          hint={ROLE_HINTS[role]}
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
          label="Temporary password"
          htmlFor="new-password"
          error={error?.fieldError('password')}
          hint="At least 8 characters"
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
          Create account
        </Button>
        <Button size="sm" onClick={onDone} disabled={createUser.isPending}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
