import { expect, test } from '@playwright/test'
import { SEEDED } from '../seeded-accounts'
import { signIn } from './sign-in'

/**
 * The demo path's first two steps, which had no UI at all until this spec's feature existed.
 *
 * `settings/organizations` and `settings/users` both rendered a button with no form behind it, so a
 * Site Admin signing in to a fresh deployment could do nothing whatsoever — the account belongs to
 * no organization, and there was no way to create one. That is what this covers.
 *
 * It runs as the seeded demo Site Admin. The seed creates organizations already, so this asserts
 * that a *new* one appears rather than that the list was empty.
 */
const SITE_ADMIN = 'siteadmin@demo.collega.test'
const DEMO_PASSWORD = 'Abc123!'

test.describe('creating an organization', () => {
  // The stored site-admin session: these are about the create form, not about signing in.
  test.use({ storageState: SEEDED.siteAdmin.file })

  test('a site admin creates one and it appears in the list', async ({ page }) => {
    // A name unique to this run: the suite reseeds, but asserting on a fixed name would pass for
    // the wrong reason if a create silently failed and a seeded row matched instead.
    const name = `Playwright Industries ${Date.now()}`

    await page.goto('/settings/organizations/new')
    await page.getByLabel(/name/i).fill(name)
    await page.getByLabel(/description/i).fill('Created by the E2E suite.')
    await page.getByRole('button', { name: /create organization/i }).click()

    await expect(page).toHaveURL(/\/settings\/organizations$/, { timeout: 30_000 })
    await expect(page.getByText(name)).toBeVisible({ timeout: 30_000 })
  })

  test('the empty form is refused by the API, and the refusal reaches the screen', async ({
    page,
  }) => {
    await page.goto('/settings/organizations/new')

    // `required` stops the browser submitting an empty field, so the way to reach the API's own
    // refusal is a value that passes the browser and fails the server. Whitespace does both:
    // `validateFields` trims before checking required.
    await page.getByLabel(/name/i).fill('   ')
    await page.getByLabel(/description/i).fill('   ')
    await page.getByRole('button', { name: /create organization/i }).click()

    // Still on the form, with the API's sentence rendered rather than swallowed. This is the whole
    // of the error handling these forms have, deliberately, so it is worth one assertion.
    await expect(page).toHaveURL(/\/settings\/organizations\/new$/)
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 20_000 })
  })
})

test.describe('creating a user', () => {
  // The org admin arrives from the stored session; the account this test creates signs in for real
  // below, which is the half that matters here.
  test.use({ storageState: SEEDED.orgAdmin.file })

  test('an org admin adds someone who can then sign in', async ({ page }) => {
    const email = `new.person.${Date.now()}@acme-robotics.demo.collega.test`
    const password = 'Str0ng!Pass'

    await page.goto('/settings/users/new')
    await page.getByLabel(/first name/i).fill('New')
    await page.getByLabel(/last name/i).fill('Person')
    await page.getByLabel(/^email$/i).fill(email)
    await page.getByLabel(/initial password/i).fill(password)
    await page.getByRole('button', { name: /create user/i }).click()

    await expect(page).toHaveURL(/\/settings\/users$/, { timeout: 30_000 })
    await expect(page.getByText(email)).toBeVisible({ timeout: 30_000 })

    // The half that matters for a demo: the account is real and usable. It is created with
    // `mustChangePassword`, so a successful sign-in lands on the change-password screen rather than
    // the desk — which is auth requirement 9 working, not a fault.
    //
    // Cookies rather than a sign-out route: the session is an httpOnly cookie on the Next origin
    // and there is no `GET /logout` to visit — signing out is a Server Action on a button. Clearing
    // the cookie is the same end state and does not depend on where that button happens to live.
    await page.context().clearCookies()
    await signIn(page, email, password)
    await expect(page).toHaveURL(/change-password/, { timeout: 30_000 })
  })
})
