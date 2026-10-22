'use client'

import { Button, Dot, RefPill, Select, Switch } from '@collega/design-system'
import { useState } from 'react'
// Not through `@/lib/data`: that barrel re-exports the API-backed readers, so pulling a constant
// through it drags `next/headers` into the client graph and fails the build.
import { SWIMLANE_FLOOR } from '@/lib/limits'
import type { LaneFlags, ReferenceContext, Status } from '@/lib/types'

export const NO_FLAGS: LaneFlags = {
  isFinal: false,
  referencesBoardId: null,
  autoCreateTask: false,
}

export function flagsOf(flags: Readonly<Record<string, LaneFlags>>, id: string): LaneFlags {
  return flags[id] ?? NO_FLAGS
}

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many)

/**
 * Which statuses become a board's columns, in what order, and how each lane behaves: its Kind
 * (Normal or Final) and the board it may reference (comp U screen 1, comp T screen 5).
 *
 * Interactive rather than a static list because the order *is* the setting — a picker that cannot
 * reorder would leave the one thing that distinguishes two boards unexpressible.
 *
 * It posts its own state, as one hidden input per selected status in list order. `FormData.getAll`
 * preserves document order, so the arrangement on screen *is* the submitted order and there is no
 * second copy of it for the form to keep in sync. The inputs are rendered from `ids` rather than
 * from `lanes`, so a lane whose status the caller did not supply is still submitted rather than
 * quietly dropped from the board on save. The lane flags are posted by the form that owns them.
 *
 * The organization's statuses arrive as a prop because this component cannot await: the route that
 * renders it reads them and hands them down. The selection is its caller's state, because the board
 * form also needs to know which of the board's lanes a save would remove.
 *
 * Every refused control is `aria-disabled` and stays focusable, never `disabled`: a `disabled`
 * button leaves the tab order and takes the `aria-describedby` reason with it, so the reader who
 * most needs to know why it is refused is the one who cannot reach it. The one exception is the
 * References select, which has no `aria-disabled` behaviour a native control honours; its reason is
 * always visible text beside it instead.
 *
 * `readOnly` is what a User or Read Only account sees: the same lanes as values, no grips, no
 * Remove, no Add, no inputs.
 */
