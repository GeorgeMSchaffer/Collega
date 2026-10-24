import { expect, type Page, test } from '@playwright/test'
import { DEMO_PASSWORD } from '../seeded-accounts'
import { signIn } from './sign-in'

/**
 * The Tasks page (`SPEC/20-feature-task-backlog-and-sprint-planning.md` TB-8, TB-10), through a real
 * browser and the real API: the destination and its tabs, the one-board rule on "Move to sprint",
 * moving a task into a sprint, and what a Read Only reader is offered.
 *
 * **Pinecone Labs**, whose "Engineering" board is a work board with a Planned and an Active sprint.
 * The two-board case needs a second work board, which the seed does not have, so the spec makes one:
 * a new board that the seeded Ideas board's lane then references. Names carry a stamp because the
 * database is shared by the whole run. The tests run in order and the last one builds on the first
 * task it adds; none depends on another's outcome beyond the seed.
 */
const WORK_BOARD = 'Engineering'
const ADMIN = 'orgadmin@pinecone-labs.demo.collega.test'
const READ_ONLY = 'readonly@pinecone-labs.demo.collega.test'
const TIMEOUT = { timeout: 30_000 }

test.describe.configure({ mode: 'serial' })

async function engineeringBoardId(page: Page): Promise<string> {
  await page.goto(`/boards?q=${encodeURIComponent(WORK_BOARD)}`)
  const board = page
    .locator('a[href^="/boards/"]')
    .filter({ hasText: new RegExp(`^${WORK_BOARD}$`) })
  await expect(board).toBeVisible(TIMEOUT)
  const href = (await board.getAttribute('href')) ?? ''
  return href.replace('/boards/', '').split('?')[0] ?? ''
}

async function addTask(page: Page, boardId: string, title: string): Promise<void> {
  await page.goto(`/boards/${boardId}?tab=backlog&task=new`)
  const drawer = page.getByRole('complementary', { name: 'Add a task' })
  await expect(drawer).toBeVisible(TIMEOUT)
  await drawer.getByLabel(/^Title/).fill(title)
  await drawer.getByRole('button', { name: 'Add task' }).click()
  await expect(page).not.toHaveURL(/[?&]task=new/, TIMEOUT)
}

const taskRow = (page: Page, title: string) => page.getByRole('row').filter({ hasText: title })
const tab = (page: Page, name: string) =>
  page.getByRole('navigation', { name: 'Task views' }).getByRole('link', { name })

