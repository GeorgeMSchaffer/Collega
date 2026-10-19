'use client'

import { Button } from '@collega/design-system'
import { useId } from 'react'

/**
 * Remove from board (`20-feature-board-pull-in.md` rules 5 and 6): the text control beside a row's
 * icon actions and in the drawer's board line. `offer.reason` set means it is shown disabled with
 * that reason beside it — `aria-disabled`, so it stays focusable and the reason is announced, as
 * every refused control here is. Whether it is offered at all is `detachOffer`.
 */
export function RemoveFromBoardButton({
  title,
  offer,
  onRemove,
  onOverride,
}: {
  title: string
  offer: { reason: string | null; override?: boolean }
  onRemove: (trigger: HTMLButtonElement) => void
  /** An Org Admin's "Remove anyway…" past the reference-lane lock, shown beside the disabled button. */
  onOverride?: () => void
}) {
  const reasonId = useId()

  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5">
      <Button
        variant="outline"
        size="sm"
        aria-label={`Remove from board: ${title}`}
        aria-disabled={offer.reason ? 'true' : undefined}
        aria-describedby={offer.reason ? reasonId : undefined}
        onClick={(event) => {
          // aria-disabled is advisory - the click still arrives, so the guard lives here.
          if (offer.reason) return
          onRemove(event.currentTarget)
        }}
      >
        Remove from board
      </Button>
      {offer.reason ? (
        <span id={reasonId} className="text-xs text-muted-foreground">
          {offer.reason}
        </span>
      ) : null}
      {offer.override && onOverride ? (
        <Button
          variant="outline"
          size="sm"
          aria-label={`Remove anyway: ${title}`}
          onClick={onOverride}
        >
          Remove anyway…
        </Button>
      ) : null}
    </span>
  )
}