export function SwimlanePicker({
  ids,
  onChange,
  statuses,
  flags = {},
  onFlags,
  references,
  boardId = null,
  boardName = '',
  laneIdeaCounts = {},
  laneErrors = {},
  readOnly = false,
}: {
  ids: string[]
  onChange: (update: (current: string[]) => string[]) => void
  statuses: Status[]
  /** Each lane's Board References flags, by status id; a lane without an entry has the defaults. */
  flags?: Readonly<Record<string, LaneFlags>>
  onFlags?: (statusId: string, patch: Partial<LaneFlags>) => void
  /** The boards a lane may name, and whether this board is itself a target. */
  references?: ReferenceContext | undefined
  /** The board being edited; null on create. */
  boardId?: string | null
  boardName?: string
  /** Live ideas per lane as loaded. A lane with ideas cannot have its reference changed. */
  laneIdeaCounts?: Readonly<Record<string, number>>
  /** A refused save's per-lane messages. */
  laneErrors?: Readonly<Record<string, string>> | undefined
  readOnly?: boolean
}) {
  const setIds = onChange
  // The references as loaded, so a lane that references a board today keeps its Remove disabled
  // while ideas sit in it however the form is edited meanwhile.
  const [loaded] = useState(flags)
  // Lanes whose switch was just turned off by removing their reference: the inline note stays until
  // a reference is put back.
  const [autoOff, setAutoOff] = useState<ReadonlySet<string>>(new Set())

  const lanes = ids.flatMap((id) => {
    const status = statuses.find((candidate) => candidate.id === id)
    return status ? [status] : []
  })
  const available = statuses.filter((status) => !ids.includes(status.id))
  const atFloor = ids.length <= SWIMLANE_FLOOR
  const choices = references?.choices ?? []
  const referencedBy = references?.referencedBy ?? []
  const isTarget = referencedBy.length > 0

  function move(index: number, delta: number) {
    setIds((current) => {
      const next = [...current]
      const [moved] = next.splice(index, 1)
      if (moved === undefined) return current
      next.splice(index + delta, 0, moved)
      return next
    })
  }

  function setReference(statusId: string, referencesBoardId: string | null) {
    const was = flagsOf(flags, statusId)
    if (referencesBoardId === null) {
      onFlags?.(statusId, { referencesBoardId: null, autoCreateTask: false })
      if (was.autoCreateTask) setAutoOff((current) => new Set(current).add(statusId))
    } else {
      // A reference lane auto-creates by default (2026-10-22); switching between boards keeps the
      // person's choice.
      onFlags?.(statusId, {
        referencesBoardId,
        ...(was.referencesBoardId === null ? { autoCreateTask: true } : {}),
      })
      setAutoOff((current) => {
        const next = new Set(current)
        next.delete(statusId)
        return next
      })
    }
  }

  const laneList = (
    <ul className="m-0 list-none rounded-md border p-0">
      {lanes.map((status, index) => {
        const first = index === 0
        const last = index === lanes.length - 1
        const lane = flagsOf(flags, status.id)
        const target = choices.find((choice) => choice.id === lane.referencesBoardId)
        const referencing = lane.referencesBoardId !== null
        const ideas = laneIdeaCounts[status.id] ?? 0
        const wasReferencing = flagsOf(loaded, status.id).referencesBoardId !== null
        const error = laneErrors[status.id]

        // Why the References select is refused, in the order the rules apply. The ideas rule is
        // comp T's decided sentence; a Final lane is comp U's 2026-10-19 answer.
        const selectWhy = readOnly
          ? null
          : ideas > 0
            ? `${ideas} ${plural(ideas, 'idea currently sits', 'ideas currently sit')} in ${status.name}, so ${
                wasReferencing ? 'this reference' : 'a reference'
              } can’t be ${wasReferencing ? 'changed to another board' : 'added'} while ${plural(ideas, 'it does', 'they do')}.`
            : lane.isFinal
              ? 'A Final lane can’t reference a board.'
              : null
        const removeWhy =
          wasReferencing && ideas > 0
            ? `${ideas} ${plural(ideas, 'idea sits', 'ideas sit')} in this lane`
            : null
        const finalWhy = referencing
          ? 'Remove the board reference first: a Final lane can’t reference a board.'
          : null

        return (
          <li key={status.id} className="border-b text-sm last:border-0">
            <div className="flex items-center gap-2 px-3 py-2">
              <Dot color={status.color} />
              <span className="min-w-0 truncate font-medium">{status.name}</span>
              {referencing ? <RefPill>{target?.keyPrefix ?? 'board reference'}</RefPill> : null}
              <span className="flex-1" />
              {readOnly ? (
                <span className="text-xs text-muted-foreground">
                  {lane.isFinal ? 'Final' : 'Normal'}
                </span>
              ) : (
                <>
                  {first ? (
                    <span id={`swimlane-first-${status.id}`} className="sr-only">
                      Already first in the order.
                    </span>
                  ) : null}
                  {last ? (
                    <span id={`swimlane-last-${status.id}`} className="sr-only">
                      Already last in the order.
                    </span>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="px-2"
                    aria-label={`Move ${status.name} earlier`}
                    aria-disabled={first ? 'true' : undefined}
                    aria-describedby={first ? `swimlane-first-${status.id}` : undefined}
                    onClick={() => {
                      // aria-disabled is advisory - the click still arrives, so the guard lives here.
                      if (first) return
                      move(index, -1)
                    }}
                  >
                    <span aria-hidden="true">&uarr;</span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="px-2"
                    aria-label={`Move ${status.name} later`}
                    aria-disabled={last ? 'true' : undefined}
                    aria-describedby={last ? `swimlane-last-${status.id}` : undefined}
                    onClick={() => {
                      if (last) return
                      move(index, 1)
                    }}
                  >
                    <span aria-hidden="true">&darr;</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={`Remove ${status.name} from this board`}
                    aria-disabled={atFloor || removeWhy ? 'true' : undefined}
                    aria-describedby={
                      removeWhy
                        ? `swimlane-remove-${status.id}`
                        : atFloor
                          ? 'swimlane-floor'
                          : undefined
                    }
                    title={removeWhy ?? undefined}
                    onClick={() => {
                      if (atFloor || removeWhy) return
                      setIds((current) => current.filter((id) => id !== status.id))
                    }}
                  >
                    Remove
                  </Button>
                  {removeWhy ? (
                    <span id={`swimlane-remove-${status.id}`} className="sr-only">
                      {removeWhy}
                    </span>
                  ) : null}
                </>
              )}
            </div>

            {readOnly ? (
              referencing ? (
                <p className="m-0 px-3 pb-2 text-xs text-muted-foreground">
                  References {target?.name ?? 'another board'}
                  {lane.autoCreateTask ? '. Auto-creates one task on entry.' : '.'}
                </p>
              ) : null
            ) : (
              <div className="flex flex-wrap items-start gap-x-4 gap-y-2 px-3 pb-2">
                <div>
                  <fieldset
                    aria-label={`Kind of ${status.name}`}
                    className="m-0 inline-flex overflow-hidden rounded-md border p-0"
                  >
                    {(['Normal', 'Final'] as const).map((kind) => {
                      const final = kind === 'Final'
                      const checked = lane.isFinal === final
                      const refused = final && finalWhy !== null
                      return (
                        <label
                          key={kind}
                          className={`px-2.5 py-1 text-xs has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring ${
                            checked
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-transparent text-muted-foreground'
                          } ${refused ? 'cursor-not-allowed opacity-55' : 'cursor-pointer'}`}
                        >
                          <input
                            type="radio"
                            className="sr-only"
                            name={`kind-${status.id}`}
                            value={kind}
                            checked={checked}
                            disabled={refused}
                            aria-describedby={refused ? `swimlane-final-${status.id}` : undefined}
                            onChange={() => onFlags?.(status.id, { isFinal: final })}
                          />
                          {kind}
                        </label>
                      )
                    })}
                  </fieldset>
                  {finalWhy ? (
                    <span
                      id={`swimlane-final-${status.id}`}
                      className="mt-1 block text-xs text-muted-foreground"
                    >
                      {finalWhy}
                    </span>
                  ) : null}
                </div>

                <div className="min-w-48 flex-1">
                  <label
                    htmlFor={`swimlane-select-${status.id}`}
                    className="mb-1 block text-xs text-muted-foreground"
                  >
                    References board
                  </label>
                  <Select
                    id={`swimlane-select-${status.id}`}
                    aria-label={`References board for ${status.name}`}
                    value={lane.referencesBoardId ?? ''}
                    disabled={selectWhy !== null || isTarget}
                    aria-describedby={selectWhy ? `swimlane-select-why-${status.id}` : undefined}
                    onChange={(event) => setReference(status.id, event.target.value || null)}
                  >
                    <option value="">None</option>
                    {referencing && !target ? (
                      <option value={lane.referencesBoardId ?? ''}>
                        A board that is no longer available
                      </option>
                    ) : null}
                    {boardId !== null ? (
                      <option value={boardId} disabled>
                        {boardName || 'This board'} (this board): a lane can’t reference its own
                        board.
                      </option>
                    ) : null}
                    {choices.map((choice) => (
                      <option key={choice.id} value={choice.id} disabled={choice.hasReferenceLane}>
                        {choice.name}
                        {choice.hasReferenceLane
                          ? ': it has a reference lane of its own, and only one level of references is allowed.'
                          : ''}
                      </option>
                    ))}
                  </Select>
                  {selectWhy ? (
                    <span
                      id={`swimlane-select-why-${status.id}`}
                      className="mt-1 block text-xs text-warning"
                    >
                      {selectWhy}
                    </span>
                  ) : null}
                </div>
              </div>
            )}

            {!readOnly && referencing ? (
              <div className="flex flex-col gap-1 px-3 pb-3">
                <Switch
                  checked={lane.autoCreateTask}
                  onCheckedChange={(checked) => onFlags?.(status.id, { autoCreateTask: checked })}
                  aria-describedby={`swimlane-auto-${status.id}`}
                >
                  Auto-create one task on entry
                </Switch>
                <span
                  id={`swimlane-auto-${status.id}`}
                  className="flex flex-col gap-1 text-xs text-muted-foreground"
                >
                  <span>
                    A card entering this lane gets one task named after it, in the first lane of{' '}
                    <b>{target?.name ?? 'the referenced board'}</b>
                    {target?.firstLaneName ? ` (${target.firstLaneName})` : ''}. The card then waits
                    on it.
                  </span>
                  <span>Cards already in this lane are not changed.</span>
                </span>
              </div>
            ) : null}
            {!readOnly && !referencing && autoOff.has(status.id) ? (
              <p role="status" className="m-0 px-3 pb-3 text-xs text-muted-foreground">
                Auto-create turned off &mdash; it needs a referenced board.
              </p>
            ) : null}
            {error ? (
              <p role="alert" className="m-0 px-3 pb-3 text-xs font-semibold text-destructive">
                {error}
              </p>
            ) : null}
          </li>
        )
      })}
    </ul>
  )

  const targetNote =
    !readOnly && isTarget ? (
      <p className="m-0 mb-2 text-xs text-warning">
        {boardName || 'This board'} is the target of a reference lane on{' '}
        {referencedBy.map((board) => board.name).join(', ')}, so none of its lanes can reference
        another board.
      </p>
    ) : null

  if (readOnly) {
    return laneList
  }

  return (
    // Sized by its container rather than the viewport, so it stacks inside the Boards drawer.
    <div className="@container">
      {ids.map((id) => (
        <input key={id} type="hidden" name="swimlaneIds" value={id} />
      ))}
      <div className="grid grid-cols-1 gap-4 @xl:grid-cols-[1.3fr_1fr]">
        <div>
          <h3 className="m-0 mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            On this board &mdash; in order
          </h3>
          {targetNote}
          {laneList}
          {atFloor ? (
            <p id="swimlane-floor" className="m-0 mt-2 text-xs italic text-muted-foreground">
              A board needs at least two swimlanes, so the last two cannot be removed. Add a third
              to free them.
            </p>
          ) : null}
        </div>

        <div>
          <h3 className="m-0 mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Available statuses
          </h3>
          <ul className="m-0 list-none rounded-md border p-0">
            {available.map((status) => (
              <li
                key={status.id}
                className="flex items-center gap-2 border-b px-3 py-2 text-sm last:border-0"
              >
                <Dot color={status.color} />
                <span className="min-w-0 flex-1 truncate">{status.name}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label={`Add ${status.name} to this board`}
                  onClick={() => setIds((current) => [...current, status.id])}
                >
                  Add
                </Button>
              </li>
            ))}
            {available.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">
                Every status is already a swimlane on this board.
              </li>
            ) : null}
          </ul>
        </div>
      </div>
    </div>
  )
}
