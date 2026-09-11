'use server'

/**
 * The account's own writes, as Server Functions: sign in and out, register, edit the profile,
 * change the password.
 *
 * The browser posts to Next, Next posts to the API, and the session cookie is re-issued on Next's
 * own origin. That is one hop more than posting straight at the API, and it buys the two things
 * `lib/api/config.ts` explains: no CORS to configure on `apps/api`, and one origin holding the
 * cookie instead of two hosts that have to agree about its domain in every environment.
 *
 * The credential never touches client JavaScript state — the form posts a `FormData` the framework
 * serializes, and the password exists only for the length of this function. **No state returned
 * from here ever carries a password**, on any branch: an address is echoed so a mistyped password
 * does not also cost the email, and that is the only thing echoed from a form that has one.
 *
 * Every function here calls `fetch` directly rather than going through `lib/api/client.ts`, and
 * the two halves of the file do it for different reasons. `signIn` and `register` are anonymous,
 * so there is no session for `apiGet`/`apiPost` to forward. `updateProfile` and `changePassword`
 * have one — `sessionHeader()` carries it, from the single module allowed to read the cookie — but
 * they need two things a thrown `ApiError` has already discarded by the time it is caught: the
 * `Retry-After` header, and the problem envelope's `type`, which on this surface is the only thing
 * separating two refusals that share a status. See `KERNEL_UNAUTHORIZED`.
 */

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { apiPath } from '../api/client'
import { apiBaseUrl, SESSION_COOKIE_NAME } from '../api/config'
import { fieldErrors, type ProblemDetails } from '../api/problem'
import type { WireLoginResponse } from '../api/wire'
import { clearSession, issueSession, sessionHeader } from './current-user'

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
 * `errors` bag, and the 409 is only ever the email. The one refusal that is not is the rate
 * limiter's 429, which is about the address the request came from and so carries a banner message
 * with no field beside it.
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
 * The problem `type` an Application-layer refusal carries, as opposed to a guard's.
 *
 * **This is the only thing separating the two 401s `POST /auth/change-password` can answer**, and
 * they need entirely different outcomes: `AuthGuard` rejects a request with no usable session, so
 * the reader has to sign in again, while `AuthService.changePassword` rejects a wrong current
 * password, which is a message beside a field on a screen they should stay on. Conflating them
 * either signs out everyone who mistypes, or tells a signed-out reader their password is wrong and
 * leaves them on a form that cannot work.
 *
 * `status` cannot tell them apart and neither can `detail` — a guard's is the generic "No further
 * details are available for this 401 response." today, which is a sentence, not a contract.
 * `type` is the contract: `problem-details.filter.ts` exists to keep these two envelopes distinct
 * and the golden corpus records both shapes. Checked against a live API before this was written.
 */
const KERNEL_UNAUTHORIZED = 'https://collega.dev/problems/unauthorized'

/**
 * What the profile form renders back.
 *
 * `saved` is the quiet confirmation comp P puts beside a submit button rather than in a banner —
 * nothing about the screen changes when a name is saved to the name it already displayed, so
 * without it a successful save and a request that never left are indistinguishable.
 */
export type ProfileState = {
  error: string | null
  errors: Readonly<Record<string, string>>
  values: Readonly<Record<'firstName' | 'lastName', string>>
  saved: boolean
}

/**
 * Renames the signed-in account (comp P `s-profile`, "Profile details").
 *
 * No user id is read from the form and none is accepted: `PUT /auth/me` acts on whoever the
 * forwarded cookie names, and an id in the payload would be a parameter anyone could post a
 * different value for. Email, role and organization are not sent at all — the form renders them
 * read-only and the endpoint refuses to change them (`SPEC/30-Contracts.md`).
 */
export async function updateProfile(
  _previous: ProfileState,
  form: FormData,
): Promise<ProfileState> {
  const values = {
    firstName: String(form.get('firstName') ?? ''),
    lastName: String(form.get('lastName') ?? ''),
  }

  const response = await fetch(`${apiBaseUrl()}${apiPath`/auth/me`}`, {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      ...(await sessionHeader()),
    },
    body: JSON.stringify(values),
    cache: 'no-store',
  })

  if (response.status === 400) {
    const problem = (await response.json()) as ProblemDetails
    return {
      error: 'Check the highlighted fields and try again.',
      errors: fieldErrors(problem.errors),
      values,
      saved: false,
    }
  }

  // The session ended between this screen rendering and Save being pressed. Only a guard answers
  // 401 here — `updateMe` throws nothing of its own — so there is no second meaning to rule out.
  if (response.status === 401) redirect('/login?expired=1')

  // An administrator issued a temporary password while this screen was open, so a rotation is now
  // owed. `PUT /auth/me` is deliberately not on the mid-rotation allowlist (`AuthenticationController
  // .updateMe`), and the rotation is the only thing that clears it — so the screen this refusal
  // sends them to is the one that can act on it, not a banner offering a retry that would fail again.
  if (response.status === 403) redirect('/change-password')

  if (!response.ok) {
    throw new Error(`PUT /auth/me answered ${response.status}`)
  }

  // The name is in the sidebar, which the desk layout renders from its own `/auth/me` — a layout
  // above this page, so revalidating the page alone leaves the old name in the chrome until a full
  // reload. `'/'` with `'layout'` is the root layout and everything beneath it, which is the
  // smallest thing that covers a value rendered app-wide.
  revalidatePath('/', 'layout')

  return { error: null, errors: {}, values, saved: true }
}

