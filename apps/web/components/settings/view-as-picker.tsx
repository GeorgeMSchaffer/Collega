'use client'

import { Alert, Badge, Button } from '@collega/design-system'
import { useActionState } from 'react'
import type { ViewAsCandidate } from '@/lib/data'
import { startViewAs, type ViewAsState } from '@/lib/server/view-as-actions'

const IDLE: ViewAsState = { error: null }

/**
 * Choosing who to act as.
 *
 * One form per row rather than one form with a selected id, because each row is its own action and
 * a radio group would add a step — pick, then confirm — to a decision that is a single click.
 *
 * **Rows the server marked unselectable are shown, disabled, with the reason.** They are inactive
 * accounts or members of an archived organization. Hiding them would make somebody searching for a
 * name conclude the search is broken; showing them answers the question they actually have. The
 * server refuses them on start regardless of what this rendered, so the disabled attribute is a
 * courtesy rather than the control.
 */
export function ViewAsPicker({ candidates }: { candidates: readonly ViewAsCandidate[] }) {
  const [state, action] = useActionState(startViewAs, IDLE)

  if (candidates.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nobody to view as. Candidates are the members of the organizations on this deployment —
        create an organization and add a user to it first.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {state.error ? <Alert variant="destructive">{state.error}</Alert> : null}

      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {candidates.map((candidate) => (
          <li
            key={candidate.userId}
            className="flex flex-wrap items-center justify-between gap-3 rounded border border-border bg-card px-4 py-3"
          >
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="font-medium">{candidate.displayName}</span>
              <span className="text-sm text-muted-foreground">
                {candidate.email} · {candidate.organizationName}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="outline">{candidate.role}</Badge>
              {candidate.selectable ? null : <Badge variant="outline">{candidate.status}</Badge>}

              <form action={action}>
                <input type="hidden" name="targetUserId" value={candidate.userId} />
                <Button
                  type="submit"
                  size="sm"
                  variant="outline"
                  disabled={!candidate.selectable}
                  aria-label={`View as ${candidate.displayName}`}
                >
                  View as
                </Button>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
