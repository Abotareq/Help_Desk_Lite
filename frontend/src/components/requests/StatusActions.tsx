import { useState } from 'react'
import { ApiError } from '../../api/client'
import type { StatusChange } from '../../api/requests'
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
  onMove: (change: StatusChange) => void
}

/**
 * Where the text typed alongside a move ends up.
 *
 * On a move to WAITING it becomes a comment. "Waiting" without saying what is
 * needed is exactly the ambiguity this tool exists to remove, and a comment is
 * addressed to the requester and can be answered in place, where a history note
 * is an annotation nobody can reply to. Every other move's text describes the
 * move itself, so it stays a note.
 */
function asStatusChange(status: RequestStatus, text: string): StatusChange {
  if (!text) return { status }

  return status === RequestStatus.WAITING
    ? { status, comment: { body: text } }
    : { status, note: text }
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
    onMove(asStatusChange(pendingStatus, note.trim()))
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
              This goes to the requester as a comment they can answer. A request on hold without a
              reason is the ambiguity this tool exists to remove.
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
