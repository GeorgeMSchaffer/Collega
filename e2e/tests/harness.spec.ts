import { expect, test } from '@playwright/test'

/**
 * The harness's own check - not product coverage.
 *
 * It asserts only what has to be true for any future spec to mean anything: Playwright starts
 * `apps/web`, a route renders server-side, and client-side navigation works. The product flows
 * belong to F2 and are written by QA, against real data rather than `lib/mock.ts`.
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

  test('routes / to the desk', async ({ page }) => {
    await page.goto('/')

    await expect(page).toHaveURL(/\/home$/)
  })
})