/**
 * What both password forms render back.
 *
 * Deliberately has no `values`: every field on these forms is a password, so there is nothing here
 * that may be echoed and nothing to lose by clearing them — retyping a password is what a person
 * does after getting one wrong anyway.
 */
export type PasswordState = {
  error: string | null
  errors: Readonly<Record<string, string>>
}

/** Comp Q's wording, on `s-first-signin`, for the one refusal the API never sees. */
const PASSWORDS_DIFFER = 'The new password and confirmation don’t match. Nothing has been changed.'

/**
 * Changes the signed-in account's password — both the forced first-sign-in rotation
 * (comp P `s-first-signin`) and the voluntary change under Settings › Profile.
 *
 * **One function for both screens, because the outcome is identical and it is not "you are done".**
 * `changeUserPassword` regenerates the user's `SecurityStamp`, and every issued JWT embeds the
 * stamp current at issuance (`SPEC/30-Contracts.md`), so the cookie in the reader's browser is
 * dead the instant this succeeds. Dropping it here is therefore not a policy choice this file is
 * making — it is telling the truth about a session that has already ended, and the alternative is
 * a reader who appears signed in until their next request 401s. Comp P states the same outcome as
 * copy on both screens: *"Saving signs you out. Sign in again with the new password."*
 *
 * The confirmation field is checked here and nowhere else: `POST /auth/change-password` takes two
 * fields, not three, so the only thing that can compare them is whatever assembled the request.
 * It is checked **before** the call, so a mistyped confirmation costs no rate-limit allowance and
 * writes no `AuthPasswordChangeFailed` audit event for something that was never an attempt.
 *
 * No 403 branch: this endpoint carries `@AllowWhilePasswordChangeRequired()`, which is the only
 * thing that produces one here, so a 403 would be the API contradicting itself rather than a
 * refusal to render.
 */
export async function changePassword(
  _previous: PasswordState,
  form: FormData,
): Promise<PasswordState> {
  const newPassword = String(form.get('newPassword') ?? '')

  if (newPassword !== String(form.get('confirmPassword') ?? '')) {
    return {
      error: PASSWORDS_DIFFER,
      errors: { confirmPassword: 'Must match the new password exactly.' },
    }
  }

  const response = await fetch(`${apiBaseUrl()}${apiPath`/auth/change-password`}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      ...(await sessionHeader()),
    },
    body: JSON.stringify({
      currentPassword: String(form.get('currentPassword') ?? ''),
      newPassword,
    }),
    cache: 'no-store',
  })

  // No `isRateLimited` check, for the reason `register` gives: this route has no account lockout —
  // `AuthService.changePassword` counts nothing and locks nothing — so the limiter is the only
  // thing here that can answer 429, and there is no second 429 to tell it apart from.
  if (response.status === 429) {
    return { error: tooManyAttempts(response.headers.get('retry-after')), errors: {} }
  }

  if (response.status === 400 || response.status === 401) {
    const problem = (await response.json()) as ProblemDetails

    if (response.status === 401) {
      // A guard's 401, not the service's: no session, so nothing on this form can succeed.
      if (problem.type !== KERNEL_UNAUTHORIZED) redirect('/login?expired=1')

      return {
        error: 'Your current password is incorrect. Nothing has been changed.',
        errors: {
          currentPassword:
            typeof problem.detail === 'string' ? problem.detail : 'Current password is incorrect.',
        },
      }
    }

    // A 400 is always `newPassword`: `currentPassword` is only ever checked for presence, and the
    // policy failures arrive keyed by field in the `errors` bag either way.
    return {
      error: 'Check the highlighted fields and try again.',
      errors: fieldErrors(problem.errors),
    }
  }

  if (!response.ok) {
    throw new Error(`POST /auth/change-password answered ${response.status}`)
  }

  await clearSession()

  // `redirect` signals by throwing, so it must be the last thing and must not sit inside a `try`.
  redirect('/login?passwordChanged=1')
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
