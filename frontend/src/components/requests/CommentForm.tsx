import { useState } from 'react'
import { ApiError } from '../../api/client'
import { canWriteInternalNote } from '../../lib/workflow'
import type { SupportRequest, User } from '../../types/domain'
import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'
import { Textarea } from '../ui/Textarea'
import { useI18n } from '../../hooks/useI18n'

interface CommentFormProps {
  request: SupportRequest
  viewer: User
  pending: boolean
  error: unknown
  onPost: (body: string, isInternal: boolean) => void
}

/**
 * The composer. The internal-note option only appears for a handler of this
 * request, matching what the API will accept — the same rule as the status
 * buttons: never offer a control that would come back a 403.
 */
export function CommentForm({ request, viewer, pending, error, onPost }: CommentFormProps) {
  const { t } = useI18n()

  const [body, setBody] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const mayWriteInternal = canWriteInternalNote(request, viewer)

  const trimmed = body.trim()
  const apiMessage = error instanceof ApiError ? error.message : null

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!trimmed) return
    onPost(trimmed, isInternal && mayWriteInternal)
    setBody('')
    setIsInternal(false)
  }

  return (
    <form onSubmit={submit} className="space-y-2 border-t border-line px-4 py-3">
      {apiMessage ? <Alert>{apiMessage}</Alert> : null}

      <Textarea
        rows={3}
        value={body}
        aria-label={t('comment.add')}
        placeholder={
          isInternal
            ? t('comment.internalPlaceholder')
            : t('comment.placeholder')
        }
        onChange={(e) => setBody(e.target.value)}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        {mayWriteInternal ? (
          <label className="inline-flex items-center gap-2 text-sm text-ink-muted">
            <input
              type="checkbox"
              checked={isInternal}
              onChange={(e) => setIsInternal(e.target.checked)}
              className="size-4 rounded border-line-strong accent-priority-medium"
            />
            Internal note
          </label>
        ) : (
          <span />
        )}

        <Button type="submit" variant="primary" size="sm" loading={pending} disabled={!trimmed}>
          {isInternal ? t('comment.submitInternal') : t('comment.submit')}
        </Button>
      </div>
    </form>
  )
}
