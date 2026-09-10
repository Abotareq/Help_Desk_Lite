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
import { useI18n } from '../../hooks/useI18n'
import type { MessageKey } from '../../i18n/en'

/**
 * The descriptive half of each option. Keys rather than text: these are the
 * words that tell someone which category they are actually in, so they are
 * exactly what has to be readable in the reader's own language.
 */
const CATEGORY_HINTS: Record<RequestCategory, MessageKey> = {
  [RequestCategory.IT]: 'newRequest.catIT',
  [RequestCategory.HR]: 'newRequest.catHR',
  [RequestCategory.FACILITIES]: 'newRequest.catFACILITIES',
  [RequestCategory.OTHER]: 'newRequest.catOTHER',
}

const PRIORITY_HINTS: Record<RequestPriority, MessageKey> = {
  [RequestPriority.LOW]: 'newRequest.priLOW',
  [RequestPriority.MEDIUM]: 'newRequest.priMEDIUM',
  [RequestPriority.HIGH]: 'newRequest.priHIGH',
}

/**
 * Short and guided, per the PRD: a fixed category list rather than free text,
 * and a priority that already has a sensible answer, so submitting stays the
 * one-minute job the brief asks for.
 */
export function NewRequestPage() {
  const { t } = useI18n()

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
      <PageHeader title={t('newRequest.title')} subtitle={t('newRequest.subtitle')} />

      <div className="flex-1 overflow-auto bg-canvas">
        <form onSubmit={handleSubmit} noValidate className="mx-auto max-w-2xl p-3 sm:p-6">
          <div className="space-y-4 rounded-lg border border-line bg-surface p-5">
            {/* A message with no field attached would otherwise vanish. */}
            {error && error.details.length === 0 ? <Alert>{error.message}</Alert> : null}

            <FormField
              label={t('newRequest.what')}
              htmlFor="title"
              error={error?.fieldError('title')}
              hint={t('newRequest.titleHint')}
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
              label={t('newRequest.details')}
              htmlFor="description"
              error={error?.fieldError('description')}
              hint={t('newRequest.detailsHint')}
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
              <FormField label={t('detail.category')} htmlFor="category" error={error?.fieldError('category')}>
                <Select
                  id="category"
                  value={category}
                  invalid={Boolean(error?.fieldError('category'))}
                  onChange={(e) => setCategory(e.target.value as RequestCategory)}
                >
                  <option value="" disabled>
                    {t('newRequest.chooseCategory')}
                  </option>
                  {Object.values(RequestCategory).map((value) => (
                    <option key={value} value={value}>
                      {t(CATEGORY_HINTS[value])}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField label={t('detail.priority')} htmlFor="priority" error={error?.fieldError('priority')}>
                <Select
                  id="priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as RequestPriority)}
                >
                  {Object.values(RequestPriority).map((value) => (
                    <option key={value} value={value}>
                      {t(PRIORITY_HINTS[value])}
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
                {t('newRequest.submit')}
              </Button>
              <Button onClick={() => navigate('/')} disabled={createRequest.isPending}>
                {t('common.cancel')}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </>
  )
}
