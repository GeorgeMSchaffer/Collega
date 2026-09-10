import { cache } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { currentUser } from '@/lib/session'
import type { CurrentUser } from '@/lib/types'

/**
 * Where a synchronous principal is allowed to live.
 *
 * `lib/session.ts` reads identity out of a holder React's `cache` scopes to one render. Outside a
 * render there is no such scope, and the module falls back to a single process-wide object — which
 * is correct for this suite, where components are rendered with no request around them, and wrong
 * for a Server Function, where two people interleaving across an `await` would share one holder and
 * one of them would act with the other's organization id. So the fallback is opt-in, and `holder()`
 * throws until `allowProcessScope()` has been called.
 *
 * `test/setup.ts` calls it once for the whole suite, so the guard cannot be observed on the module
 * this file imported. It is observed on a second, untouched copy of the module instead — which is
 * also what keeps the suite-wide holder out of this test's way.
 */

const SOMEBODY: CurrentUser = {
  userId: 'demo-site-admin',
  displayName: 'Sam Deployment',
  initials: 'SD',
  role: 'SiteAdmin',
  roleLabel: 'Site Admin',
  organizationId: null,
  organizationName: null,
  viewingAs: null,
}

describe('the process-scope guard', () => {
  it('refuses to read or publish identity until a test opens the holder', async () => {
    vi.resetModules()
    const fresh = await import('@/lib/session')

    expect(() => fresh.currentUser()).toThrow(/outside a render scope/)
    expect(() => fresh.setCurrentUser(SOMEBODY)).toThrow(/outside a render scope/)

    fresh.allowProcessScope()

    // A different failure, and the distinction is the point: "nobody is signed in" is a wiring
    // mistake inside a request, while the message above is a Server Function reading a principal
    // it should have been passed.
    expect(() => fresh.currentUser()).toThrow(/No signed-in user for this request/)
    fresh.setCurrentUser(SOMEBODY)
    expect(fresh.currentUser()).toBe(SOMEBODY)

    // The identity published here went into that second instance's holder. The one every other
    // test reads is the module `test/setup.ts` opened, which this test never touched.
    expect(currentUser().role).toBe('OrgAdmin')
  })
})

describe('the request-scope probe', () => {
  it('finds no request scope in this environment, which is what the fallback is for', () => {
    // `inRequestScope()` asks React exactly this question — two calls to a `cache`d function
    // return the same object inside a render and different ones outside — and every gated
    // component test depends on the answer being "outside", via a React behaviour no public
    // documentation promises. If this ever flips, the guard above stops being reachable and the
    // suite starts reading a holder nothing published into.
    const probe = cache(() => ({}))
    expect(probe()).not.toBe(probe())
  })
})
