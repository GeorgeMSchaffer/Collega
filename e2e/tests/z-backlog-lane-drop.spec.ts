import { expect, type Page, test } from '@playwright/test'
import { DEMO_PASSWORD } from '../seeded-accounts'
import { signIn } from './sign-in'

/**
 * The Backlog panel and the lane drop (`SPEC/20-feature-task-backlog-and-sprint-planning.md` TB-7,
 * slice 330), through a real browser and the real API: an Org Admin drags a backlog task onto a lane
 * and it lands there with its sprint set in the same write; once no sprint is Active the lane
 * refuses with the reason and the task stays in the Backlog.
 *
 * **One test, and named to run last.** It completes Pinecone's Active sprint then starts the next (the only
 * way to reach "no Active sprint" without a second work board), which would change what the specs
 * after it see. It is a single test so it signs in once (see `AGENTS.md` on the login limiter).
 */
const WORK_BOARD = 'Engineering'
const ADMIN = 'orgadmin@pinecone-labs.demo.collega.test'
const TIMEOUT = { timeout: 30_000 }

async function openBoardTab(page: Page): Promise<string> {
  await page.goto(`/boards?q=${encodeURIComponent(WORK_BOARD)}`)
  const link = page
    .locator('a[href^="/boards/"]')
    .filter({ hasText: new RegExp(`^${WORK_BOARD}$`) })
  await expect(link).toBeVisible(TIMEOUT)
  const id = ((await link.getAttribute('href')) ?? '').replace('/boards/', '').split('?')[0] ?? ''
  await page.goto(`/boards/${id}?tab=board`)
  return id
}

async function addTask(page: Page, boardId: string, title: string): Promise<void> {
  await page.goto(`/boards/${boardId}?tab=backlog&task=new`)
  const drawer = page.getByRole('complementary', { name: 'Add a task' })
  await expect(drawer).toBeVisible(TIMEOUT)
  await drawer.getByLabel(/^Title/).fill(title)
  await drawer.getByRole('button', { name: 'Add task' }).click()
  await expect(page).not.toHaveURL(/[?&]task=new/, TIMEOUT)
}

async function openPanel(page: Page, boardId: string): Promise<void> {
  await page.goto(`/boards/${boardId}?tab=board`)
  await page.getByRole('button', { name: /^Show backlog/ }).click()
  await expect(page.getByRole('complementary', { name: 'Backlog' })).toBeVisible(TIMEOUT)
}

test('dropping a backlog task on a lane sets sprint and status; with no Active sprint the lane refuses', async ({
  page,
}) => {
  const stamp = Date.now()
  const placed = `e2e dropped ${stamp}`
  const refused = `e2e refused ${stamp}`

  await signIn(page, ADMIN, DEMO_PASSWORD)
  const boardId = await openBoardTab(page)
  await addTask(page, boardId, placed)
  await addTask(page, boardId, refused)

  // No Active sprint: complete the running one. (Through the API: the Sprint board page cannot
  // render an Active sprint that holds work-board tasks, which is Pinecone's seed.)
  const api = `http://localhost:${process.env.COLLEGA_E2E_API_PORT?.trim() || '3001'}/api/v1`
  const listed = await page.request.get(`${api}/boards/${boardId}/sprints`)
  expect(listed.ok(), await listed.text()).toBe(true)
  const sprints = (await listed.json()) as {
    sprintId: string
    state: string
    organizationId?: string
  }[]
  const active = sprints.find((sprint) => sprint.state === 'Active')
  expect(active, JSON.stringify(sprints)).toBeTruthy()
  const completed = await page.request.post(
    `${api}/organizations/${active?.organizationId}/sprints/${active?.sprintId}/complete`,
  )
  expect(completed.ok(), await completed.text()).toBe(true)

  await openPanel(page, boardId)
  const panel = page.getByRole('complementary', { name: 'Backlog' })
  const lane = page.getByRole('region', { name: 'In Progress' })
  await panel.locator('li').filter({ hasText: refused }).dragTo(lane)
  await expect(lane.getByText(refused)).toHaveCount(0)
  await page.reload()
  await page.getByRole('button', { name: /^Show backlog/ }).click()
  await expect(panel.locator('li').filter({ hasText: refused })).toBeVisible(TIMEOUT)

  // Start the Planned sprint, then the same drop lands the task in the lane with a sprint set.
  const planned = sprints.find((sprint) => sprint.state === 'Planned')
  expect(planned).toBeTruthy()
  const started = await page.request.post(
    `${api}/organizations/${planned?.organizationId}/sprints/${planned?.sprintId}/start`,
  )
  expect(started.ok(), await started.text()).toBe(true)

  await openPanel(page, boardId)
  await panel.locator('li').filter({ hasText: placed }).dragTo(lane)
  await expect(lane.getByText(placed)).toBeVisible(TIMEOUT)

  // Read back after a reload: in the lane, gone from the panel, and in a sprint on the Tasks page.
  await page.reload()
  await expect(lane.getByText(placed)).toBeVisible(TIMEOUT)
  await page.getByRole('button', { name: /^Show backlog/ }).click()
  await expect(panel.locator('li').filter({ hasText: placed })).toHaveCount(0)
  await page.goto('/tasks?tab=sprint')
  await expect(page.getByRole('row').filter({ hasText: placed })).toBeVisible(TIMEOUT)
})
