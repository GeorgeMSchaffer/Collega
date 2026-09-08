import type { ReactNode } from 'react'

/**
 * Comp P's role gating, which shadcn has no component for.
 *
 * The rule it encodes: an action a role may not take is **shown disabled with the reason beside
 * it**, never hidden. Hiding it makes the product look different per role and leaves the user with
 * no way to learn why — "Act as a member" and "Read-only account" are the two reasons in comp P, and
 * both are actionable once read. The disabled control keeps `aria-describedby` pointed at that
 * reason so it reaches a screen reader too.
 */
export function Denied({
  reason,
  id,
  children,
}: {
  reason: string
  id: string
  children: ReactNode
}) {
  return (
    <span className="inline-flex items-center gap-2">
      {children}
      <span className="text-xs italic text-muted-foreground" id={id}>
        {reason}
      </span>
    </span>
  )
}
