/**
 * Presentation constants: colour scales and the limits a form shows.
 *
 * Neither data nor identity, so neither `lib/data/` nor `lib/session.ts`. These are decisions the
 * client makes about how to render something, and they do not arrive over the wire — a priority
 * has a colour because comp Q says so, not because the API said so.
 */

import type { DeliveryStatus, Effort, Priority } from './types'

/**
 * Priority has its own colour scale, independent of status.
 *
 * Comp Q keys every dot to the label beside it, which is what lets the same palette token mean
 * different things in different markers. Colouring a priority dot by status breaks that: inside one
 * lane every card would show the same dot, and a `--purple` dot labelled "High" would sit next to a
 * lane where `--purple` means "In Review". Low is deliberately uncoloured.
 */
export const PRIORITY_COLORS: Record<Priority, string | undefined> = {
  Critical: 'var(--orange)',
  High: 'var(--sky)',
  Medium: 'var(--teal)',
  Low: undefined,
}

/**
 * The effort scale's colour. Low is deliberately uncoloured: it is the ordinary case, and a dot on
 * every card would stop the other two meaning anything.
 */
export const EFFORT_COLORS: Record<Effort, string | undefined> = {
  Low: undefined,
  Medium: 'var(--teal)',
  High: 'var(--orange)',
}

/** Comp Q's compact token figures: 1.9M, 268k, 412. */
export function compactTokens(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 100_000 ? 0 : 1)}k`
  return String(value)
}

/**
 * How long ago something happened, as comp Q's attention queue prints it: `14m`, `3h`, `9d`.
 *
 * `now` is a parameter rather than read here, so the caller decides where the clock comes from.
 */
export function compactAge(fromUtc: string, now: Date): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - new Date(fromUtc).getTime()) / 60_000))
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

/**
 * The five delivery statuses, in lifecycle order.
 *
 * Here rather than in `lib/data/` because there is nothing to fetch: they are the domain's
 * `DeliveryStatus` enum, fixed and explicitly not organization-configurable
 * (`SPEC/20-feature-issues-and-delivery.md`), so no endpoint reports them and none ever will while
 * that holds. `getDeliveryStatuses` is still a reader over this list, so the sprint board's lanes
 * arrive the same way every other list does and the day this becomes configurable is a body change.
 *
 * **The `id` is the enum's own spelling**, which is the string `WireDeliveryCard.deliveryStatus`
 * carries. That makes the lane join an equality test against what the API sent, rather than a
 * lookup through a mapping the client invented — the fixture's lowercase `'development'` matched
 * nothing real, and a card whose status matches no lane does not render at all.
 *
 * The colours are comp Q's category dots; `Pending` is deliberately the faint one, because an
 * issue nobody has picked up should not compete with the lanes where work is happening.
 */
export const DELIVERY_STATUSES: readonly DeliveryStatus[] = [
  { id: 'Pending', name: 'Pending', color: 'var(--ink-faint)' },
  { id: 'Scoping', name: 'Scoping', color: 'var(--purple)' },
  { id: 'Development', name: 'Development', color: 'var(--sky)' },
  { id: 'Review', name: 'Review', color: 'var(--pink)' },
  { id: 'Complete', name: 'Complete', color: 'var(--green)' },
]
