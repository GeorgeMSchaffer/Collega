import { expect, type Page, test } from '@playwright/test'
import { DEMO_PASSWORD } from '../seeded-accounts'
import { signIn } from './sign-in'

/**
 * Planning a sprint from a work board's Backlog (`SPEC/20-feature-task-backlog-and-sprint-planning.md`
 * TB-3, TB-4, TB-5, TB-10), through a real browser and the real API.
 *
 * **Pinecone Labs' "Engineering"**, as in `backlog-tasks.spec.ts`: a work board with sprints on.
 * Each test adds its own uniquely named tasks first, so it neither depends on nor disturbs the
 * seeded Backlog, and reads the outcome back after a reload: a ticked task that is in a sprint is no
 * longer in the Backlog, so a screen that only updated its own state fails here.
 */
const WORK_BOARD = 'Engineering'
const ADMIN = 'orgadmin@pinecone-labs.demo.collega.test'
const USER = 'user@pinecone-labs.demo.collega.test'

async function openBacklog(page: Page): Promise<void> {
  await page.goto(`/boards?q=${encodeURIComponent(WORK_BOARD)}`)
  const board = page
    .locator('a[href^="/boards/"]')
    .filter({ hasText: new RegExp(`^${WORK_BOARD}$`) })
  await expect(board).toBeVisible({ timeout: 30_000 })
  await board.click()
  await expect(
    page
      .getByRole('navigation', { name: 'Board sections' })
      .getByRole('link', { name: /^Backlog/ }),
  ).toHaveAttribute('aria-current', 'page', { timeout: 30_000 })
}

async function addTasks(page: Page, titles: string[]): Promise<void> {
  await page.getByRole('link', { name: '+ New task' }).first().click()
  const drawer = page.getByRole('complementary', { name: 'Add a task' })
  await expect(drawer).toBeVisible({ timeout: 30_000 })
  const title = drawer.getByLabel(/^Title/)
  for (const text of titles) {
    await title.fill(text)
    await drawer.getByRole('button', { name: 'Save and add another' }).click()
    await expect(title).toHaveValue('', { timeout: 30_000 })
  }
  await page.goto(page.url().replace(/[?&]task=new/, ''))
  await page.reload()
  for (const text of titles) {
    await expect(page.getByRole('row').filter({ hasText: text })).toBeVisible({ timeout: 30_000 })
  }
}

const row = (page: Page, title: string) => page.getByRole('row').filter({ hasText: title })
const tick = async (page: Page, title: string) => row(page, title).getByRole('checkbox').check()

test.describe('an org admin plans a sprint from the Backlog', () => {
  // One test, so one sign-in: the login limiter counts every extra one (see `AGENTS.md`).
  test('creates a sprint with the ticked tasks, then adds more to it', async ({ page }) => {
    const stamp = Date.now()
    const [one, two, left] = [
      `e2e sprint a ${stamp}`,
      `e2e sprint b ${stamp}`,
      `e2e unticked ${stamp}`,
    ]
    await signIn(page, ADMIN, DEMO_PASSWORD)
    await openBacklog(page)
    await addTasks(page, [one, two, left])

    await tick(page, one)
    await tick(page, two)
    await page.getByRole('button', { name: 'Add to new sprint…' }).click()

    const drawer = page.getByRole('complementary', { name: 'Create a sprint' })
    await expect(drawer).toBeVisible({ timeout: 30_000 })
    await expect(drawer.getByRole('checkbox', { name: new RegExp(one) })).toBeChecked()
    await expect(drawer.getByRole('checkbox', { name: new RegExp(two) })).toBeChecked()
    await expect(drawer.getByRole('checkbox', { name: new RegExp(left) })).not.toBeChecked()
    await drawer.getByLabel(/^Name/).fill(`E2E sprint ${stamp}`)
    await drawer.getByLabel(/^Start/).fill('2031-01-05')
    await drawer.getByLabel(/^End/).fill('2031-01-16')
    await drawer.getByRole('button', { name: 'Create sprint with 2 tasks' }).click()

    await expect(page.getByText('Sprint created with 2 tasks.')).toBeVisible({ timeout: 30_000 })
    await page.reload()
    await expect(row(page, left)).toBeVisible({ timeout: 30_000 })
    await expect(row(page, one)).toHaveCount(0)
    await expect(row(page, two)).toHaveCount(0)

    // Then more tasks into a sprint that exists.
    const [seed, extra, waiting] = [
      `e2e seed ${stamp}`,
      `e2e extra ${stamp}`,
      `e2e waiting ${stamp}`,
    ]
    await addTasks(page, [seed, extra, waiting])

    // A sprint to add to: created holding one task, so the bar has a sprint to name.
    const sprint = `E2E target ${stamp}`
    await tick(page, seed)
    await page.getByRole('button', { name: 'Add to new sprint…' }).click()
    const target = page.getByRole('complementary', { name: 'Create a sprint' })
    await target.getByLabel(/^Name/).fill(sprint)
    await target.getByLabel(/^Start/).fill('2031-02-02')
    await target.getByLabel(/^End/).fill('2031-02-13')
    await target.getByRole('button', { name: 'Create sprint with 1 task' }).click()
    await expect(page.getByText('Sprint created with 1 task.')).toBeVisible({ timeout: 30_000 })

    await tick(page, extra)
    const sprintSelect = page.getByLabel('Sprint to add to')
    if (await sprintSelect.count())
      await sprintSelect.selectOption({ label: `${sprint} (Planned)` })
    await page.getByRole('button', { name: `Add to ${sprint} (Planned)` }).click()
    await expect(page.getByText(`Added 1 task to ${sprint}.`)).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('region', { name: 'Selected tasks' })).toHaveCount(0)

    await page.reload()
    await expect(row(page, waiting)).toBeVisible({ timeout: 30_000 })
    await expect(row(page, extra)).toHaveCount(0)
    await expect(row(page, seed)).toHaveCount(0)
  })
})

