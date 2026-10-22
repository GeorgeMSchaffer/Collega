import { expect, type Locator, type Page, test } from '@playwright/test'
import { DEMO_PASSWORD } from '../seeded-accounts'
import { signIn } from './sign-in'

/**
 * One path across every surface of the task backlog and sprint planning
 * (`SPEC/20-feature-task-backlog-and-sprint-planning.md` TB-1 to TB-10, slice 337), through a real
 * browser and the real API, as Pinecone Labs' Org Admin.
 *
 * Backlog (add tasks) -> Sprints tab (create a sprint with a ticked task) -> planning page (Add,
 * Remove) -> the parent idea's drawer ("Schedule…") -> Tasks page (In sprint) -> board panel (drop on
 * a lane under the seeded Active sprint).
 *
 * **Named `z-` and run last**: it creates a sprint and moves tasks into the Active one, which the
 * other specs' sprint assertions would otherwise have to tolerate. It is one test, so one sign-in
 * (the login limiter punishes extra ones; see `AGENTS.md`). It never opens `/delivery/sprint`.
 * Every task carries the run's stamp because the database is shared by the whole run.
 */
const WORK_BOARD = 'Engineering'
const ADMIN = 'orgadmin@pinecone-labs.demo.collega.test'
const TIMEOUT = { timeout: 30_000 }

const listRow = (page: Page, title: string) => page.getByRole('row').filter({ hasText: title })
const item = (page: Page, list: string, title: string) =>
  page.getByRole('list', { name: list }).getByRole('listitem').filter({ hasText: title })

async function openWorkBoard(page: Page): Promise<string> {
  await page.goto(`/boards?q=${encodeURIComponent(WORK_BOARD)}`)
  const board = page
    .locator('a[href^="/boards/"]')
    .filter({ hasText: new RegExp(`^${WORK_BOARD}$`) })
  await expect(board).toBeVisible(TIMEOUT)
  await board.click()
  await expect(
    page
      .getByRole('navigation', { name: 'Board sections' })
      .getByRole('link', { name: /^Backlog/ }),
  ).toHaveAttribute('aria-current', 'page', TIMEOUT)
  return new URL(page.url()).pathname.replace('/boards/', '')
}

async function addTask(page: Page, title: string, parent: 'standalone' | 'first'): Promise<string> {
  await page.getByRole('link', { name: '+ New task' }).first().click()
  const drawer = page.getByRole('complementary', { name: 'Add a task' })
  await expect(drawer).toBeVisible(TIMEOUT)
  let parentKey = ''
  // The drawer can hydrate after the first keystrokes and drop them, so fill and submit are retried
  // together until the drawer closes.
  await expect(async () => {
    await drawer.getByLabel(/^Title/).fill(title)
    if (parent === 'first') {
      const select = drawer.getByLabel(/^Parent idea/)
      const choice = (await select.locator('option').nth(1).textContent()) ?? ''
      parentKey = choice.split(' · ')[0] ?? ''
      await select.selectOption({ index: 1 })
    }
    await drawer.getByRole('button', { name: 'Add task' }).click()
    await expect(page).not.toHaveURL(/[?&]task=new/, { timeout: 5_000 })
  }).toPass({ timeout: 30_000 })
  await expect(listRow(page, title)).toBeVisible(TIMEOUT)
  return parentKey
}

const waiting = async (page: Page): Promise<number> => {
  const text = await page
    .getByRole('status')
    .filter({ hasText: /waiting in the Backlog/ })
    .innerText()
  return Number(text.match(/\d+/)?.[0])
}

