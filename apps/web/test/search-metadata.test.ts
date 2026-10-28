import { NextRequest } from 'next/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { metadata as changePassword } from '@/app/(auth)/change-password/page'
import { metadata as login } from '@/app/(auth)/login/page'
import { metadata as register } from '@/app/(auth)/register/page'
import { metadata as desk } from '@/app/(desk)/layout'
import robots from '@/app/robots'
import sitemap from '@/app/sitemap'
import { config, proxy } from '@/proxy'

/**
 * Search metadata (`SPEC/20-feature-analytics.md` requirements 4 and 5): sign-in and register are
 * the only crawlable pages, and the crawler files stay reachable without a session.
 */

afterEach(() => vi.unstubAllEnvs())

describe('robots.txt', () => {
  it('allows sign-in, register and privacy and disallows everything else', () => {
    const { rules } = robots()
    expect(rules).toEqual({
      userAgent: '*',
      allow: ['/login', '/register', '/privacy'],
      disallow: '/',
    })
  })

  it('names the sitemap on the production host', () => {
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', 'collega.example.test')
    expect(robots().sitemap).toBe('https://collega.example.test/sitemap.xml')
  })
})

describe('sitemap.xml', () => {
  it('lists sign-in, register and privacy and nothing else', () => {
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', 'collega.example.test')
    expect(sitemap().map((entry) => entry.url)).toEqual([
      'https://collega.example.test/login',
      'https://collega.example.test/register',
      'https://collega.example.test/privacy',
    ])
  })

  it('falls back to localhost when no production host is set', () => {
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', '')
    expect(sitemap()[0]?.url).toBe('http://localhost:3000/login')
  })
})

describe('proxy matcher and gate', () => {
  const matcher = new RegExp(`^${config.matcher[0]}$`)
  const runs = (path: string) => matcher.test(path)

  it('leaves /robots.txt and /sitemap.xml outside the proxy', () => {
    expect(runs('/robots.txt')).toBe(false)
    expect(runs('/sitemap.xml')).toBe(false)
  })

  it('still runs for the pages it guards', () => {
    for (const path of ['/', '/boards/abc', '/login', '/robots.txt/x', '/my-sitemap.xml']) {
      expect(runs(path)).toBe(true)
    }
  })

  it('sends a signed-out request for a desk page to sign-in', () => {
    const response = proxy(new NextRequest('https://collega.test/boards/abc'))
    expect(response.headers.get('location')).toBe('https://collega.test/login')
  })

  it('lets a signed-out crawler read the public pages through the gate', () => {
    for (const path of ['/login', '/register', '/privacy']) {
      expect(
        proxy(new NextRequest(`https://collega.test${path}`)).headers.get('location'),
      ).toBeNull()
    }
  })
})

describe('page metadata', () => {
  it('keeps every desk page out of search indexes', () => {
    expect(desk.robots).toEqual({ index: false, follow: false })
  })

  it('keeps change-password out of search indexes', () => {
    expect(changePassword.robots).toEqual({ index: false, follow: false })
  })

  it('gives sign-in its own title and description', () => {
    expect(login.title).toBe('Sign in · Collega')
    expect(login.description).toMatch(/^Sign in to Collega/)
  })

  it('gives register its own title and description', () => {
    expect(register.title).toBe('Create your account · Collega')
    expect(register.description).toMatch(/invite code/)
  })

  it('does not hide the public pages from search', () => {
    expect(login).not.toHaveProperty('robots')
    expect(register).not.toHaveProperty('robots')
  })
})
