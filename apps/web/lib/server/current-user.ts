/**
 * The single place `apps/web` touches the session credential, and the single place it resolves who
 * is signed in.
 *
 * Two different guards keep it that way, and neither one covers the other's case:
 *
 * - `biome.json` puts `next/headers` on the restricted-import list for the whole workspace and
 *   allowlists **this path alone** (override 7), which is why `apps/api/src/auth/session-cookie.ts`
 *   names this module as the other half of its own chokepoint. That catches a file that writes
 *   `import { cookies } from 'next/headers'` itself — code reading a credential directly silently
 *   opts itself out of View As.
 * - `import 'server-only'` below catches the case the lint rule cannot see: a `'use client'`
 *   component that reaches this module *transitively*, through a barrel that re-exports something
 *   that eventually imports it. No file in that chain names `next/headers`, so Biome has nothing to
 *   match on, and the failure otherwise surfaces as a Turbopack build error naming a component
 *   several hops away. `lib/api/client.ts` carries the same import for the same reason.
 *
 * So everything that needs the session goes through the three primitives below rather than reaching
 * for `cookies()`: `lib/api/client.ts` forwards it, and `lib/server/auth-actions.ts` issues and
 * clears it.
 *
 * **`GET /auth/me` is the source of identity, never the login response.** During a live View As
 * session `/auth/me` answers with the *impersonated* user and a populated `viewingAs`, while login
 * answered with whoever typed the password. A client that trusted login would keep showing the
 * administrator's own role after they started viewing as somebody else, and would keep showing the
 * banner after the session had already expired server-side (Sprint 6.5's finding). View As itself
 * is D7 and unbuilt; taking the principal from here now is what makes it buildable without
 * revisiting every screen.
 */

import 'server-only'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { toCurrentUser } from '../api/adapt'
// A cycle with `lib/api/client.ts`, and an inert one: it calls `sessionHeader()` from inside
// `apiGet` and this module calls `apiGet` from inside `resolveCurrentUser`, so neither runs during
// the other's evaluation. They are two halves of one seam — an authenticated HTTP client — kept in
// separate files only because the credential half is what the lint rule pins down.
import { apiGet, isApiStatus } from '../api/client'
import { SESSION_COOKIE_NAME } from '../api/config'
import type { WireCurrentUser, WireOrganization } from '../api/wire'
import { setCurrentUser } from '../session'
import type { CurrentUser } from '../types'

/**
 * The `Cookie` header that carries the caller's session to the API, or nothing when they have none.
 *
 * A server component's `fetch` is a brand new request from the Node process; the browser's cookie
 * jar is not attached to it, and an httpOnly cookie could not be read by client JavaScript to
 * attach by hand even if it were. Forwarding it explicitly is the whole mechanism.
 */
export async function sessionHeader(): Promise<Record<string, string>> {
  const session = (await cookies()).get(SESSION_COOKIE_NAME)
  return session ? { cookie: `${SESSION_COOKIE_NAME}=${session.value}` } : {}
}

/**
 * Re-issues the API's session cookie on this origin.
 *
 * `maxAgeSeconds` is the access token's own lifetime — the cookie must not outlive the JWT it
 * carries, or the browser keeps sending a token the server already treats as expired.
 */
export async function issueSession(token: string, maxAgeSeconds: number): Promise<void> {
  ;(await cookies()).set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    // Mirrors what the API sets, except in development: a `Secure` cookie needs a trustworthy
    // origin, and while browsers grant that to `localhost` they do not to a plain-HTTP host by any
    // other name — a dev server reached from another machine would drop the cookie, and the sign-in
    // would appear to succeed and then bounce straight back to the form.
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: maxAgeSeconds,
    path: '/',
  })
}

export async function clearSession(): Promise<void> {
  ;(await cookies()).delete(SESSION_COOKIE_NAME)
}

/**
 * Resolves the acting user and publishes it for the synchronous readers below.
 *
 * **Every authenticated page and layout calls this as its first statement**, and that is not
 * ceremony — it is what makes `currentUser()` synchronous and race-free. Next renders a layout and
 * the page inside it independently, so a principal resolved only in the layout is not reliably
 * there when the page renders: identity has to be established in each segment that reads it. The
 * `cache` below means that costs one `/auth/me` per request all the same.
 *
 * The same shape every framework-level auth library in this ecosystem settles on — `const user =
 * await requireCurrentUser()` at the top of a page — and it fails loudly rather than silently if a
 * page forgets, because `currentUser()` throws instead of inventing a least-privileged identity.
 *
 * No session means the cookie has expired or been revoked, which is an ordinary end to a session
 * and so a redirect rather than an error boundary. `proxy.ts` already turned away the requests with
 * no cookie at all; this catches the ones it cannot judge.
 *
 * `?expired=1` rather than a bare `/login`, and this cannot be fixed here instead: a cookie the API
 * rejects is still a cookie, so `proxy.ts` would bounce the reader back to `/boards` and around
 * again, and clearing it here is not available because cookies are immutable during a render. The
 * flag is what tells `proxy.ts` to let the request through and drop the cookie on the way.
 */
export async function requireCurrentUser(): Promise<CurrentUser> {
  const user = await loadPrincipal()
  if (!user) redirect('/login?expired=1')
  setCurrentUser(user)
  return user
}

/**
 * The acting user, or `null` when the request carries no usable session.
 *
 * `cache`d, so the layout and the page each asking for identity is one request, not two.
 *
 * A 401 is an answer, not a failure. Every other status still throws, because a 500 from
 * `/auth/me` is an outage and must reach an error boundary rather than log everybody out.
 */
const loadPrincipal = cache(async (): Promise<CurrentUser | null> => {
  let me: WireCurrentUser
  try {
    me = await apiGet<WireCurrentUser>('resolveCurrentUser', '/auth/me')
  } catch (error) {
    if (isApiStatus(error, 401)) return null
    throw error
  }

  return toCurrentUser(me, await organizationName(me.organizationId))
})

/**
 * The organization's display title, which `/auth/me` does not carry.
 *
 * A second request, and worth it: the sidebar names the organization on every page, and the
 * alternative is either widening the API's contract or printing an id at a person. A Site Admin
 * belongs to no organization, so they cost nothing.
 *
 * A failure here is swallowed to `null` on purpose — that is precisely the branch the sidebar and
 * the settings hub already render for a Site Admin ("All organizations"), so a slow or unhappy
 * organizations endpoint degrades the label instead of taking down every authenticated page.
 */
async function organizationName(organizationId: string | null): Promise<string | null> {
  if (organizationId === null) return null
  try {
    const organization = await apiGet<WireOrganization>(
      'organizationName',
      `/organizations/${organizationId}`,
    )
    return organization.title
  } catch {
    return null
  }
}
