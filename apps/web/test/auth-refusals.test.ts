import { afterEach, describe, expect, it, vi } from 'vitest'
import { changePassword, register, signIn } from '@/lib/server/auth-actions'

/**
 * How the account forms read the API's refusals (contracts/auth.md "Rate limiting on the
 * authentication surface"; SPEC/20-feature-auth.md 32a and 34).
 *
 * Three rules are at stake, each fixed once against a live API and never tested since:
 *
 * - every refusal about the *account* (400, 401, 403 inactive, 429 locked) reads the same on the
 *   sign-in form, so the form is no enumeration oracle;
 * - the limiter's 429 - the one that carries `Retry-After` - is NOT one of those, because a whole
 *   office behind one address would otherwise be told its passwords are wrong;
 * - a guard's 401 on change-password ends the session, while the service's own 401 (wrong current
 *   password) is a message on the form.
 */

const session = vi.hoisted(() => ({
  issueSession: vi.fn(),
  clearSession: vi.fn(),
  sessionHeader: vi.fn(async () => ({ cookie: 'collega_session=tok' })),
}))

vi.mock('@/lib/server/current-user', () => session)
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`)
  },
}))

function problem(status: number, body: object, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify({ status, ...body }), {
    status,
    headers: { 'content-type': 'application/problem+json', ...headers },
  })
}

function answer(response: Response) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => response),
  )
}

function form(fields: Record<string, string>): FormData {
  const data = new FormData()
  for (const [name, value] of Object.entries(fields)) data.set(name, value)
  return data
}

const SIGN_IN = form({ email: 'ann@acme.test', password: 'Abc123!' })
const TOO_MANY = 'https://collega.dev/problems/too-many-requests'

afterEach(() => {
  vi.unstubAllGlobals()
  session.clearSession.mockClear()
})

describe('signIn - account refusals are indistinguishable', () => {
  it.each([
    [400, { type: 'https://collega.dev/problems/validation-error' }],
    [
      401,
      { type: 'https://collega.dev/problems/unauthorized', detail: 'Invalid email or password.' },
    ],
    [403, { type: 'https://collega.dev/problems/forbidden', detail: 'This account is inactive.' }],
    [
      429,
      { type: TOO_MANY, detail: 'This account is locked due to too many failed login attempts.' },
    ],
  ])('renders a %i as the one shared sentence', async (status, body) => {
    answer(problem(status, body))

    const state = await signIn({ error: null, rateLimited: false, email: '' }, SIGN_IN)

    expect(state).toEqual({
      error: 'Incorrect email or password.',
      rateLimited: false,
      email: 'ann@acme.test',
    })
  })
})

describe('signIn - the limiter is not the lockout', () => {
  it('tells a rate-limited sign-in apart by Retry-After and says how long to wait', async () => {
    answer(problem(429, { type: TOO_MANY, detail: 'Too many attempts.' }, { 'retry-after': '60' }))

    const state = await signIn({ error: null, rateLimited: false, email: '' }, SIGN_IN)

    expect(state).toEqual({
      error: 'Too many attempts from this network. Try again in a minute.',
      rateLimited: true,
      email: 'ann@acme.test',
    })
  })

  it('rounds the hourly wait up to whole minutes', async () => {
    answer(problem(429, { type: TOO_MANY }, { 'retry-after': '3541' }))

    const state = await signIn({ error: null, rateLimited: false, email: '' }, SIGN_IN)

    expect(state.error).toBe('Too many attempts from this network. Try again in 60 minutes.')
  })

  it('never echoes the password on any refusal', async () => {
    answer(problem(429, { type: TOO_MANY }, { 'retry-after': '60' }))

    const state = await signIn({ error: null, rateLimited: false, email: '' }, SIGN_IN)

    expect(JSON.stringify(state)).not.toContain('Abc123!')
  })
})

describe('register', () => {
  const values = { inviteCode: 'ACME', firstName: 'Nia', lastName: 'New', email: 'nia@acme.test' }
  const empty = { error: null, errors: {}, values }

  it('keys a 409 onto the email field', async () => {
    answer(
      problem(409, {
        type: 'https://collega.dev/problems/conflict',
        detail: 'Email is already in use.',
      }),
    )

    const state = await register(empty, form({ ...values, password: 'Abc123!' }))

    expect(state.errors).toEqual({ email: 'Email is already in use.' })
    expect(state.values).toEqual(values)
  })

  it('answers a throttled registration with the form, keeping what was typed', async () => {
    answer(problem(429, { type: TOO_MANY }, { 'retry-after': '60' }))

    const state = await register(empty, form({ ...values, password: 'Abc123!' }))

    expect(state).toEqual({
      error: 'Too many attempts from this network. Try again in a minute.',
      errors: {},
      values,
    })
    expect(JSON.stringify(state)).not.toContain('Abc123!')
  })
})

describe('changePassword', () => {
  const passwords = form({
    currentPassword: 'Abc123!',
    newPassword: 'Xyz789?q',
    confirmPassword: 'Xyz789?q',
  })

  it('keeps the reader on the form when the service says the current password is wrong', async () => {
    answer(
      problem(401, {
        type: 'https://collega.dev/problems/unauthorized',
        detail: 'Current password is incorrect.',
      }),
    )

    const state = await changePassword({ error: null, errors: {} }, passwords)

    expect(state.errors).toEqual({ currentPassword: 'Current password is incorrect.' })
    expect(session.clearSession).not.toHaveBeenCalled()
  })

  it('sends the reader to sign in when the guard refuses the session', async () => {
    answer(problem(401, { type: 'https://tools.ietf.org/html/rfc9110#section-15.5.2' }))

    await expect(changePassword({ error: null, errors: {} }, passwords)).rejects.toThrow(
      'NEXT_REDIRECT /login?expired=1',
    )
  })

  it('drops the session after a change, because the stamp it carried is gone', async () => {
    answer(new Response(null, { status: 204 }))

    await expect(changePassword({ error: null, errors: {} }, passwords)).rejects.toThrow(
      'NEXT_REDIRECT /login?passwordChanged=1',
    )
    expect(session.clearSession).toHaveBeenCalledTimes(1)
  })

  it('answers the limiter with the form, not a crash', async () => {
    answer(problem(429, { type: TOO_MANY }, { 'retry-after': '120' }))

    const state = await changePassword({ error: null, errors: {} }, passwords)

    expect(state).toEqual({
      error: 'Too many attempts from this network. Try again in 2 minutes.',
      errors: {},
    })
  })
})
