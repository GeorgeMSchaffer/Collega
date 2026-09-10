'use client'

/**
 * The same principal, for the components that run in the browser.
 *
 * A client component cannot read the request, so `lib/session.ts`'s request-scoped holder is
 * unavailable to it — and it cannot await a fetch either, which is the constraint that started all
 * of this. So the server hands the already-resolved principal across the boundary as a prop on this
 * provider, and every client component below reads it synchronously out of context.
 *
 * It is the same value the server components see, serialized once per request by the desk layout.
 * There is no second fetch and no window where the two halves of one page disagree about who is
 * signed in.
 *
 * Role predicates are imported from `lib/roles.ts` rather than re-exported here: they are pure and
 * bundle fine on either side, and routing them through this file would pull the context into
 * modules that only wanted a function of a role.
 */

import { createContext, type ReactNode, useContext } from 'react'
import type { CurrentUser } from './types'

const SessionContext = createContext<CurrentUser | null>(null)

export function SessionProvider({ user, children }: { user: CurrentUser; children: ReactNode }) {
  return <SessionContext.Provider value={user}>{children}</SessionContext.Provider>
}

/**
 * The signed-in principal, inside a client component.
 *
 * Throws when there is no provider above, for the reason `currentUser()` does: a gated control
 * rendered outside the authenticated layout is a wiring mistake, and defaulting to a least-
 * privileged identity would hide it behind a screen that merely looks a bit restricted.
 */
export function useCurrentUser(): CurrentUser {
  const user = useContext(SessionContext)
  if (!user) {
    throw new Error(
      'useCurrentUser() needs a <SessionProvider> above it, which the authenticated layout renders.',
    )
  }
  return user
}
