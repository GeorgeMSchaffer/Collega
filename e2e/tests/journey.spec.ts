import { expect, type Page, test } from '@playwright/test'

/**
 * The product built from nothing, by one person, in order.
 *
 * **Why this file exists, and why the specs beside it were not enough.** Every other spec signs in
 * as an account the seed created, into an organization the seed created, with boards and statuses
 * the seed created. They prove the machinery works on a world that was already built — which is how
 * a suite can be entirely green while a Site Admin signing in to a real deployment can do almost
 * nothing. The seed is not available in production: `db:seed` refuses to run when
 * `NODE_ENV=production`, so what a real deployment has on day one is a bootstrap Site Admin and an
 * empty database.
 *
 * So nothing below touches a seeded account or a seeded record. Each test uses only what an earlier
 * test in this file created, and the run order is the order a person would actually work in. If any
 * link in that chain is a control that does nothing, the chain stops there — which is the point.
 * These are meant to fail loudly while the product is incomplete, and to name the exact step.
 *
 * `test.describe.serial` because the dependency is real: there is no organization to add a user to
 * until the first test has made one. A failure stops the rest rather than reporting five failures
 * that are all the first one.
 */

const DEMO_PASSWORD = 'Abc123!'
const SITE_ADMIN = 'siteadmin@demo.collega.test'

/** One run's world, built as the tests go and read by the ones after. */
const world = {
  organization: `Journey Co ${Date.now()}`,
  adminEmail: `journey.admin.${Date.now()}@journey.test`,
  adminPassword: 'Journey!Admin1',
  adminPasswordRotated: 'Journey!Admin2',
  memberEmail: `journey.member.${Date.now()}@journey.test`,
  memberPassword: 'Journey!Member1',
  board: `Journey Board ${Date.now()}`,
  idea: `Journey idea ${Date.now()}`,
}

async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.context().clearCookies()
  await page.goto('/login')
  await page.getByLabel(/email/i).fill(email)
  await page.getByLabel(/password/i).fill(password)
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page, `sign-in failed for ${email}`).not.toHaveURL(/\/login/, { timeout: 30_000 })
}

/**
 * Signs in with the credential an administrator set, clears the forced first-time change, and
 * signs in again with the new one.
 *
 * **The second sign-in is not belt and braces.** Changing a password rotates the user's security
 * stamp, and `TokenAuthenticationService` rejects every token whose stamp no longer matches — so
 * the act of changing it ends the session that changed it, and the app returns to the login screen
 * saying "Your password was changed. Please sign in with your new password." That is the intended
 * behaviour and a good one: it is the same mechanism that kills every outstanding session when an
 * admin issues a temporary password. A helper that assumed the session survived is what this
 * originally had, and it failed here rather than in production, which is the point.
 */
async function signInAndRotate(page: Page, email: string, from: string, to: string): Promise<void> {
  await signIn(page, email, from)
  if (/change-password/.test(page.url())) {
    await page.getByLabel(/current password/i).fill(from)
    await page.getByLabel(/^new password$/i).fill(to)
    await page.getByLabel(/confirm new password/i).fill(to)
    await page.getByRole('button', { name: /change password|save|update/i }).click()
    await expect(page).toHaveURL(/\/login/, { timeout: 30_000 })
    await signIn(page, email, to)
  }
}

/**
 * The picker row for one person, addressed by email.
 *
 * **Not by display name.** Every run creates a "Journey Member", so after a few runs the name
 * matches several rows and Playwright refuses the ambiguity - correctly. The email carries this
 * run's timestamp and is the only unique thing on the row, which is also why the picker shows it.
 */
/**
 * Signs in as the site admin, as themselves.
 *
 * **A View As session outlives the sign-out that follows it.** It is a server-side row keyed on the
 * real user, not anything in the cookie — which is the security property that makes the whole
 * feature safe, and also means signing out and back in leaves you still acting as somebody. A
 * previous run of this file left a session open and the next run's site admin arrived already
 * impersonating, which is how this was found.
 *
 * So the session is ended first, unconditionally. `DELETE /auth/view-as` is idempotent by contract,
 * so this costs one request and never needs to ask whether there is anything to end.
 */
