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

test.describe
  .serial('a deployment, from nothing', () => {
    test('1. the site admin creates an organization', async ({ page }) => {
      await signIn(page, SITE_ADMIN, DEMO_PASSWORD)

      await page.goto('/settings/organizations/new')
      await page.getByLabel(/name/i).fill(world.organization)
      await page.getByLabel(/description/i).fill('Created by the journey suite.')
      await page.getByRole('button', { name: /create organization/i }).click()

      await expect(page).toHaveURL(/\/settings\/organizations$/, { timeout: 30_000 })
      await expect(page.getByText(world.organization)).toBeVisible({ timeout: 30_000 })
    })

    test('2. the site admin creates an org admin inside it', async ({ page }) => {
      await signIn(page, SITE_ADMIN, DEMO_PASSWORD)

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

    test('8. the org admin edits the status catalog they were given', async ({ page }) => {
      await signIn(page, world.adminEmail, world.adminPasswordRotated)
      await page.goto('/settings/statuses')

      // **Expected to fail while Edit does nothing.** Every row carries an Edit control and none of
      // them is wired to anything — verified in a browser on 2026-09-14. Left failing deliberately:
      // it names the gap, and it turns green when the form exists rather than needing to be written
      // then.
      const edit = page.getByRole('button', { name: /^Edit / }).first()
      await expect(edit).toBeVisible({ timeout: 30_000 })

      const before = page.url()
      await edit.click()
      await page.waitForTimeout(800)
      const moved = page.url() !== before || (await page.locator('dialog[open]').count()) > 0
      expect(moved, 'Edit on the statuses catalog does nothing — no form is wired to it').toBe(true)
    })
  })
