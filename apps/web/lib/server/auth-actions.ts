'use server'

/**
 * Sign in and sign out, as Server Functions.
 *
 * The browser posts to Next, Next posts to the API, and the session cookie is re-issued on Next's
 * own origin. That is one hop more than posting straight at the API, and it buys the two things
 * `lib/api/config.ts` explains: no CORS to configure on `apps/api`, and one origin holding the
 * cookie instead of two hosts that have to agree about its domain in every environment.
 *
 * The credential never touches client JavaScript state — the form posts a `FormData` the framework
 * serializes, and the password exists only for the length of this function.
 */

import { redirect } from 'next/navigation'
import { apiBaseUrl, SESSION_COOKIE_NAME } from '../api/config'
import { fieldErrors, type ProblemDetails } from '../api/problem'
import type { WireLoginResponse } from '../api/wire'
import { clearSession, issueSession } from './current-user'

/**
 * What the sign-in form renders back.
 *
 * `email` is echoed so the field can be refilled after a failure. React resets an uncontrolled form
 * once its action resolves, which would otherwise blank both fields and make a mistyped password
 * cost the address as well. The password is deliberately not echoed.
 *
 * `rateLimited` is what the screen needs to know beyond the sentence itself: `LoginForm` prints the
 * five-attempts lockout rule beside every failure, and that rule is not what happened when the
 * limiter turned the request away.
 */
export type LoginState = { error: string | null; rateLimited: boolean; email: string }

/**
 * The same message for an unknown email as for a wrong password.
 *
 * The API is already careful not to distinguish them (`AuthService.login`), and repeating a
 * server-supplied `detail` here would leak whatever it does say. The lockout sentence is the
 * screen's own copy and stays in the screen.
 */
const SIGN_IN_FAILED = 'Incorrect email or password.'

/**
 * Every status `POST /auth/login` uses to decline about *this account*: 400 a field is missing,
 * 401 the credential is wrong, 403 the account is inactive, 429 it is locked out after five failed
 * attempts.
 *
 * **All four render as `SIGN_IN_FAILED`, deliberately.** The last two describe *this* account, so
 * naming them tells an anonymous caller that the address is registered — five wrong guesses would
 * separate a real account from a made-up one, which is the enumeration the shared message exists to
 * prevent, and an inactive-account notice leaks a deactivation to whoever asks. Nobody is left
 * uninformed by the choice: `LoginForm` already prints the fifteen-minute lockout rule beside every
 * failure, so the person who has just locked themselves out reads how long to wait regardless.
 *
 * **429 is on this list for the lockout only, and reaching it means `isRateLimited` said no first.**
 * The endpoint has been rate limited per caller IP since 2026-09-10, and that 429 is not about the
 * account at all — folding it in here tells an office behind one NAT egress that its passwords are
 * wrong. See `isRateLimited` for how the two are told apart.
 *
 * Anything not on this list is an outage or a misrouted request and must reach the error boundary.
 */
const SIGN_IN_REFUSALS: readonly number[] = [400, 401, 403, 429]

/**
 * Tells the rate limiter's 429 from the account lockout's.
 *
 * **The body cannot do it.** `ProblemDetailsFilter` renders `RateLimitedError` and `LockedOutError`
 * through the same branch, so both carry `type` `https://collega.dev/problems/too-many-requests`
 * and the title `Too Many Requests`; only `detail` differs, and that is prose someone will reword.
 * `Retry-After` is the difference that is contractual — `SPEC/30-Contracts.md`, "Rate limiting on
 * the authentication surface", promises it on the limiter's 429, and the lockout sends no header at
 * all. Both shapes were checked against a live API before this was written.
 *
 * Presence, not the value: a header that arrived unparseable still identifies which 429 this is,
 * and the wait is a detail of the sentence rather than of the decision.
 *
 * Deliberately not the throttler's `X-RateLimit-*` headers, which are undocumented library output
 * naming its internal buckets — nothing promises they will be sent at all, and `apps/api` does not
 * send them.
 */
function isRateLimited(response: Response): boolean {
  return response.status === 429 && response.headers.has('retry-after')
}

/**
 * The refusal that is about the caller's address rather than their account.
 *
 * Rounded up to whole minutes from `Retry-After`, which is a window boundary rather than a
 * countdown: by the time the sentence is read "in 47 seconds" is already wrong, where "in a minute"
 * still holds. Both auth limits are reachable, and they are a minute and an hour apart, so the
 * number is worth printing rather than assuming the shorter one.
 */
function tooManyAttempts(retryAfter: string | null): string {
  const seconds = Number(retryAfter)
  const minutes = Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds / 60) : 1

  return `Too many attempts from this network. Try again in ${
    minutes === 1 ? 'a minute' : `${minutes} minutes`
  }.`
}

/**
 * Lifts the session out of the API's `Set-Cookie` and onto ours.
 *
 * The token is deliberately absent from the login *body* (decision `08`), so the cookie header is
 * the only place it exists — reading it here is not a workaround, it is the contract. `getSetCookie`
 * returns each header separately, which is the reason to use it over `headers.get`: a joined string
 * cannot be split on commas without corrupting an `Expires` date.
 */
