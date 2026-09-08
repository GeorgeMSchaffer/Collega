import type { Response } from 'express'

/**
 * The httpOnly session cookie SPEC/decisions.md 2026-09-04 (`08`) decided: Nest issues it
 * directly, Next stays a pure client. It names ONLY the real user - the signed JWT's `sub`
 * claim is never the impersonated user's id, since impersonation is resolved server-side from
 * `impersonation_sessions` on every request (rule 1; findings 07 section 5).
 *
 * Not env-configurable, deliberately: unlike a secret, the cookie's NAME is not sensitive, and a
 * name that could silently differ between environments would be one more way apps/web's own
 * chokepoint (`apps/web/lib/server/current-user.ts`, findings 07 section 6.3) could drift from
 * what this file sets. One literal, shared by import.
 */
export const SESSION_COOKIE_NAME = 'collega_session'

/**
 * Sets the session cookie on login and on View As start/exit (decision `08`). `maxAgeSeconds`
 * is the access token's own lifetime - the cookie must not outlive the JWT it carries, or a
 * browser would keep sending a token the server already treats as expired.
 *
 * `sameSite: 'lax'` and no explicit `domain`: decision `08`'s "cross-origin setup... is now in
 * scope for S0.3 and E0" is E0's to resolve once apps/web exists and its origin is known: adding
 * a `domain` now, before that origin is decided, risks pinning the wrong one silently.
 */
export function setSessionCookie(res: Response, token: string, maxAgeSeconds: number): void {
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: maxAgeSeconds * 1000,
    path: '/',
  })
}

/** Clears the session cookie. Decision `08` names login, View As start, and View As exit as the
 * three places the cookie is written or cleared - which of those two this is at each site is a
 * call for whichever slice builds that endpoint, not this helper. */
export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE_NAME, { httpOnly: true, secure: true, sameSite: 'lax', path: '/' })
}
