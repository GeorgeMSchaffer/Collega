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
 */
export type LoginState = { error: string | null; email: string }

/**
 * The same message for an unknown email as for a wrong password.
 *
 * The API is already careful not to distinguish them (`AuthService.login`), and repeating a
 * server-supplied `detail` here would leak whatever it does say. The lockout sentence is the
 * screen's own copy and stays in the screen.
 */
const SIGN_IN_FAILED = 'Incorrect email or password.'

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

  // 400 (a field missing) and 401 (wrong credential) are both "that did not sign you in" to a
  // person typing into a form, and the API distinguishes them for an API client's benefit, not a
  // reader's. Anything else is an outage and should reach the error boundary as one.
  if (response.status === 400 || response.status === 401) {
    return { error: SIGN_IN_FAILED, email }
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
 * Every rejection is attributable to a field, so there is no generic-failure path: a 400 names the
 * fields in its `errors` bag, and the 409 is only ever the email.
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

  if (response.status === 400 || response.status === 409) {
    const problem = (await response.json()) as ProblemDetails
    // A 409 carries no `errors` bag — it is `ConflictError('Email is already in use.')`, whose text
    // lands in `detail`. Keying it onto `email` here is what lets the screen treat both refusals
    // identically instead of growing a second rendering path for the one status that skips the bag.
    const errors =
      response.status === 409
        ? {
            email: typeof problem.detail === 'string' ? problem.detail : 'Email is already in use.',
          }
        : fieldErrors(problem.errors)

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
