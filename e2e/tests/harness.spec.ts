import { expect, test } from '@playwright/test'

/**
 * The harness's own check - not product coverage.
 *
 * It asserts only what has to be true for any future spec to mean anything: Playwright starts
 * `apps/web`, a route renders server-side, and the route gate redirects. The product flows belong
 * to F2 and are written by QA, against real data rather than `lib/mock.ts`.
 *
 * Both tests are anonymous, and that bounds what the second one can say. `app/page.tsx` sends `/`
 * on to `/home`, but `apps/web/proxy.ts` runs first and bounces a request carrying no session
 * cookie to `/login` - so `/home` is not reachable from here, and asserting it was wrong from the
 * day the gate landed. Signing in to prove the other half needs a seeded account, which needs
 * `apps/api`; see README.md.
 *
 * Keep this file honest: if it ever needs a fixture or a login, it has stopped being a harness
 * check and belongs in a spec of its own.
 */
test.describe('e2e harness', () => {
  test('serves a server-rendered route', async ({ page }) => {
    const response = await page.goto('/login')

    expect(response?.status()).toBe(200)
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
    // The paired label/input from comp D - proof the page rendered rather than merely responded.
    await expect(page.getByLabel('Email')).toBeVisible()
  })

  test('sends an anonymous visitor from / to the sign-in form', async ({ page }) => {
    await page.goto('/')

    await expect(page).toHaveURL(/\/login$/)
  })
})
