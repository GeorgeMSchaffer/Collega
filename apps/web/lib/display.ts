/**
 * Presentation constants: colour scales and the limits a form shows.
 *
 * Neither data nor identity, so neither `lib/data/` nor `lib/session.ts`. These are decisions the
 * client makes about how to render something, and they do not arrive over the wire — a priority
 * has a colour because comp Q says so, not because the API said so.
 */

import type { DeliveryStatus } from './types'

export { EFFORT_COLORS, PRIORITY_COLORS } from './mock'

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
