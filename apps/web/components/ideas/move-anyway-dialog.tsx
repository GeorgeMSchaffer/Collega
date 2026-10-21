'use client'

import { Label, Select, Textarea } from '@collega/design-system'
import { useEffect, useId, useState } from 'react'
import { ConfirmDialog } from '@/components/list'

/**
 * The Org Admin's override of the reference-lane lock (comp T screen 4, frames B and C; decided
 * 2026-10-16): a dialog whose confirm stays disabled until a reason is typed, so an empty reason can
 * never be sent and no error text is needed. The reason is audited by the API as
 * `IdeaMovedPastOpenTasks`; the tasks stay where they are.
 */
export function MoveAnywayDialog({
  open,
  title,
  body,
  confirmLabel,
  lanes,
  defaultLaneId,
  pending,
  onConfirm,
  onCancel,
}: {
  open: boolean
  /** "Move past 3 open tasks?" or "Remove from board anyway?" */
  title: string
  body: string
  /** "Move anyway" or "Remove anyway". */
  confirmLabel: string
  /** The lanes a move may go to, in board order, the card's own left out; absent for a removal. */
  lanes?: readonly { id: string; name: string }[] | undefined
  /** The lane the picker starts on: the next one, or the previous at the board's end. */
  defaultLaneId?: string | undefined
  pending: boolean
  onConfirm: (reason: string, laneId: string | null) => void
  onCancel: () => void
}) {
  const [reason, setReason] = useState('')
  const [laneId, setLaneId] = useState(defaultLaneId ?? '')
  const reasonId = useId()
  const laneSelectId = useId()

  useEffect(() => {
    if (open) {
      setReason('')
      setLaneId(defaultLaneId ?? '')
    }
  }, [open, defaultLaneId])

  return (
    <ConfirmDialog
      open={open}
      title={title}
      description={body}
      confirmLabel={confirmLabel}
      pending={pending}
      confirmDisabled={reason.trim() === ''}
      onConfirm={() => onConfirm(reason.trim(), lanes ? laneId : null)}
      onCancel={onCancel}
    >
      {lanes ? (
        <div className="mt-3 flex flex-col gap-1.5">
          <Label htmlFor={laneSelectId}>Move to</Label>
          <Select
            id={laneSelectId}
            value={laneId}
            onChange={(event) => setLaneId(event.target.value)}
          >
            {lanes.map((lane) => (
              <option key={lane.id} value={lane.id}>
                {lane.name}
              </option>
            ))}
          </Select>
        </div>
      ) : null}
      <div className="mt-3 flex flex-col gap-1.5">
        <Label htmlFor={reasonId}>Reason (required)</Label>
        <Textarea
          id={reasonId}
          rows={2}
          value={reason}
          required
          aria-required="true"
          placeholder="Why is this idea moving before its tasks are done?"
          onChange={(event) => setReason(event.target.value)}
        />
        <span className="text-xs text-muted-foreground">
          {confirmLabel} stays disabled until a reason is typed.
        </span>
      </div>
    </ConfirmDialog>
  )
}
