import { GatedAction } from '@/components/common/gated-action'
import { currentUser, deliveryAdminDenial } from '@/lib/session'

/**
 * A delivery action only an organization administrator may take.
 *
 * Delivery's own wording over the shared control: a Site Admin is told the route back through
 * View As, a member is told the scope.
 */
export function AdminAction({ id, label }: { id: string; label: string }) {
  return <GatedAction id={id} label={label} denial={deliveryAdminDenial(currentUser().role)} />
}
