import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { FormField } from '../../components/ui/FormField'
import { Input } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'
import { Select } from '../../components/ui/Select'
import { Textarea } from '../../components/ui/Textarea'
import { useCreateRequest } from '../../hooks/useRequests'
import { RequestCategory, RequestPriority } from '../../types/domain'

const CATEGORY_LABELS: Record<RequestCategory, string> = {
  [RequestCategory.IT]: 'IT — laptops, software, accounts, network',
  [RequestCategory.HR]: 'HR — payroll, leave, benefits',
  [RequestCategory.FACILITIES]: 'Facilities — desks, building, equipment',
  [RequestCategory.OTHER]: 'Something else',
}

const PRIORITY_LABELS: Record<RequestPriority, string> = {
  [RequestPriority.LOW]: 'Low — whenever someone gets to it',
  [RequestPriority.MEDIUM]: 'Medium — normal',
  [RequestPriority.HIGH]: 'High — I am blocked',
}

/**
 * Short and guided, per the PRD: a fixed category list rather than free text,
 * and a priority that already has a sensible answer, so submitting stays the
 * one-minute job the brief asks for.
 */
export function NewRequestPage() {
  const navigate = useNavigate()
  const createRequest = useCreateRequest()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<RequestCategory | ''>('')
  const [priority, setPriority] = useState<RequestPriority>(RequestPriority.MEDIUM)

  const error = createRequest.error instanceof ApiError ? createRequest.error : null

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!category) return

    createRequest.mutate(
      { title, description, category, priority },
      { onSuccess: (created) => navigate(`/requests/${created.id}`) },
    )
  }

  return (
    <>
      <PageHeader title="New request" subtitle="Tell support what you need" />

      <div className="flex-1 overflow-auto bg-canvas">
        <form onSubmit={handleSubmit} noValidate className="mx-auto max-w-2xl p-6">
          <div className="space-y-4 rounded-lg border border-line bg-surface p-5">
            {/* A message with no field attached would otherwise vanish. */}
            {error && error.details.length === 0 ? <Alert>{error.message}</Alert> : null}

            <FormField
              label="What do you need?"
              htmlFor="title"
              error={error?.fieldError('title')}
              hint="A short summary — “Laptop will not boot”"
            >
              <Input
                id="title"
                value={title}
                autoFocus
                invalid={Boolean(error?.fieldError('title'))}
                onChange={(e) => setTitle(e.target.value)}
              />
            </FormField>

            <FormField
              label="Details"
              htmlFor="description"
              error={error?.fieldError('description')}
              hint="What happened, when it started, and anything you have already tried."
            >
              <Textarea
                id="description"
                rows={6}
                value={description}
                invalid={Boolean(error?.fieldError('description'))}
                onChange={(e) => setDescription(e.target.value)}
              />
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Category" htmlFor="category" error={error?.fieldError('category')}>
                <Select
                  id="category"
                  value={category}
                  invalid={Boolean(error?.fieldError('category'))}
                  onChange={(e) => setCategory(e.target.value as RequestCategory)}
                >
                  <option value="" disabled>
                    Choose one…
                  </option>
                  {Object.values(RequestCategory).map((value) => (
                    <option key={value} value={value}>
                      {CATEGORY_LABELS[value]}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Priority" htmlFor="priority" error={error?.fieldError('priority')}>
                <Select
                  id="priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as RequestPriority)}
                >
                  {Object.values(RequestPriority).map((value) => (
                    <option key={value} value={value}>
                      {PRIORITY_LABELS[value]}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Button
                type="submit"
                variant="primary"
                loading={createRequest.isPending}
                disabled={!category}
              >
                Submit request
              </Button>
              <Button onClick={() => navigate('/')} disabled={createRequest.isPending}>
                Cancel
              </Button>
            </div>
          </div>
        </form>
      </div>
    </>
  )
}