function sessionTokenFrom(response: Response): string | null {
  for (const header of response.headers.getSetCookie()) {
    const [pair] = header.split(';')
    const separator = pair?.indexOf('=') ?? -1
    if (pair && separator > 0 && pair.slice(0, separator).trim() === SESSION_COOKIE_NAME) {
      // `|| null`, not the value: a `collega_session=; Max-Age=0` header is the API *clearing* the
      // cookie, and `''` is not `null`, so the caller's guard would pass and this would re-issue an
      // empty session — landing the reader in the redirect loop `proxy.ts` now has to break.
      return pair.slice(separator + 1) || null
    }
  }
  return null
}

export async function signIn(_previous: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get('email') ?? '')
  const password = String(form.get('password') ?? '')

  const response = await fetch(`${apiBaseUrl()}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ email, password }),
    cache: 'no-store',
  })

  // Before the fold, and the one refusal that must not join it: this reader's credentials may be
  // perfect. Nothing about it is account-specific — the limiter answers ahead of the handler, to
  // an address that has never held an account — so it is no more of an enumeration oracle than a
  // connection refused.
  if (isRateLimited(response)) {
    return { error: tooManyAttempts(response.headers.get('retry-after')), rateLimited: true, email }
  }

  // Every designed refusal is "that did not sign you in" to a person typing into a form; the API
  // separates them for an API client's benefit, not a reader's. See `SIGN_IN_REFUSALS`.
  if (SIGN_IN_REFUSALS.includes(response.status)) {
    return { error: SIGN_IN_FAILED, rateLimited: false, email }
  }
  if (!response.ok) {
    throw new Error(`POST /auth/login answered ${response.status}`)
  }

  const token = sessionTokenFrom(response)
  if (token === null) {
    throw new Error('POST /auth/login succeeded without setting a session cookie.')
  }

  const body = (await response.json()) as WireLoginResponse

  await issueSession(token, body.expiresInSeconds)

  // `redirect` signals by throwing, so it must be the last thing and must not sit inside a `try`.
  redirect(body.requiresPasswordChange ? '/change-password' : '/boards')
}

/**
 * What the register form renders back.
 *
 * `errors` is keyed by the API's own field names, which are the `name` attributes the form posts —
 * so the screen looks a message up by the field it is already rendering rather than mapping between
 * two vocabularies. `values` echoes everything the person typed except the password, for the reason
 * `LoginState.email` gives: React resets the form once the action resolves, and a rejected invite
 * code would otherwise cost them their name, their address and their password as well.
 */
export type RegisterState = {
  error: string | null
  errors: Readonly<Record<string, string>>
  values: Readonly<Record<'inviteCode' | 'firstName' | 'lastName' | 'email', string>>
}

/**
 * Creates an account from an invite code, then sends the reader to sign in.
 *
 * **It does not sign them in, and that is comp P's decision rather than an omission here.**
 * `POST /auth/register` returns the account and sets no cookie, so signing them in means a second
 * call to `/auth/login` with the password still in hand. Comp P's `s-register` states the outcome
 * instead — *"On success the page returns to Sign in carrying Your account was created"* — and
 * `s-login` reserves one of its three notice strings for it. Doing the extra hop would leave a
 * designed screen state unbuilt, and would put this function in the business of interpreting a
 * *sign-in* refusal (a lockout, a rejected credential) for someone whose account demonstrably just
 * succeeded — a branch with no honest message.
 *
 * Every rejection the submitted details earn is attributable to a field: a 400 names them in its
 * `errors` bag. The one refusal that is not is the rate limiter's 429, which is about the address
 * the request came from and so carries a banner message with no field beside it.
 */
export async function register(_previous: RegisterState, form: FormData): Promise<RegisterState> {
  const values = {
    inviteCode: String(form.get('inviteCode') ?? ''),
    firstName: String(form.get('firstName') ?? ''),
    lastName: String(form.get('lastName') ?? ''),
    email: String(form.get('email') ?? ''),
  }

  const response = await fetch(`${apiBaseUrl()}/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ ...values, password: String(form.get('password') ?? '') }),
    cache: 'no-store',
  })

  if (response.status === 400) {
    const problem = (await response.json()) as ProblemDetails
    const errors = fieldErrors(problem.errors)

    return {
      // Named rather than generic, because the invite code is the one field a person cannot simply
      // re-read off the screen and correct — it came from somebody else.
      error: errors.inviteCode
        ? 'Check your invite code and try again.'
        : 'Check the highlighted fields and try again.',
      errors,
      values,
    }
  }

  // Not a field's fault and not an outage, so neither of the branches around it will do. Register
  // is limited to ten a minute per address, which one onboarding session or one classroom reaches
  // — and throwing here crashes the page, losing an invite code, a name and an address that were
  // typed correctly. `errors` stays empty because no field is at fault; `values` comes back for
  // the same reason it does above.
  //
  // No `isRateLimited` check: register has no lockout, so every 429 it answers is the limiter.
  if (response.status === 429) {
    return { error: tooManyAttempts(response.headers.get('retry-after')), errors: {}, values }
  }

  if (!response.ok) {
    throw new Error(`POST /auth/register answered ${response.status}`)
  }

  // `redirect` signals by throwing, so it must be the last thing and must not sit inside a `try`.
  redirect('/login?registered=1')
}

/**
 * Ends the session by dropping the cookie.
 *
 * There is no `POST /auth/logout`: the API's session is a stateless signed JWT with no server-side
 * record to revoke, so discarding the cookie *is* signing out, and inventing an endpoint that only
 * cleared a cookie the client already controls would add a round trip for nothing. If sessions ever
 * become revocable, this is the one place that has to call it.
 */
export async function signOut(): Promise<void> {
  await clearSession()
  redirect('/login')
}