test.describe('a user who is not an admin', () => {
  test('sees the Backlog with no checkboxes and no way to plan a sprint', async ({ page }) => {
    await signIn(page, USER, DEMO_PASSWORD)
    await openBacklog(page)
    await expect(page.getByRole('table')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('checkbox')).toHaveCount(0)
    await expect(page.getByRole('button', { name: /New sprint/ })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Add to new sprint/ })).toHaveCount(0)
  })
})

test.describe('an org admin plans a sprint on its page', () => {
  // One test, so one sign-in: the login limiter counts every extra one (see `AGENTS.md`).
  test('creates a planned sprint, adds a task, removes it, then starts the sprint', async ({
    page,
  }) => {
    const stamp = Date.now()
    const [spare, inline] = [`e2e spare ${stamp}`, `e2e inline ${stamp}`]
    const name = `E2E planning ${stamp}`
    await signIn(page, ADMIN, DEMO_PASSWORD)
    await openBacklog(page)
    await addTasks(page, [spare])

    // Sprints tab: create an empty Planned sprint.
    await page
      .getByRole('navigation', { name: 'Board sections' })
      .getByRole('link', { name: /^Sprints/ })
      .click()
    await page.getByRole('button', { name: '+ New sprint' }).click()
    const drawer = page.getByRole('complementary', { name: 'Create a sprint' })
    await expect(drawer).toBeVisible({ timeout: 30_000 })
    await drawer.getByLabel(/^Name/).fill(name)
    await drawer.getByLabel(/^Start/).fill('2032-01-05')
    await drawer.getByLabel(/^End/).fill('2032-01-16')
    await drawer.getByRole('button', { name: 'Create sprint', exact: true }).click()
    await expect(page.getByText('Sprint created with 0 tasks.')).toBeVisible({ timeout: 30_000 })

    const entry = page.getByRole('link', { name: new RegExp(name) })
    await expect(entry).toContainText('Planned')
    await expect(entry).toContainText('0 tasks')
    const waiting = page.getByRole('status').filter({ hasText: 'waiting in the Backlog' })
    await expect(waiting).toContainText(/\d+ tasks? waiting/)
    const before = Number((await waiting.innerText()).match(/\d+/)?.[0])

    // Planning page: add the spare task from the Backlog column.
    await entry.click()
    const backlog = page.getByRole('region', { name: 'Backlog' })
    const inSprint = page.getByRole('region', { name: 'In this sprint' })
    await expect(inSprint).toBeVisible({ timeout: 30_000 })
    await backlog.getByLabel('Search the Backlog').fill(spare)
    await backlog.getByRole('button', { name: new RegExp(`^Add .* to ${name}$`) }).click()
    await expect(inSprint.getByText(spare)).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('1 task in this sprint')).toBeVisible()
    await expect(backlog.getByText(spare)).toHaveCount(0)

    // Remove it: it goes back to the Backlog and the count drops.
    await inSprint.getByRole('button', { name: new RegExp(`^Remove .* from ${name}$`) }).click()
    await expect(page.getByText('0 tasks in this sprint')).toBeVisible({ timeout: 30_000 })
    await expect(inSprint.getByText(spare)).toHaveCount(0)
    await expect(backlog.getByText(spare)).toBeVisible()

    // The inline line creates a task straight into the sprint.
    await inSprint.getByLabel('New task title').fill(inline)
    await inSprint.getByRole('button', { name: 'Add task' }).click()
    await expect(inSprint.getByText(inline)).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('1 task in this sprint')).toBeVisible()

    // Start it.
    await page.getByRole('button', { name: 'Start sprint' }).click()
    await page
      .getByRole('alertdialog', { name: 'Start this sprint?' })
      .getByRole('button', { name: 'Start sprint' })
      .click()
    await expect(page.getByText(`${name} started.`)).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('button', { name: 'Start sprint' })).toHaveCount(0)

    // Back on the list: the sprint is Active with its task, and the Backlog count is as it was.
    await page.goto(page.url().replace(/\/sprints\/.*$/, '?tab=sprints'))
    const started = page.getByRole('link', { name: new RegExp(name) })
    await expect(started).toContainText('Active', { timeout: 30_000 })
    await expect(started).toContainText('1 task')
    expect(Number((await waiting.innerText()).match(/\d+/)?.[0])).toBe(before)
  })
})
