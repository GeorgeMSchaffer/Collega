/**
 * Where `apps/api` is, and who is allowed to know.
 *
 * **Only the Next server talks to the API. The browser never does.** That is a decision, not an
 * accident of the current ports:
 *
 * - `apps/api`'s `main.ts` does not call `enableCors()`, so a `fetch` from `http://localhost:3000`
 *   to `http://localhost:3001` is blocked before it reaches a controller. Adding CORS would mean
 *   editing `apps/api`, and it would mean maintaining an origin allowlist per environment.
 * - The session is an httpOnly cookie (`SPEC/decisions.md` 08). Keeping every call same-origin
 *   means the cookie is scoped to one host and never has to be shared across two, which is the
 *   part that gets hard on Vercel where preview deployments each get their own hostname.
 *
 * So `COLLEGA_API_URL` is read on the server only and is deliberately NOT `NEXT_PUBLIC_`. A
 * `NEXT_PUBLIC_` value is inlined into the client bundle, which would both invite a browser call
 * that CORS rejects and publish the API's internal address; on Vercel the API may well be reachable
 * only from the server side.
 *
 * The default is the local `apps/api` port so a fresh clone runs with no configuration at all.
 * Deployment sets the variable to the deployed host — nothing else changes.
 */

const DEFAULT_API_URL = 'http://127.0.0.1:3001/api/v1'

/** The API's base URL including the `/api/v1` prefix, with no trailing slash. */
export function apiBaseUrl(): string {
  const configured = process.env.COLLEGA_API_URL?.trim()
  const base = configured && configured.length > 0 ? configured : DEFAULT_API_URL
  return base.endsWith('/') ? base.slice(0, -1) : base
}

/**
 * The httpOnly session cookie the API issues, mirrored by name from
 * `apps/api/src/auth/session-cookie.ts`.
 *
 * Duplicated rather than imported because the layer boundary forbids importing across, and left
 * as a literal on both sides for the reason that file gives: the name is not a secret, and one
 * that could differ per environment would be a way for the two halves to drift apart silently.
 */
export const SESSION_COOKIE_NAME = 'collega_session'
