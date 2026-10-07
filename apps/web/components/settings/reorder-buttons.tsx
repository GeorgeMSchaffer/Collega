'use client'

import { Button } from '@collega/design-system'

/** Moves one item of an ordered list a step, or returns a copy unchanged when it cannot move. */
export function moveItem<T>(items: readonly T[], index: number, step: -1 | 1): T[] {
  const target = index + step
  const next = [...items]
  if (target < 0 || target >= items.length) return next
  const [item] = next.splice(index, 1) as [T]
  next.splice(target, 0, item)
  return next
}

/**
 * Up and down buttons for one row of an ordered selection. Buttons rather than drag handles, so the
 * order is operable from the keyboard; `what` names the row for assistive technology.
 */
export function ReorderButtons({
  what,
  index,
  count,
  onMove,
}: {
  what: string
  index: number
  count: number
  onMove: (step: -1 | 1) => void
}) {
  return (
    <span className="inline-flex gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={index === 0}
        aria-label={`Move ${what} up`}
        onClick={() => onMove(-1)}
      >
        ↑
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={index === count - 1}
        aria-label={`Move ${what} down`}
        onClick={() => onMove(1)}
      >
        ↓
      </Button>
    </span>
  )
}
