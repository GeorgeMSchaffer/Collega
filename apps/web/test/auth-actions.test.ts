import { afterEach, describe, expect, it, vi } from 'vitest'
import { SESSION_COOKIE_NAME } from '@/lib/api/config'
import type { WireLoginResponse } from '@/lib/api/wire'
import { signIn } from '@/lib/server/auth-actions'

/**
 * Lifting the session out of the API's `Set-Cookie` and onto ours.
 *
 * This is the only place the credential exists — decision `08` took the token out of the login
 * body — so a header this misreads is not a degraded sign-in, it is no sign-in at all. It is also
 * the one piece of the flow with no server to catch it: the API answered 200, the person typed the
 * right password, and everything after this function believes them.
 *
 * The parsing is exercised through `signIn` rather than directly. `sessionTokenFrom` is private,
 * and what a reader actually cares about is the pair of outcomes it decides between: a session
 * issued and a redirect, or a loud failure. Both are observable from here.
 */

const session = vi.hoisted(() => ({ issueSession: vi.fn(), clearSession: vi.fn() }))

// `lib/server/current-user.ts` carries `import 'server-only'`, so the real module cannot load in a
// jsdom environment at all. Stubbing it keeps these tests about the header the API sent rather
// than about how the cookie is re-issued on our origin.
vi.mock('@/lib/server/current-user', () => session)

// `redirect` signals by throwing, which is the framework's contract and not a detail of the test:
// the destination is the only observable result of a sign-in that worked.
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`)
  },
}))

/** Shaped like the real thing — three dot-separated segments — because `=` and `;` would not be. */
const TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI3ZWRkOTI0OSJ9.4Rr8sVQ4l0nQyPqk3mWc1YbXzT2fA6uKdE'

/** `/auth/login`'s own body, as `auth.login.orgadmin` records it minus the token decision 08 removed. */
const LOGIN_BODY: WireLoginResponse = {
  expiresInSeconds: 28800,
  requiresPasswordChange: false,
  user: {
    userId: '7edd9249-cc88-46e3-a3e1-354daf717e4f',
    organizationId: '182df148-cf57-4bba-ade8-99286b6c1181',
    organizationTitle: 'Acme Robotics',
    role: 'OrgAdmin',
    firstName: 'Olivia',
    lastName: 'Administer',
    email: 'orgadmin@acme-robotics.demo.collega.test',
    status: 'Active',
    portraitDataUrl: null,
    viewingAs: null,
  },
}

function credentials(): FormData {
  const form = new FormData()
  form.set('email', LOGIN_BODY.user.email)
  form.set('password', 'Abc123!')
  return form
}

/** Signs in against a 200 whose response carries exactly these `Set-Cookie` headers. */
function signInAgainst(cookies: readonly string[], body: Partial<WireLoginResponse> = {}) {
  const response = new Response(JSON.stringify({ ...LOGIN_BODY, ...body }), {
    headers: [
      ['content-type', 'application/json; charset=utf-8'],
      ...cookies.map((cookie): [string, string] => ['set-cookie', cookie]),
    ],
  })
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => response),
  )
  return signIn({ error: null, email: '' }, credentials())
}

afterEach(() => vi.unstubAllGlobals())

describe('signing in', () => {
  it('issues our own session from the cookie the API set', async () => {
    await expect(
      signInAgainst([
        `${SESSION_COOKIE_NAME}=${TOKEN}; Path=/; HttpOnly; SameSite=Lax; Max-Age=28800`,
      ]),
    ).rejects.toThrow('NEXT_REDIRECT /boards')
    expect(session.issueSession).toHaveBeenCalledWith(TOKEN, 28800)
  })

  it('sends a login that requires a password change to the change screen', async () => {
    await expect(
      signInAgainst([`${SESSION_COOKIE_NAME}=${TOKEN}; Path=/`], { requiresPasswordChange: true }),
    ).rejects.toThrow('NEXT_REDIRECT /change-password')
    expect(session.issueSession).toHaveBeenCalledWith(TOKEN, 28800)
  })

  it('keeps the whole token when the header carries an Expires date', async () => {
    // The shape the API actually sends: express turns `maxAge` into an `Expires` date as well, and
    // that date contains a comma — which is why the joined header cannot be split on one, and why
    // the token must not pick up the attributes that follow it.
    await expect(
      signInAgainst([
        `${SESSION_COOKIE_NAME}=${TOKEN}; Expires=Wed, 09 Jun 2027 10:18:14 GMT; Path=/; HttpOnly`,
      ]),
    ).rejects.toThrow('NEXT_REDIRECT /boards')
    expect(session.issueSession).toHaveBeenCalledWith(TOKEN, 28800)
  })

  it('finds the session among the other cookies a response may set', async () => {
    await expect(
      signInAgainst([
        'csrf_token=9f2c; Expires=Wed, 09 Jun 2027 10:18:14 GMT; Path=/',
        `${SESSION_COOKIE_NAME}=${TOKEN}; Path=/; HttpOnly`,
        'locale=en-GB; Path=/',
      ]),
    ).rejects.toThrow('NEXT_REDIRECT /boards')
    expect(session.issueSession).toHaveBeenCalledWith(TOKEN, 28800)
  })

  it('reads a cleared session cookie as no cookie', async () => {
    // `collega_session=; Max-Age=0` is the API *clearing* the session. An empty string is not
    // null, so an unguarded read passes the caller's guard and issues an empty session — and the
    // reader then holds a cookie every request rejects, which is the redirect loop `proxy.ts` has
    // to break rather than a sign-in.
    await expect(
      signInAgainst([`${SESSION_COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly`]),
    ).rejects.toThrow(/without setting a session cookie/)
    expect(session.issueSession).not.toHaveBeenCalled()
  })

  it('does not mistake another cookie for the session', async () => {
    // Including one whose name merely starts with ours: the comparison is on the name up to the
    // first `=`, not on what the header happens to contain.
    await expect(
      signInAgainst([
        `${SESSION_COOKIE_NAME}_backup=${TOKEN}; Path=/`,
        `not_${SESSION_COOKIE_NAME}=${TOKEN}; Path=/`,
        'locale=en-GB; Path=/',
      ]),
    ).rejects.toThrow(/without setting a session cookie/)
    expect(session.issueSession).not.toHaveBeenCalled()
  })
})