test.describe('an org admin on the Tasks page', () => {
  test('finds Tasks in the sidebar and sees the four tabs, opening on the Backlog', async ({
    page,
  }) => {
    await signIn(page, ADMIN, DEMO_PASSWORD)
    await page.getByRole('complementary').getByRole('link', { name: 'Tasks' }).click()
    await expect(page).toHaveURL(/\/tasks/, TIMEOUT)
    await expect(page.getByRole('heading', { name: 'Tasks' })).toBeVisible(TIMEOUT)

    await expect(tab(page, /^Backlog/)).toHaveAttribute('aria-current', 'page')
    for (const name of ['My tasks', 'In sprint', 'All']) {
      await expect(tab(page, name)).toBeVisible()
    }

    // Backlog rows are all unscheduled and name their board.
    const rows = page.getByRole('table').getByRole('row')
    await expect(rows.nth(1)).toBeVisible(TIMEOUT)
    await expect(
      page.getByRole('table').getByRole('row').filter({ hasText: WORK_BOARD }).first(),
    ).toBeVisible()
    await expect(
      page.getByRole('table').getByText('Backlog', { exact: true }).first(),
    ).toBeVisible()

    // In sprint: every row is in a named sprint, none sits in the Backlog.
    await tab(page, 'In sprint').click()
    await expect(page).toHaveURL(/tab=sprint/, TIMEOUT)
    await expect(tab(page, 'In sprint')).toHaveAttribute('aria-current', 'page')
    await expect(rows.nth(1)).toBeVisible(TIMEOUT)
    await expect(page.getByRole('table').getByText('Backlog', { exact: true })).toHaveCount(0)

    // All lists at least as many tasks as In sprint.
    await tab(page, 'All').click()
    await expect(tab(page, 'All')).toHaveAttribute('aria-current', 'page')
    await expect(rows.nth(1)).toBeVisible(TIMEOUT)
  })

  test('moves one task from the Backlog into a sprint', async ({ page }) => {
    const title = `e2e move ${Date.now()}`
    await signIn(page, ADMIN, DEMO_PASSWORD)
    await addTask(page, await engineeringBoardId(page), title)

    await page.goto('/tasks')
    const row = taskRow(page, title)
    await expect(row).toBeVisible(TIMEOUT)
    await expect(row.getByText('Backlog', { exact: true })).toBeVisible()

    const move = page.getByRole('button', { name: 'Move to sprint' })
    await expect(move).toHaveAttribute('aria-disabled', 'true')
    await expect(page.getByText('Select tasks to move.')).toBeVisible()

    await row.getByRole('checkbox').check()
    await expect(move).not.toHaveAttribute('aria-disabled', 'true')
    const sprint = page.getByLabel(`Sprint on ${WORK_BOARD}`)
    const chosen = (await sprint.locator('option').first().textContent())?.replace(/ \(.*\)$/, '')
    expect(chosen).toBeTruthy()
    await move.click()
    await expect(page.getByRole('status')).toContainText(`to ${chosen}.`, TIMEOUT)

    // Read back after a reload: gone from the Backlog, in the sprint, named there.
    await page.reload()
    await expect(taskRow(page, title)).toHaveCount(0)
    await tab(page, 'In sprint').click()
    const scheduled = taskRow(page, title)
    await expect(scheduled).toBeVisible(TIMEOUT)
    await expect(scheduled).toContainText(chosen ?? '')
  })

  test('disables Move to sprint, with the reason, for tasks from two boards', async ({ page }) => {
    const stamp = Date.now()
    const second = `e2e second ${stamp}`
    const first = `e2e first ${stamp}`
    const other = `e2e other ${stamp}`
    await signIn(page, ADMIN, DEMO_PASSWORD)

    // A second work board: a new board that a lane of the seeded Ideas board references.
    await page.goto('/settings/boards/new')
    await page.getByLabel(/^Name/).fill(second)
    await page.getByRole('button', { name: /^Create board/ }).click()
    await expect(page).toHaveURL(/\/settings\/boards(\?|$)/, TIMEOUT)
    await page.goto('/settings/boards')
    const ideasEdit = page
      .getByRole('row', { name: /^Ideas\b/ })
      .getByRole('link', { name: 'Edit' })
    await ideasEdit.click()
    await page
      .getByRole('combobox', { name: /^References board for / })
      .first()
      .selectOption({ label: second })
    await page.getByRole('button', { name: /^Save/ }).click()
    await expect(page).toHaveURL(/\/settings\/boards(\?|$)/, TIMEOUT)

    await page.goto('/boards')
    const board = page.locator('a[href^="/boards/"]').filter({ hasText: new RegExp(`^${second}$`) })
    await expect(board).toBeVisible(TIMEOUT)
    const secondId = ((await board.getAttribute('href')) ?? '')
      .replace('/boards/', '')
      .split('?')[0]
    await addTask(page, secondId ?? '', other)
    await addTask(page, await engineeringBoardId(page), first)

    await page.goto('/tasks')
    await expect(taskRow(page, other)).toBeVisible(TIMEOUT)
    await taskRow(page, first).getByRole('checkbox').check()
    await taskRow(page, other).getByRole('checkbox').check()

    const move = page.getByRole('button', { name: 'Move to sprint' })
    await expect(move).toHaveAttribute('aria-disabled', 'true')
    await expect(
      page.getByText(/Selected tasks are on 2 boards\. A sprint belongs to one board/),
    ).toBeVisible()
    await move.focus()
    await expect(move).toBeFocused()

    // Unticking the other board's task makes the move available again.
    await taskRow(page, other).getByRole('checkbox').uncheck()
    await expect(move).not.toHaveAttribute('aria-disabled', 'true')
  })
})

test.describe('a read only reader on the Tasks page', () => {
  test('sees the tasks and is offered no selection or sprint control', async ({ page }) => {
    await signIn(page, READ_ONLY, DEMO_PASSWORD)
    await page.goto('/tasks')
    await expect(page.getByRole('table')).toBeVisible(TIMEOUT)
    await expect(page.getByRole('checkbox')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Move to sprint' })).toHaveCount(0)
  })
})
