import { expect, type Page, test } from '@playwright/test'
import { DEMO_PASSWORD } from '../seeded-accounts'
import { signIn } from './sign-in'

/**
 * A work board's Backlog and "+ New task" (`SPEC/20-feature-task-backlog-and-sprint-planning.md`
 * TB-1, TB-2, TB-10), through a real browser and the real API.
 *
 * **Pinecone Labs, not the Acme roster.** The Acme demo organization has no work board (a board that
 * some other board's lane references); the seeded verticals do, and Pinecone's "Engineering" is one.
 * So this spec signs in as that organization's own accounts, which costs two sign-ins beyond the
 * stored sessions (see `AGENTS.md` on the login limiter).
 *
 * Each task is read back from the Backlog after a reload, so a drawer that only updated its own
 * state fails here. The tasks keep unique names because the database is shared by the whole run.
 */
const WORK_BOARD = 'Engineering'
const ADMIN = 'orgadmin@pinecone-labs.demo.collega.test'
const READ_ONLY = 'readonly@pinecone-labs.demo.collega.test'

async function openBacklog(page: Page): Promise<void> {
  await page.goto(`/boards?q=${encodeURIComponent(WORK_BOARD)}`)
  const board = page
    .locator('a[href^="/boards/"]')
    .filter({ hasText: new RegExp(`^${WORK_BOARD}$`) })
  await expect(board).toBeVisible({ timeout: 30_000 })
  await board.click()
  await expect(page).toHaveURL(/\/boards\/[0-9a-f-]+/i, { timeout: 30_000 })
  // A work board opens on its Backlog.
  await expect(page.getByRole('link', { name: /^Backlog/ })).toHaveAttribute(
    'aria-current',
    'page',
    { timeout: 30_000 },
  )
}

test.describe('an org admin adds tasks to a work board', () => {
  test('a standalone task and a parented task both land in the Backlog', async ({ page }) => {
    const stamp = Date.now()
    const standalone = `e2e standalone ${stamp}`
    const parented = `e2e parented ${stamp}`

    await signIn(page, ADMIN, DEMO_PASSWORD)
    await openBacklog(page)
    await expect(page.getByRole('link', { name: 'Sprints' })).toBeVisible()

    // Standalone, with "Save and add another": the drawer stays open on an empty Title.
    await page.getByRole('link', { name: '+ New task' }).first().click()
    const drawer = page.getByRole('complementary', { name: 'Add a task' })
    await expect(drawer).toBeVisible({ timeout: 30_000 })
    const title = drawer.getByLabel(/^Title/)
    await title.fill(standalone)
    await drawer.getByRole('button', { name: 'Save and add another' }).click()
    await expect(title).toHaveValue('', { timeout: 30_000 })
    await expect(title).toBeFocused()

    // Parented: the parent choices are the reference-lane ideas the server would accept.
    const parent = drawer.getByLabel(/^Parent idea/)
    const choices = await parent.locator('option').allTextContents()
    expect(choices.length).toBeGreaterThan(1)
    expect(choices[0]).toBe('No parent (standalone task)')
    await title.fill(parented)
    await parent.selectOption({ index: 1 })
    const [parentKey] = (choices[1] ?? '').split(' · ')
    await drawer.getByRole('button', { name: 'Add task' }).click()
    await expect(page).not.toHaveURL(/[?&]task=new/, { timeout: 30_000 })

    // Both, after a reload; the standalone one marked as such, the parented one under its parent.
    await page.reload()
    const standaloneRow = page.getByRole('row').filter({ hasText: standalone })
    const parentedRow = page.getByRole('row').filter({ hasText: parented })
    await expect(standaloneRow).toBeVisible({ timeout: 30_000 })
    await expect(standaloneRow.getByText('standalone')).toBeVisible()
    await expect(parentedRow).toBeVisible()
    await expect(parentedRow.getByText('standalone')).toHaveCount(0)
    if (parentKey && choices[1]?.includes(' · ')) {
      await expect(parentedRow.getByText(parentKey)).toBeVisible()
    }

    // The search narrows to one of them.
    await page.getByRole('searchbox', { name: 'Search tasks' }).fill(`parented ${stamp}`)
    await expect(standaloneRow).toHaveCount(0)
    await expect(parentedRow).toBeVisible()
  })

  test('a title is required', async ({ page }) => {
    await signIn(page, ADMIN, DEMO_PASSWORD)
    await openBacklog(page)
    await page.getByRole('link', { name: '+ New task' }).first().click()
    const drawer = page.getByRole('complementary', { name: 'Add a task' })
    await drawer.getByRole('button', { name: 'Add task' }).click()
    await expect(drawer.getByText('Title is required.')).toBeVisible()
    await expect(page).toHaveURL(/[?&]task=new/)
  })
})

test.describe('a read only reader', () => {
  test('sees the Backlog and is offered no + New task', async ({ page }) => {
    await signIn(page, READ_ONLY, DEMO_PASSWORD)
    await openBacklog(page)
    await expect(page.getByRole('table')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('link', { name: '+ New task' })).toHaveCount(0)
    await expect(page.getByRole('checkbox')).toHaveCount(0)
  })
})
