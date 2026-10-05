// Loaded before any test stubs NODE_ENV: React picks its development or production build on first
// load and keeps it, and the layout's JSX needs the development one.
import 'react/jsx-dev-runtime'
import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Where the idle component's inputs come from: the cookie's `exp` (`sessionRemainingMs`), the
 * desk layout that hands it over together with the development-only timing overrides, and the
 * login page that turns a query flag into the notice the other tabs are told.
 *
 * The server components are called as functions and the element tree they return is read; nothing
 * is rendered, so no request, router or API is involved.
 */

const cookieStore = vi.hoisted(() => ({ value: undefined as string | undefined }))

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === 'collega_session' && cookieStore.value !== undefined
        ? { name, value: cookieStore.value }
        : undefined,
  }),
}))
vi.mock('next/navigation', () => ({ redirect: vi.fn(), usePathname: () => '/' }))
vi.mock('@/lib/server/auth-actions', () => ({ signOut: vi.fn() }))
vi.mock('@/components/nav/sidebar', () => ({ Sidebar: () => null }))

const { sessionRemainingMs } = await import('@/lib/server/current-user')

const NOW = Date.parse('2026-10-01T09:00:00Z')

function tokenWith(payload: unknown): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `eyJhbGciOiJIUzI1NiJ9.${body}.signature`
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  cookieStore.value = undefined
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('sessionRemainingMs', () => {
  it('is the cookie exp claim minus now, in milliseconds', async () => {
    cookieStore.value = tokenWith({ exp: NOW / 1000 + 28_800 })
    expect(await sessionRemainingMs()).toBe(28_800_000)
  })

  it('goes negative for a token already past its exp', async () => {
    cookieStore.value = tokenWith({ exp: NOW / 1000 - 5 })
    expect(await sessionRemainingMs()).toBe(-5000)
  })

  it('is null with no session cookie', async () => {
    expect(await sessionRemainingMs()).toBeNull()
  })

  it('is null for a token without a payload segment', async () => {
    cookieStore.value = 'not-a-jwt'
    expect(await sessionRemainingMs()).toBeNull()
  })

  it('is null when the payload is not JSON', async () => {
    cookieStore.value = `a.${Buffer.from('{oops').toString('base64url')}.c`
    expect(await sessionRemainingMs()).toBeNull()
  })

  it.each([
    ['missing', {}],
    ['a string', { exp: '1790000000' }],
    ['null', { exp: null }],
  ])('is null when exp is %s', async (_label, payload) => {
    cookieStore.value = tokenWith(payload)
    expect(await sessionRemainingMs()).toBeNull()
  })
})

/** Finds the first element of `type` anywhere in a returned tree. */
function find(node: ReactNode, type: unknown): ReactElement<Record<string, unknown>> | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = find(child, type)
      if (hit) return hit
    }
    return null
  }
  if (!isValidElement(node)) return null
  const element = node as ReactElement<{ children?: ReactNode }>
  if (element.type === type) return element as ReactElement<Record<string, unknown>>
  return find(element.props.children, type)
}

describe('desk layout wiring of IdleSignOut', () => {
  async function idleProps() {
    // A signed-in cookie so the layout's own identity step is satisfied through the API stub.
    cookieStore.value = tokenWith({ exp: NOW / 1000 + 600 })
    vi.resetModules()
    vi.doMock('@/lib/server/current-user', () => ({
      requireCurrentUser: async () => ({ role: 'User' }),
      sessionRemainingMs: async () => 600_000,
    }))
    vi.doMock('@/lib/session-client', () => ({ SessionProvider: () => null }))
    vi.doMock('@/components/nav/view-as-banner', () => ({ ViewAsBanner: () => null }))
    const { default: DeskLayout } = await import('@/app/(desk)/layout')
    const { IdleSignOut: Idle } = await import('@/components/auth/idle-sign-out')
    const tree = await DeskLayout({ children: null })
    const element = find(tree, Idle)
    expect(element).not.toBeNull()
    return (element as ReactElement<Record<string, unknown>>).props
  }

  it('hands the cookie’s remaining lifetime to the idle component', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const props = await idleProps()
    expect(props.sessionRemainingMs).toBe(600_000)
  })

  it('applies the development timing overrides, converted from seconds', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('COLLEGA_DEV_IDLE_TIMEOUT_SECONDS', '45')
    vi.stubEnv('COLLEGA_DEV_IDLE_WARNING_SECONDS', '15')
    const props = await idleProps()
    expect(props.timeoutMs).toBe(45_000)
    expect(props.warningMs).toBe(15_000)
  })

  it.each([['production'], ['test']])('ignores both overrides when NODE_ENV is %s', async (env) => {
    vi.stubEnv('NODE_ENV', env)
    vi.stubEnv('COLLEGA_DEV_IDLE_TIMEOUT_SECONDS', '45')
    vi.stubEnv('COLLEGA_DEV_IDLE_WARNING_SECONDS', '15')
    const props = await idleProps()
    expect(props).not.toHaveProperty('timeoutMs')
    expect(props).not.toHaveProperty('warningMs')
  })

  it.each([['0'], ['-5'], ['soon'], ['']])(
    'ignores a development override of %j and keeps the default',
    async (value) => {
      vi.stubEnv('NODE_ENV', 'development')
      vi.stubEnv('COLLEGA_DEV_IDLE_TIMEOUT_SECONDS', value)
      vi.stubEnv('COLLEGA_DEV_IDLE_WARNING_SECONDS', value)
      const props = await idleProps()
      expect(props).not.toHaveProperty('timeoutMs')
      expect(props).not.toHaveProperty('warningMs')
    },
  )

  it('can override the warning alone', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('COLLEGA_DEV_IDLE_WARNING_SECONDS', '20')
    const props = await idleProps()
    expect(props).not.toHaveProperty('timeoutMs')
    expect(props.warningMs).toBe(20_000)
  })
})

describe('login page notice', () => {
  async function noticeFor(query: Record<string, string>) {
    vi.resetModules()
    const { default: LoginPage } = await import('@/app/(auth)/login/page')
    const { SessionEndedSignal: Signal } = await import('@/components/auth/session-ended-signal')
    const tree = await LoginPage({ searchParams: Promise.resolve(query) })
    return find(tree, Signal)?.props.notice
  }

  it('tells the other tabs "expired" when sent here by an expiry', async () => {
    expect(await noticeFor({ expired: '1' })).toBe('expired')
  })

  it('tells them "passwordChanged" for a completed password change', async () => {
    expect(await noticeFor({ passwordChanged: '1' })).toBe('passwordChanged')
  })

  it('prefers passwordChanged when both flags are present', async () => {
    expect(await noticeFor({ expired: '1', passwordChanged: '1' })).toBe('passwordChanged')
  })

  it('tells them nothing extra for an explicit sign-out', async () => {
    expect(await noticeFor({})).toBeNull()
  })

  it('does not treat the registered flag as a session ending with a notice', async () => {
    expect(await noticeFor({ registered: '1' })).toBeNull()
  })
})