async function signInAsSelf(page: Page): Promise<void> {
  await signIn(page, SITE_ADMIN, DEMO_PASSWORD)
  const banner = page.getByRole('alert').filter({ hasText: /viewing as/i })
  if ((await banner.count()) > 0) {
    await page.getByRole('button', { name: /stop viewing as/i }).click()
    await expect(banner).toHaveCount(0, { timeout: 30_000 })
  }
}

function viewAsRowFor(page: Page, email: string) {
  return page.locator('li').filter({ hasText: email })
}

test.describe
  .serial('a deployment, from nothing', () => {
    test('1. the site admin creates an organization', async ({ page }) => {
      await signInAsSelf(page)

      await page.goto('/settings/organizations/new')
      await page.getByLabel(/name/i).fill(world.organization)
      await page.getByLabel(/description/i).fill('Created by the journey suite.')
      await page.getByRole('button', { name: /create organization/i }).click()

      await expect(page).toHaveURL(/\/settings\/organizations$/, { timeout: 30_000 })
      await expect(page.getByText(world.organization)).toBeVisible({ timeout: 30_000 })
    })

    test('2. the site admin creates an org admin inside it', async ({ page }) => {
      await signInAsSelf(page)

      await page.goto('/settings/users/new')

      // A Site Admin belongs to no organization, so the form must ask which one. This is the step the
      // page refused outright until 2026-09-14, sending them to View As instead — which does not exist.
      await page.getByLabel(/organization/i).selectOption({ label: world.organization })

      await page.getByLabel(/first name/i).fill('Journey')
      await page.getByLabel(/last name/i).fill('Admin')
      await page.getByLabel(/^email$/i).fill(world.adminEmail)
      await page.getByLabel(/role/i).selectOption('OrgAdmin')
      await page.getByLabel(/initial password/i).fill(world.adminPassword)
      await page.getByRole('button', { name: /create user/i }).click()

      await expect(page).toHaveURL(/\/settings\/users$/, { timeout: 30_000 })
    })

    test('3. that org admin signs in and rotates the forced password', async ({ page }) => {
      await signInAndRotate(page, world.adminEmail, world.adminPassword, world.adminPasswordRotated)

      // Their own organization, not the seed's — the whole point of building the world here.
      await expect(page.getByText(world.organization).first()).toBeVisible({ timeout: 30_000 })
    })

    test('4. the org admin adds a member to their own organization', async ({ page }) => {
      await signIn(page, world.adminEmail, world.adminPasswordRotated)

      await page.goto('/settings/users/new')
      await page.getByLabel(/first name/i).fill('Journey')
      await page.getByLabel(/last name/i).fill('Member')
      await page.getByLabel(/^email$/i).fill(world.memberEmail)
      await page.getByLabel(/role/i).selectOption('User')
      await page.getByLabel(/initial password/i).fill(world.memberPassword)
      await page.getByRole('button', { name: /create user/i }).click()

      await expect(page).toHaveURL(/\/settings\/users$/, { timeout: 30_000 })
      await expect(page.getByText(world.memberEmail)).toBeVisible({ timeout: 30_000 })
    })

    test('5. the org admin creates a board', async ({ page }) => {
      await signIn(page, world.adminEmail, world.adminPasswordRotated)

      await page.goto('/settings/boards/new')
      await page.getByLabel(/name/i).fill(world.board)
      await page.getByRole('button', { name: /create board/i }).click()

      await expect(page).toHaveURL(/\/settings\/boards$/, { timeout: 30_000 })

      // Creating an organization provisions its default statuses, which is what makes a board possible
      // at all — a board needs at least two to become its swimlanes.
      await page.goto('/boards')
      await expect(page.getByText(world.board)).toBeVisible({ timeout: 30_000 })
    })

    test('6. the member signs in and authors an idea on that board', async ({ page }) => {
      await signInAndRotate(
        page,
        world.memberEmail,
        world.memberPassword,
        world.memberPassword + 'x',
      )

      await page.goto('/boards')
      await page.getByRole('link', { name: world.board }).click()
      await expect(page).toHaveURL(/\/boards\/[0-9a-f-]+$/i, { timeout: 30_000 })

      await page.getByRole('button', { name: /new idea/i }).click()
      await page.getByLabel(/title/i).fill(world.idea)
      await page.getByLabel(/description/i).fill('Authored by the journey suite.')
      await page
        .getByRole('button', { name: /create|add idea|save/i })
        .last()
        .click()

      await expect(page.getByText(world.idea)).toBeVisible({ timeout: 30_000 })
    })

    test('7. the idea moves through the statuses and stays moved', async ({ page }) => {
      await signIn(page, world.memberEmail, world.memberPassword + 'x')

      await page.goto('/boards')
      await page.getByRole('link', { name: world.board }).click()

      const right = page.getByRole('button', { name: `Move ${world.idea} one lane right` })
      await expect(right).toBeVisible({ timeout: 30_000 })
      await right.click()
      await page.waitForTimeout(600)

      // Survives a reload, so it is a write rather than a client-side reorder.
      await page.reload()
      await expect(page.getByText(world.idea).first()).toBeVisible({ timeout: 30_000 })

      // And it can keep going: the left control now exists, which it would not in the first lane.
      await expect(
        page.getByRole('button', { name: `Move ${world.idea} one lane left` }),
      ).toBeVisible({ timeout: 30_000 })
    })

    test('8. the site admin views as the member, and the banner says so', async ({ page }) => {
      await signInAsSelf(page)

      await page.goto('/settings/view-as')

      // The member this journey created, not a seeded one.
      const button = viewAsRowFor(page, world.memberEmail).getByRole('button', { name: /view as/i })
      await expect(button).toBeVisible({ timeout: 30_000 })
      await button.click()

      // Landing on home is the point: acting as someone is a change of vantage, so the first thing
      // shown is what they see.
      await expect(page).toHaveURL(/\/home/, { timeout: 30_000 })

      // The banner is the control that stops somebody misreading the whole product. It names who they
      // are acting as and who they really are, and it is an `alert` so a screen reader interrupts.
      const banner = page.getByRole('alert').filter({ hasText: /viewing as/i })
      await expect(banner).toBeVisible({ timeout: 30_000 })
      await expect(banner).toContainText('Journey Member')

      // And the session is real: the organization now shown is the member's, which the site admin
      // has none of on their own.
      await expect(page.getByText(world.organization).first()).toBeVisible({ timeout: 30_000 })
    })

    test('9. stopping returns the site admin to themselves', async ({ page }) => {
      await signInAsSelf(page)
      await page.goto('/settings/view-as')
      await viewAsRowFor(page, world.memberEmail)
        .getByRole('button', { name: /view as/i })
        .click()
      await expect(page).toHaveURL(/\/home/, { timeout: 30_000 })

      await page.getByRole('button', { name: /stop viewing as/i }).click()

      // The banner goes, and it goes because the server ended the session rather than because a
      // client hid it -- `/auth/me` is what the next render reads.
      await expect(page.getByRole('alert').filter({ hasText: /viewing as/i })).toHaveCount(0, {
        timeout: 30_000,
      })
    })

    test('10. the org admin renames a status and the board follows', async ({ page }) => {
      await signIn(page, world.adminEmail, world.adminPasswordRotated)
      await page.goto('/settings/statuses')

      // By position rather than by name: this organization's catalog is whatever creating it
      // provisioned, and pinning a default status's name here would make this spec fail the day
      // that default changes for reasons having nothing to do with renaming.
      const edit = page.getByRole('link', { name: /^Edit / }).first()
      await expect(edit).toBeVisible({ timeout: 30_000 })

      const original = ((await edit.getAttribute('aria-label')) ?? '').replace(/^Edit /, '')
      expect(original, 'the Edit control should name the status it edits').not.toBe('')

      await edit.click()
      await expect(page.getByLabel('Name')).toHaveValue(original)

      const renamed = `Renamed ${String(Date.now())}`
      await page.getByLabel('Name').fill(renamed)
      await page.getByRole('button', { name: 'Save changes' }).click()

      // Back on the list, and carrying the new name — proving the write landed rather than that the
      // form navigated.
      await expect(page).toHaveURL(/\/settings\/statuses$/)
      await expect(page.getByRole('cell', { name: renamed, exact: true })).toBeVisible()

      // And the lane header on the board, which is the reason a rename matters: statuses are the
      // columns, so a catalog change that did not reach them would be a rename in name only.
      await page.goto('/boards')
      await page.locator('a[href^="/boards/"]').first().click()
      await expect(page.getByText(renamed).first()).toBeVisible()
    })
  })
