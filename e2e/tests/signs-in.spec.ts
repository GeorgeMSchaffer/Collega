import { expect, test } from '@playwright/test'
import { signIn } from './sign-in'

/**
 * The first spec that could not have passed before F2.
 *
 * Everything in `harness.spec.ts` passes with no API running, because the login page renders from
 * nothing. This one signs in, and signing in requires the API, the database and the seed - so if
 * the second `webServer` entry ever stops working, this is the test that says so rather than a
 * later one failing for a reason that looks unrelated.
 *
 * The accounts are the seeded demo roster, whose password is published in `demo.md` and in
 * `scenario.ts`. That is safe here and only here: `global-setup.ts` refuses to seed anything but a
 * local `collega_e2e` schema.
 */
const ORG_ADMIN = 'orgadmin@acme-robotics.demo.collega.test'
const DEMO_PASSWORD = 'Abc123!'

test.describe('signing in', () => {
  test('an org admin reaches the application and sees their own organization', async ({ page }) => {
    // Off the login page is the assertion that matters: the redirect only happens once the API has
    // answered with a session, which needs a real row in a real database. `signIn` also tells a
    // rate-limited refusal from a wrong credential, which this spec used to report as a bare
    // timeout.
    await signIn(page, ORG_ADMIN, DEMO_PASSWORD)

    // Acme Robotics is seeded by `scenario.ts`. Its name on the page is data that travelled from
    // Postgres through the API to the browser - the whole path this slice exists to cover.
    await expect(page.getByText(/acme robotics/i).first()).toBeVisible({ timeout: 30_000 })
  })

  test('a wrong password is refused without saying whether the account exists', async ({
    page,
  }) => {
    await page.goto('/login')

    await page.getByLabel(/email/i).fill(ORG_ADMIN)
    await page.getByLabel(/password/i).fill('definitely-not-the-password')
    await page.getByRole('button', { name: /sign in/i }).click()

    await expect(page).toHaveURL(/\/login/)

    // One sentence for every refusal. `SIGN_IN_REFUSALS` in `apps/web/lib/server/auth-actions.ts`
    // masks 400, 401, 403 and 429 behind a single message on purpose, so a caller cannot learn from
    // the browser which accounts exist or which are locked. Asserting the mask is asserting that
    // decision, and it is the browser half of a control the API does not currently provide on its
    // own (`SPEC/decisions.md` 2026-09-13; the API is its own public host).
    //
    // "Incorrect", not "Invalid": the screen owns this sentence and the API's own wording is
    // different. Matching the API's text here would pass for the wrong reason the day the mask is
    // removed.
    //
    // If this fails with the element simply missing, read the alert that IS on the page before
    // suspecting the mask: the rate limiter renders its own sentence here, and a full suite run
    // exhausts the twenty-per-minute login bucket. That is how this failed on 2026-09-14.
    await expect(
      page.getByText('Incorrect email or password.'),
      'no masked refusal — if the page shows a different alert, this is the rate limiter, not the mask',
    ).toBeVisible({ timeout: 20_000 })
  })
})
