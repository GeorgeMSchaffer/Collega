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
      return pair.slice(separator + 1)
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
