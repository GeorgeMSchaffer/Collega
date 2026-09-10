'use client'

import { Button, Dot } from '@collega/design-system'
import { useState } from 'react'
// Not through `@/lib/data`: that barrel re-exports the API-backed readers, so pulling these two
// constants through it drags `next/headers` into the client graph and fails the build.
import { SWIMLANE_FLOOR } from '@/lib/mock'
import type { Status } from '@/lib/types'

/**
 * Which statuses become a board's columns, and in what order.
 *
 * Interactive rather than a static list because the order *is* the setting — a picker that cannot
 * reorder would leave the one thing that distinguishes two boards unexpressible. Nothing here is
 * saved; the state is local until Wave D gives the form an endpoint.
 *
 * The organization's statuses arrive as a prop because this component cannot await: the route that
 * renders it reads them and hands them down.
 *
 * Every refused control is `aria-disabled` and stays focusable, never `disabled`: a `disabled`
 * button leaves the tab order and takes the `aria-describedby` reason with it, so the reader who
 * most needs to know why it is refused is the one who cannot reach it.
 */
export function SwimlanePicker({ selected, statuses }: { selected: string[]; statuses: Status[] }) {
  const [ids, setIds] = useState(selected)

  const lanes = ids.flatMap((id) => {
    const status = statuses.find((candidate) => candidate.id === id)
    return status ? [status] : []
  })
  const available = statuses.filter((status) => !ids.includes(status.id))
  const atFloor = ids.length <= SWIMLANE_FLOOR

  function move(index: number, delta: number) {
    setIds((current) => {
      const next = [...current]
      const [moved] = next.splice(index, 1)
      if (moved === undefined) return current
      next.splice(index + delta, 0, moved)
      return next
    })
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_1fr]">
      <div>
        <h3 className="m-0 mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          On this board &mdash; in order
        </h3>
        <ul className="m-0 list-none rounded-md border p-0">
          {lanes.map((status, index) => {
            const first = index === 0
            const last = index === lanes.length - 1
            return (
              <li
                key={status.id}
                className="flex items-center gap-2 border-b px-3 py-2 text-sm last:border-0"
              >
                <Dot color={status.color} />
                <span className="min-w-0 flex-1 truncate">{status.name}</span>
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
                  aria-disabled={atFloor ? 'true' : undefined}
                  aria-describedby={atFloor ? 'swimlane-floor' : undefined}
                  onClick={() => {
                    if (atFloor) return
                    setIds((current) => current.filter((id) => id !== status.id))
                  }}
                >
                  Remove
                </Button>
              </li>
            )
          })}
        </ul>
        {atFloor ? (
          <p id="swimlane-floor" className="m-0 mt-2 text-xs italic text-muted-foreground">
            A board needs at least two swimlanes, so the last two cannot be removed. Add a third to
            free them.
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
  )
}
