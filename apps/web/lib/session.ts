/**
 * Who is signed in, and what their role permits.
 *
 * Deliberately **synchronous**, and this file is where that promise is kept now that identity is
 * real. Identity is resolved once at the request boundary — `app/(desk)/layout.tsx` awaits
 * `resolveCurrentUser()` and calls `setCurrentUser` before it renders anything — and is read
 * synchronously everywhere below. Making the read a promise would force every role-gated component
 * to become async, including the client ones that cannot await, and `Denied` renders inside several
 * of those.
 *
 * ## How a synchronous read stays correct under concurrency
 *
 * A module-level object would be shared by every request the Node process is serving, so two people
 * signing in at once would see each other. The holder is therefore scoped by React's `cache`, which
 * memoizes per render pass — one request, one object — and `setCurrentUser` writes into that
 * object rather than into module state.
 *
 * Outside a render there is no such scope, and `cache` stops memoizing rather than announcing
 * itself: two calls return two different objects. `inRequestScope()` detects exactly that and falls
 * back to a process-wide holder, which is what makes `actAs()` work in the unit tests, where
 * components are rendered directly with no request around them.
 *
 * **That fallback is off unless a test turns it on**, because a render is not the only thing that
 * runs outside a request scope: a Server Function does too. Nothing reaches it today — `signIn` and
 * `signOut` neither publish a principal nor read one — but a mutation whose first line is `await
 * requireCurrentUser()` and whose third reads `organizationScope()` would, and two people
 * interleaving across that `await` would share one module-level object. One would act with the
 * other's organization id and no screen would show it. Throwing instead makes a Server Function
 * that needs the principal pass it explicitly, which is the only shape that is correct there.
 *
 * ## What changed from the fixture, and why it is one function call now
 *
 * `currentUser` used to be a module-level constant, so call sites read `currentUser.role`. It is a
 * function now — `currentUser().role` — because a per-request value cannot be a module constant.
 * That is the one edit this rewiring forced on the screens, and it is deliberately the smallest
 * one available: nothing else about a gated component changes, and nothing became async.
 *
 * The async half lives in `lib/server/current-user.ts`, which is the only thing that fetches it.
 * This module imports no `next/headers`, so a component that merely gates on a role can still be
 * rendered in a unit test.
 */

import { cache } from 'react'
import type { CurrentUser, Role } from './types'

export { engagementDenial, isAdministrator, roleLabel, writeDenial } from './roles'
export type { CurrentUser, Role, ViewingAs } from './types'

type Holder = { user: CurrentUser | null }

/** One object per request, courtesy of React's per-render memoization. */
const requestScope = cache((): Holder => ({ user: null }))

/** Stands in for a request scope where there is none: unit tests, and nothing else. */
const processScope: Holder = { user: null }
let processScopeAllowed = false

/**
 * Opens the process-wide holder, for unit tests that render a gated component with no request
 * around it. `apps/web/test/setup.ts` is the only caller; nothing in `app/` may call this.
 */
export function allowProcessScope(): void {
  processScopeAllowed = true
}

/**
 * Two calls to a `cache`d function return the same object inside a render and different ones
 * outside it. That is the only reliable, non-internal way to ask "is there a request around me?" —
 * `cache` does not expose the question, and reading Next's own async-local storage would mean
 * importing a private module that moves between releases.
 */
const probe = cache((): object => ({}))

function inRequestScope(): boolean {
  try {
    const first = probe()
    const second = probe()
    return first === second
  } catch {
    return false
  }
}

function holder(): Holder {
  if (inRequestScope()) return requestScope()
  if (!processScopeAllowed) {
    throw new Error(
      'currentUser() outside a render scope. A Server Function must pass the principal explicitly.',
    )
  }
  return processScope
}

/**
 * Publishes the resolved principal for the rest of this request.
 *
 * Called once, by the desk layout. Calling it from a page would be too late for anything the
 * layout itself renders, and calling it twice in one request is a sign identity is being resolved
 * somewhere it should have been inherited.
 */
export function setCurrentUser(user: CurrentUser): void {
  holder().user = user
}

/**
 * The signed-in principal.
 *
 * Throws rather than returning null when nothing has been resolved. Every caller is inside a route
 * that requires a session, so an absent principal is a wiring mistake — a component gating on a
 * role outside the authenticated layout — and it should fail loudly during development rather than
 * quietly render the read-only variant of a screen to an administrator.
 */
export function currentUser(): CurrentUser {
  const user = holder().user
  if (!user) {
    throw new Error(
      'No signed-in user for this request. Anything reading currentUser() must render inside the ' +
        'authenticated layout, which resolves identity before it renders.',
    )
  }
  return user
}

/**
 * Why an administrator-only delivery action is refused.
 *
 * Different wording from `writeDenial`, deliberately: administering a sprint is not the same
 * refusal as "you cannot author an idea". Comp Q offers a Site Admin a route back through View As,
 * and gives a member a flat statement of scope.
 *
 * Lives here rather than in `lib/roles.ts` because it is not a pure function of the role — it names
 * the organization, so it reads identity.
 */
export function deliveryAdminDenial(role: Role): string | null {
  if (role === 'SiteAdmin') {
    // A Site Admin belongs to no organization, so `organizationName` is null *by design* — the
    // sidebar and the settings hub both handle that. Naming one here without a fallback printed
    // "Act as an null administrator to change this" on three delivery routes.
    const org = currentUser().organizationName
    return org
      ? `Act as an ${org} administrator to change this`
      : 'Act as an organization administrator to change this'
  }
  if (role === 'User' || role === 'ReadOnly') return 'Administrators only'
  return null
}