test('a task goes from the Backlog to a sprint by every route', async ({ page }) => {
  test.setTimeout(180_000)
  const stamp = Date.now()
  const title = (name: string) => `e2e path ${name} ${stamp}`
  const [standalone, kept, scheduled, added, dropped] = [
    title('standalone'),
    title('kept'),
    title('scheduled'),
    title('added'),
    title('dropped'),
  ]
  const sprint = `E2E path ${stamp}`

  // The earlier specs' sign-ins can still be inside the limiter's minute: wait it out once.
  await signIn(page, ADMIN, DEMO_PASSWORD).catch(async (error: Error) => {
    if (!error.message.includes('RATE LIMITED')) throw error
    await page.waitForTimeout(60_000)
    await signIn(page, ADMIN, DEMO_PASSWORD)
  })
  const boardId = await openWorkBoard(page)

  // TB-1, TB-2: a standalone task and parented tasks land in the Backlog.
  await addTask(page, standalone, 'standalone')
  await addTask(page, kept, 'standalone')
  await addTask(page, added, 'standalone')
  await addTask(page, dropped, 'standalone')
  const parentKey = await addTask(page, scheduled, 'first')
  expect(parentKey).not.toBe('')
  await expect(listRow(page, scheduled).getByText(parentKey)).toBeVisible()
  await expect(listRow(page, standalone).getByText('standalone', { exact: true })).toBeVisible()

  // TB-3, TB-4: the Sprints tab creates a sprint holding the ticked task; the waiting count follows.
  await page
    .getByRole('navigation', { name: 'Board sections' })
    .getByRole('link', { name: 'Sprints' })
    .click()
  await expect(page).toHaveURL(/tab=sprints/, TIMEOUT)
  const before = await waiting(page)
  await page.getByRole('button', { name: '+ New sprint' }).click()
  const create = page.getByRole('complementary', { name: 'Create a sprint' })
  await expect(create).toBeVisible(TIMEOUT)
  await create.getByLabel(/^Name/).fill(sprint)
  await create.getByLabel(/^Start/).fill('2032-03-01')
  await create.getByLabel(/^End/).fill('2032-03-12')
  await create.getByRole('checkbox', { name: new RegExp(standalone) }).check()
  await create.getByRole('button', { name: 'Create sprint with 1 task' }).click()
  await expect(page.getByText('Sprint created with 1 task.')).toBeVisible(TIMEOUT)
  await expect.poll(() => waiting(page), TIMEOUT).toBe(before - 1)
  await page.reload()
  expect(await waiting(page)).toBe(before - 1)

  // TB-5: the planning page. Add moves a task across, Remove returns it, counts follow.
  await page
    .getByRole('list', { name: `Sprints on ${WORK_BOARD}` })
    .getByRole('link', { name: new RegExp(sprint) })
    .click()
  await expect(item(page, 'Sprint tasks', standalone)).toBeVisible(TIMEOUT)
  await expect(item(page, 'Backlog tasks', standalone)).toHaveCount(0)
  await item(page, 'Backlog tasks', added).getByRole('button', { name: /^Add / }).click()
  await expect(item(page, 'Sprint tasks', added)).toBeVisible(TIMEOUT)
  await expect(item(page, 'Backlog tasks', added)).toHaveCount(0)
  await item(page, 'Sprint tasks', added)
    .getByRole('button', { name: /Remove/ })
    .click()
  await expect(item(page, 'Backlog tasks', added)).toBeVisible(TIMEOUT)
  await expect(item(page, 'Sprint tasks', added)).toHaveCount(0)
  await page.reload()
  await expect(item(page, 'Backlog tasks', added)).toBeVisible(TIMEOUT)
  await expect(item(page, 'Sprint tasks', standalone)).toBeVisible()

  // TB-9: from the parent idea's drawer, an unscheduled task is scheduled into that sprint.
  await page.goto(`/boards/${boardId}?tab=backlog`)
  await page.getByRole('link', { name: scheduled }).first().click()
  await page.getByRole('link', { name: `Parent idea ${parentKey}` }).click()
  const tasks = page.getByRole('region', { name: /^Tasks/ })
  const taskRow = tasks.getByRole('listitem').filter({ hasText: scheduled })
  await expect(taskRow).toBeVisible(TIMEOUT)
  await expect(taskRow.getByText('No sprint')).toBeVisible()
  await taskRow.getByRole('button', { name: /^Schedule / }).click()
  const dialog = page.getByRole('alertdialog')
  await expect(
    dialog.getByLabel('Sprint').locator('option').filter({ hasText: 'Create a new sprint…' }),
  ).toHaveCount(1)
  await dialog.getByLabel('Sprint').selectOption({ label: `${sprint} · Planned` })
  await dialog.getByRole('button', { name: 'Schedule' }).click()
  await expect(taskRow.getByText(sprint)).toBeVisible(TIMEOUT)
  await expect(taskRow.getByRole('button', { name: /^Schedule / })).toHaveCount(0)

  // TB-8: the Tasks page lists it under In sprint, naming the sprint, and not under the Backlog.
  await page.goto('/tasks?tab=sprint')
  await expect(listRow(page, scheduled)).toContainText(sprint, TIMEOUT)
  await page.goto('/tasks')
  await expect(listRow(page, kept)).toBeVisible(TIMEOUT)
  await expect(listRow(page, scheduled)).toHaveCount(0)

  // TB-7: the board panel. Dropping a Backlog task on a lane puts it in the Active sprint and the lane.
  await page.goto(`/boards/${boardId}?tab=board`)
  await page.getByRole('button', { name: /^Show backlog/ }).click()
  const panel = page.getByRole('complementary', { name: 'Backlog' })
  await expect(panel).toContainText('Drag a task onto a lane', TIMEOUT)
  const card = panel.locator('li[data-row-key]').filter({ hasText: dropped })
  await expect(card).toBeVisible(TIMEOUT)
  const lane: Locator = page.getByRole('region', { name: 'In Progress' })
  // A real pointer drag in steps: the lane only accepts the drop once the drag state has rendered.
  await card.hover()
  const from = (await card.boundingBox()) ?? { x: 0, y: 0, width: 0, height: 0 }
  const to = (await lane.boundingBox()) ?? { x: 0, y: 0, width: 0, height: 0 }
  await page.mouse.down()
  await page.mouse.move(from.x + from.width / 2 + 10, from.y + from.height / 2 + 10, { steps: 5 })
  await page.mouse.move(to.x + to.width / 2, to.y + 60, { steps: 15 })
  await page.mouse.move(to.x + to.width / 2 + 2, to.y + 62, { steps: 3 })
  await page.mouse.up()
  await expect(panel.locator('li[data-row-key]').filter({ hasText: dropped })).toHaveCount(
    0,
    TIMEOUT,
  )
  await expect(page.getByText(/added to .* and moved to /)).toBeVisible(TIMEOUT)

  await page.goto('/tasks?tab=sprint')
  await expect(listRow(page, dropped)).toBeVisible(TIMEOUT)
  await expect(listRow(page, dropped)).not.toContainText(sprint)
})
