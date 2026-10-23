import { expect, type Page, test } from '@playwright/test'
import { DEMO_PASSWORD } from '../seeded-accounts'
import { signIn } from './sign-in'

/**
 * A User schedules their own task (`SPEC/20-feature-task-backlog-and-sprint-planning.md` TB-4,
 * TB-10, slice 342), through a real browser and the real API: from the Backlog they add a task and
 * put it in the Active sprint; a task an Org Admin wrote stays where it is, with the reason beside
 * the disabled Add, and "Add to new sprint…" is not theirs to see.
 *
 * Pinecone Labs' "Engineering", as in `sprint-planning.spec.ts`. **Named to sort before `z-`**: the
 * lane-drop spec completes the Active sprint this one schedules into. Two sign-ins (the Org Admin
 * writes the task the User may not touch), which the login limiter counts (see `AGENTS.md`).
 */
const WORK_BOARD = 'Engineering'
const ADMIN = 'orgadmin@pinecone-labs.demo.collega.test'
const USER = 'user@pinecone-labs.demo.collega.test'
const DENIAL = 'Only the task’s author or an Org Admin can put it in a sprint.'
const TIMEOUT = { timeout: 30_000 }

async function openBacklog(page: Page): Promise<void> {
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
}

async function addTask(page: Page, title: string): Promise<void> {
  await page.getByRole('link', { name: '+ New task' }).first().click()
  const drawer = page.getByRole('complementary', { name: 'Add a task' })
  await expect(drawer).toBeVisible(TIMEOUT)
  // The drawer can hydrate after the first keystrokes and drop them, so fill and submit are
  // retried together until the drawer closes.
  await expect(async () => {
    await drawer.getByLabel(/^Title/).fill(title)
    await drawer.getByRole('button', { name: 'Add task' }).click()
    await expect(page).not.toHaveURL(/[?&]task=new/, { timeout: 5_000 })
  }).toPass(TIMEOUT)
  await expect(row(page, title)).toBeVisible(TIMEOUT)
}

const row = (page: Page, title: string) => page.getByRole('row').filter({ hasText: title })

test('a User schedules the task they wrote into the Active sprint, and cannot schedule an Org Admin’s', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const stamp = Date.now()
  const foreign = `e2e admin task ${stamp}`
  const own = `e2e user task ${stamp}`

  await signIn(page, ADMIN, DEMO_PASSWORD)
  await openBacklog(page)
  await addTask(page, foreign)

  await signIn(page, USER, DEMO_PASSWORD)
  await openBacklog(page)
  await addTask(page, own)

  // Their own task: Add targets the Active sprint and the task leaves the Backlog.
  await row(page, own).getByRole('checkbox').check()
  const bar = page.getByRole('region', { name: 'Selected tasks' })
  await expect(bar.getByRole('button', { name: 'Add to new sprint…' })).toHaveCount(0)
  const add = bar.getByRole('button', { name: /^Add to .*\(Active\)$/ })
  await expect(add).not.toHaveAttribute('aria-disabled', 'true')
  await add.click()
  await expect(row(page, own)).toHaveCount(0, TIMEOUT)
  await page.reload()
  await expect(row(page, foreign)).toBeVisible(TIMEOUT)
  await expect(row(page, own)).toHaveCount(0)

  // The Org Admin's task: ticking it disables Add and says why; nothing is sent.
  await row(page, foreign).getByRole('checkbox').check()
  await expect(bar.getByRole('button', { name: /^Add to .*\(Active\)$/ })).toHaveAttribute(
    'aria-disabled',
    'true',
  )
  await expect(bar.getByText(DENIAL)).toBeVisible()
  // Playwright treats aria-disabled as not enabled, so the click is forced: it must still do nothing.
  await bar.getByRole('button', { name: /^Add to .*\(Active\)$/ }).click({ force: true })
  await page.reload()
  await expect(row(page, foreign)).toBeVisible(TIMEOUT)
})
