import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { routeTemplate } from '@/components/analytics/page-analytics'
import { analyticsEnabled } from '@/lib/server/analytics'

/**
 * The analytics switch (`SPEC/20-feature-analytics.md` requirement 6) and the page-view route
 * template (requirement 3): ids and the query never reach Vercel.
 */
const sdk = vi.hoisted(() => ({
  beforeSend: undefined as undefined | ((event: { url: string }) => { url: string }),
  track: vi.fn(),
}))
vi.mock('@vercel/analytics/next', () => ({
  Analytics: (props: { beforeSend: typeof sdk.beforeSend }) => {
    sdk.beforeSend = props.beforeSend
    return null
  },
}))
vi.mock('@vercel/analytics', () => ({ track: sdk.track }))
vi.mock('@vercel/analytics/server', () => ({ track: vi.fn() }))

const ID = '3f2b8c1e-9d4a-4e7b-8a61-0c5d2f9e7b34'
const OTHER = 'A1B2C3D4-0000-4000-8000-ABCDEF012345'

afterEach(() => {
  vi.unstubAllEnvs()
  cleanup()
})

describe('analyticsEnabled', () => {
  beforeEach(() => {
    vi.stubEnv('VERCEL_ENV', '')
    vi.stubEnv('COLLEGA_ANALYTICS', '')
  })

  it('is off with neither switch set', () => {
    expect(analyticsEnabled()).toBe(false)
  })

  it('is on in a production deployment', () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    expect(analyticsEnabled()).toBe(true)
  })

  it.each(['preview', 'development'])('is off in a %s deployment', (env) => {
    vi.stubEnv('VERCEL_ENV', env)
    expect(analyticsEnabled()).toBe(false)
  })

  it('is on anywhere when COLLEGA_ANALYTICS is on', () => {
    vi.stubEnv('VERCEL_ENV', 'preview')
    vi.stubEnv('COLLEGA_ANALYTICS', 'on')
    expect(analyticsEnabled()).toBe(true)
  })

  it.each(['off', 'true', '1', 'ON'])('does not treat COLLEGA_ANALYTICS=%s as on', (value) => {
    vi.stubEnv('COLLEGA_ANALYTICS', value)
    expect(analyticsEnabled()).toBe(false)
  })
})

describe('routeTemplate', () => {
  it('turns a GUID path segment into [id]', () => {
    expect(routeTemplate(`https://collega.test/boards/${ID}`)).toBe(
      'https://collega.test/boards/[id]',
    )
  })

  it('replaces every id in the path, in any letter case', () => {
    expect(routeTemplate(`https://collega.test/organizations/${ID}/boards/${OTHER}`)).toBe(
      'https://collega.test/organizations/[id]/boards/[id]',
    )
  })

  it('drops the query, which can name an idea', () => {
    expect(routeTemplate(`https://collega.test/boards/${ID}?idea=${OTHER}&q=secret`)).toBe(
      'https://collega.test/boards/[id]',
    )
  })

  it('drops the hash', () => {
    expect(routeTemplate('https://collega.test/ideas#comment-7')).toBe('https://collega.test/ideas')
  })

  it('leaves a path with no id untouched', () => {
    expect(routeTemplate('https://collega.test/settings/tags')).toBe(
      'https://collega.test/settings/tags',
    )
  })

  it('does not mistake a word or a partial GUID for an id', () => {
    expect(routeTemplate(`https://collega.test/boards/${ID}-x/abc-def`)).toBe(
      `https://collega.test/boards/${ID}-x/abc-def`,
    )
  })
})

describe('PageAnalytics beforeSend', () => {
  it('rewrites the event url to the route template and keeps its other fields', async () => {
    const { PageAnalytics } = await import('@/components/analytics/page-analytics')
    render(<PageAnalytics />)
    const out = sdk.beforeSend?.({
      type: 'pageview',
      url: `https://c.test/boards/${ID}?idea=${OTHER}`,
    } as never)
    expect(out).toEqual({ type: 'pageview', url: 'https://c.test/boards/[id]' })
  })
})
