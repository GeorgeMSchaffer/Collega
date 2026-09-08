import { Button, Denied } from '@collega/design-system'
import { currentUser, deliveryAdminDenial } from '@/lib/session'

/**
 * A delivery action only an organization administrator may take.
 *
 * Control-level, so the denied form stays visible with its reason beside it — the same rule the
 * ideas screens use, but with delivery's own wording. A Site Admin is told the route back through
 * View As; a member is told the scope. Both keep the control focusable and `aria-disabled`.
 */
export function AdminAction({ id, label }: { id: string; label: string }) {
  const denial = deliveryAdminDenial(currentUser.role)

  if (!denial) {
    return <Button>{label}</Button>
  }

  return (
    <Denied reason={denial} id={id}>
      <Button aria-disabled="true" aria-describedby={id}>
        {label}
      </Button>
    </Denied>
  )
}
