import { expect, type Locator, type Page, test } from '@playwright/test'
import { SEEDED } from '../seeded-accounts'

/**
 * The Sprint board and the Roadmap (`SPEC/20-feature-issues-and-delivery.md`, "Comp R iteration").
 *
 * **Serial, and in this order, because the steps change the organization's sprints.** The seed gives
 * each organization an Active "Current sprint" and a Planned "Next sprint". Completing the first
 * makes the board offer the second with Start sprint; starting it leaves "Current sprint" Completed,
 * which is the only way the Roadmap's muted bar can be seen — the seed has no Completed sprint.
 */

const LANES = ['Pending', 'Scoping', 'Development', 'Review', 'Complete'] as const

const lane = (page: Page, name: string): Locator => page.getByRole('region', { name, exact: true })

/** The first card in a lane before Complete, with the lane it is in. */
async function firstUnfinishedCard(page: Page): Promise<{ title: string; from: string }> {
  for (const name of LANES.slice(0, 4)) {
    const cards = lane(page, name).locator('button[data-issue]')
    if ((await cards.count()) > 0) {
      return { title: (await cards.first().innerText()).trim(), from: name }
    }
  }
  throw new Error('The seeded sprint has no unfinished issue to move.')
}

test.describe
  .serial('the sprint board and the roadmap', () => {
    test.use({ storageState: SEEDED.orgAdmin.file })

    test('an issue moves lanes through the status select in its drawer', async ({ page }) => {
      await page.goto('/delivery/sprint')
      await expect(page.getByRole('heading', { level: 1, name: 'Current sprint' })).toBeVisible({
        timeout: 30_000,
      })
      await expect(page.getByText('● ACTIVE')).toBeVisible()

      const { title, from } = await firstUnfinishedCard(page)
      const to = from === 'Review' ? 'Scoping' : 'Review'

      await lane(page, from).getByRole('button', { name: title }).click()
      await expect(page).toHaveURL(/[?&]idea=[0-9a-f-]{36}/i, { timeout: 30_000 })
      const drawer = page.getByRole('complementary', { name: title })
      await expect(drawer).toBeVisible({ timeout: 30_000 })

      await drawer.getByLabel('Status').selectOption({ label: to })
      await expect(lane(page, to).getByRole('button', { name: title })).toBeVisible({
        timeout: 30_000,
      })

      // A write, so it survives a reload.
      await page.reload()
      await expect(lane(page, to).getByRole('button', { name: title })).toBeVisible({
        timeout: 30_000,
      })
      await expect(lane(page, from).getByRole('button', { name: title })).toHaveCount(0)
    })

    test('Add New Sprint checks its dates, then creates a planned sprint', async ({ page }) => {
      await page.goto('/delivery/sprint')
      await page.getByRole('button', { name: 'Plan next sprint' }).click()
      const form = page.getByRole('complementary', { name: 'Add New Sprint' })
      await expect(form).toBeVisible({ timeout: 30_000 })

      await form.getByRole('button', { name: 'Create sprint' }).click()
      await expect(form.getByText('Name is required.')).toBeVisible()

      const name = `E2E sprint ${Date.now()}`
      await form.getByLabel('Name').fill(name)
      await form.getByLabel('Start').fill('2099-02-10')
      await form.getByLabel('End').fill('2099-02-01')
      await form.getByRole('button', { name: 'Create sprint' }).click()
      await expect(form.getByText('End must be on or after the start.')).toBeVisible()

      await form.getByLabel('End').fill('2099-02-24')
      await form.getByRole('button', { name: 'Create sprint' }).click()
      await expect(page.getByRole('status').filter({ hasText: 'Sprint created' })).toBeVisible({
        timeout: 30_000,
      })
      await expect(form).toBeHidden()
    })

    test('completing the sprint shows the next planned one, which then starts', async ({
      page,
    }) => {
      await page.goto('/delivery/sprint')
      await expect(page.getByRole('heading', { level: 1, name: 'Current sprint' })).toBeVisible({
        timeout: 30_000,
      })

      await page.getByRole('button', { name: 'Complete sprint' }).click()
      const complete = page.getByRole('alertdialog', { name: 'Complete this sprint?' })
      await expect(complete).toContainText('unfinished issues return to the backlog')
      await complete.getByRole('button', { name: 'Complete sprint' }).click()
      await expect(
        page
          .getByRole('status')
          .filter({ hasText: /Sprint completed · \d+ issues? back in the backlog/ }),
      ).toBeVisible({ timeout: 30_000 })

      // No Active sprint now: the earliest Planned one is shown, with Start sprint in place of
      // Complete sprint. "Next sprint" starts well before the one the test above created.
      await expect(page.getByRole('heading', { level: 1, name: 'Next sprint' })).toBeVisible({
        timeout: 30_000,
      })
      await expect(page.getByText('PLANNED', { exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Complete sprint' })).toHaveCount(0)

      await page.getByRole('button', { name: 'Start sprint' }).click()
      const start = page.getByRole('alertdialog', { name: 'Start this sprint?' })
      await expect(start).toContainText('“Next sprint” becomes the running sprint')
      // Cancel is focused first, even though the action is not destructive.
      await expect(start.getByRole('button', { name: 'Cancel' })).toBeFocused()
      await start.getByRole('button', { name: 'Start sprint' }).click()
      await expect(page.getByRole('status').filter({ hasText: 'Sprint started' })).toBeVisible({
        timeout: 30_000,
      })

      await page.reload()
      await expect(page.getByRole('heading', { level: 1, name: 'Next sprint' })).toBeVisible({
        timeout: 30_000,
      })
      await expect(page.getByText('● ACTIVE')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Complete sprint' })).toBeVisible()
    })

    test('the roadmap zooms in the URL and draws the sprints', async ({ page }) => {
      await page.goto('/delivery/roadmap')
      await expect(page.getByRole('heading', { level: 1, name: 'Roadmap' })).toBeVisible({
        timeout: 30_000,
      })

      // Add New Outcome is shown, disabled, with its reason.
      const add = page.getByRole('button', { name: 'Add New Outcome' })
      await expect(add).toHaveAttribute('aria-disabled', 'true')
      const reason = await add.getAttribute('aria-describedby')
      await expect(page.locator(`#${String(reason)}`)).toHaveText(
        /Outcomes arrive in a later release/,
      )

      // Months is the default and stays out of the URL.
      const zoom = page.getByRole('group', { name: 'Zoom' })
      await expect(zoom.getByRole('button', { name: 'Months' })).toHaveAttribute(
        'aria-pressed',
        'true',
      )
      await zoom.getByRole('button', { name: 'Weeks' }).click()
      await expect(page).toHaveURL(/[?&]zoom=weeks/)
      await zoom.getByRole('button', { name: 'Quarters' }).click()
      await expect(page).toHaveURL(/[?&]zoom=quarters/)
      await zoom.getByRole('button', { name: 'Months' }).click()
      await expect(page).not.toHaveURL(/zoom=/)

      // And the URL sets it on a fresh load.
      await page.goto('/delivery/roadmap?zoom=weeks')
      await expect(zoom.getByRole('button', { name: 'Weeks' })).toHaveAttribute(
        'aria-pressed',
        'true',
        { timeout: 30_000 },
      )

      // The sprint started above is the Active row, and its bar opens the Sprint board. The one
      // completed above is still in the window, as a muted bar that goes nowhere.
      const sprints = page.getByRole('list', { name: 'Sprints' })
      await expect(sprints).toBeVisible({ timeout: 30_000 })
      const completed = sprints.getByRole('listitem').filter({ hasText: 'Current sprint' })
      await expect(completed).toContainText('Current sprint, completed')
      await expect(completed.getByRole('link')).toHaveCount(0)

      const active = sprints.getByRole('link', { name: /^Next sprint, .* open the Sprint board$/ })
      const activeInk = await active.evaluate((element) => getComputedStyle(element).color)
      const completedBar = completed.locator('[title^="Current sprint,"]')
      const completedInk = await completedBar.evaluate((element) => getComputedStyle(element).color)
      // Muted: the completed bar's text is not the ink the running sprint's bar carries.
      expect(completedInk).not.toBe(activeInk)

      await active.click()
      await expect(page).toHaveURL(/\/delivery\/sprint$/, { timeout: 30_000 })
      await expect(page.getByRole('heading', { level: 1, name: 'Next sprint' })).toBeVisible({
        timeout: 30_000,
      })
    })

    test('the roadmap says where outcomes will go', async ({ page }) => {
      await page.goto('/delivery/roadmap')
      await expect(page.getByRole('heading', { name: 'No outcomes yet' })).toBeVisible({
        timeout: 30_000,
      })
      await expect(page.getByText(/delivery issues? and nothing to group them by/)).toBeVisible()
      const first = page.getByRole('button', { name: 'Add the first outcome' })
      await expect(first).toHaveAttribute('aria-disabled', 'true')
    })
  })
