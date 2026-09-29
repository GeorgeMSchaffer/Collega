'use client'

import { Field, Select } from '@collega/design-system'
import { useEffect, useId, useRef, useState } from 'react'
import { ConfirmDialog } from '@/components/list'
import type { Status } from '@/lib/types'

/** A lane the save would remove that still holds ideas. */
export type RemovedLane = { id: string; name: string; ideaCount: number }

const ideas = (count: number) => (count === 1 ? '1 idea' : `${count} ideas`)

/**
 * The board form's confirm step for a save that removes lanes still holding ideas
 * (`SPEC/20-feature-boards-and-statuses.md` rule 14): the API refuses such a save unless each of
 * those lanes names a remaining lane for its ideas, so the form asks before it sends.
 *
 * It posts its own fields, as `moveFrom`/`moveTo` hidden pairs, one per removed lane with ideas,
 * each defaulting to the board's first remaining lane — the same way `SwimlanePicker` posts its
 * order, so neither form that renders the board fields has to know about moves.
 *
 * It listens for the submit on the form itself rather than taking an `onSubmit` from each caller:
 * the Settings page and the Boards drawer own different forms, and a `preventDefault` there is
 * what React reads to skip the form's action. The save goes through once the dialog is confirmed.
 */
export function IdeaMovesGuard({
  removed,
  remaining,
}: {
  removed: RemovedLane[]
  remaining: Status[]
}) {
  const [targets, setTargets] = useState<Record<string, string>>({})
  const [confirming, setConfirming] = useState(false)
  const anchor = useRef<HTMLInputElement>(null)
  const confirmed = useRef(false)
  // Set by the first "Move ideas and save" of an opening, so a second click cannot submit twice.
  const sent = useRef(false)
  const needsConfirm = useRef(false)
  needsConfirm.current = removed.length > 0
  const idPrefix = useId()

  // A lane chosen and then removed as well falls back to the default rather than posting a lane
  // the board no longer has.
  const targetFor = (laneId: string) => {
    const chosen = targets[laneId]
    return chosen !== undefined && remaining.some((status) => status.id === chosen)
      ? chosen
      : (remaining[0]?.id ?? '')
  }

  useEffect(() => {
    const form = anchor.current?.form
    if (!form) return
    const onSubmit = (event: SubmitEvent) => {
      if (confirmed.current) {
        confirmed.current = false
        return
      }
      if (!needsConfirm.current) return
      event.preventDefault()
      sent.current = false
      setConfirming(true)
    }
    form.addEventListener('submit', onSubmit)
    return () => form.removeEventListener('submit', onSubmit)
  }, [])

  const total = removed.reduce((sum, lane) => sum + lane.ideaCount, 0)
  const only = removed.length === 1 ? removed[0] : undefined

  return (
    <>
      {/* Unnamed, so it posts nothing: it is only the handle on the form. */}
      <input ref={anchor} type="hidden" />
      {removed.map((lane) => (
        <span key={lane.id} hidden>
          <input type="hidden" name="moveFrom" value={lane.id} />
          <input type="hidden" name="moveTo" value={targetFor(lane.id)} />
        </span>
      ))}
      <ConfirmDialog
        open={confirming && removed.length > 0}
        title={only ? `Move the ideas in ${only.name}?` : 'Move the ideas in the removed lanes?'}
        description={
          <>
            Removing {only ? 'this lane' : 'these lanes'} keeps {total === 1 ? 'its' : 'their'}{' '}
            {ideas(total)}. Choose the lane they move to; each move is recorded in the idea&rsquo;s
            history.
          </>
        }
        confirmLabel="Move ideas and save"
        destructive={false}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          if (sent.current) return
          sent.current = true
          confirmed.current = true
          setConfirming(false)
          anchor.current?.form?.requestSubmit()
        }}
      >
        <div className="mt-4 flex flex-col gap-1">
          {removed.map((lane) => (
            <Field
              key={lane.id}
              htmlFor={`${idPrefix}-${lane.id}`}
              label={`${ideas(lane.ideaCount)} ${lane.ideaCount === 1 ? 'is' : 'are'} in ${lane.name}. Move ${lane.ideaCount === 1 ? 'it' : 'them'} to:`}
            >
              <Select
                id={`${idPrefix}-${lane.id}`}
                value={targetFor(lane.id)}
                onChange={(event) => {
                  const value = event.target.value
                  setTargets((current) => ({ ...current, [lane.id]: value }))
                }}
              >
                {remaining.map((status) => (
                  <option key={status.id} value={status.id}>
                    {status.name}
                  </option>
                ))}
              </Select>
            </Field>
          ))}
        </div>
      </ConfirmDialog>
    </>
  )
}
