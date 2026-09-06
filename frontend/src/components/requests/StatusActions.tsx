import { useState } from 'react'
import { ApiError } from '../../api/client'
import { availableActions } from '../../lib/workflow'
import { RequestStatus, type SupportRequest, type User } from '../../types/domain'
import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'
import { Textarea } from '../ui/Textarea'

interface StatusActionsProps {
  request: SupportRequest
  viewer: User
  pending: boolean
  error: unknown
  onMove: (status: RequestStatus, note?: string) => void
}

/**
 * The only place a status changes. Buttons come from the workflow mirror, so a
 * move the API would refuse is never offered in the first place — the user
 * learns what they can do from the controls, not from a 422.
 */
export function StatusActions({ request, viewer, pending, error, onMove }: StatusActionsProps) {
  const actions = availableActions(request, viewer)
  const [pendingStatus, setPendingStatus] = useState<RequestStatus | null>(null)
  const [note, setNote] = useState('')

  if (actions.length === 0) {
    return (
      <p className="text-sm text-ink-subtle">
        {request.status === RequestStatus.CLOSED
          ? 'This request is closed. Nothing moves out of it.'
          : 'You have no actions on this request.'}
      </p>
    )
  }

  function start(status: RequestStatus) {
    setPendingStatus(status)
    setNote('')
  }

  function confirm() {
    if (!pendingStatus) return
    onMove(pendingStatus, note.trim() || undefined)
    setPendingStatus(null)
    setNote('')
  }

  const apiMessage = error instanceof ApiError ? error.message : null

  return (
    <div className="space-y-3">
      {apiMessage ? <Alert>{apiMessage}</Alert> : null}

      {pendingStatus ? (
        <div className="space-y-2">
          <Textarea
            rows={3}
            value={note}
            autoFocus
            onChange={(e) => setNote(e.target.value)}
            placeholder={
              pendingStatus === RequestStatus.WAITING
                ? 'What do you need from the requester?'
                : 'Add a note (optional)'
            }
          />
          <div className="flex gap-2">
            <Button variant="primary" size="sm" loading={pending} onClick={confirm}>
              {actions.find((a) => a.to === pendingStatus)?.label ?? 'Confirm'}
            </Button>
            <Button size="sm" onClick={() => setPendingStatus(null)} disabled={pending}>
              Cancel
            </Button>
          </div>
          {pendingStatus === RequestStatus.WAITING ? (
            <p className="text-xs text-ink-subtle">
              A request on hold without a reason is the ambiguity this tool exists to remove.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => (
            <Button
              key={action.to}
              size="sm"
              variant={action.isReopen ? 'danger' : 'secondary'}
              disabled={pending}
              onClick={() => start(action.to)}
            >
              {action.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}
