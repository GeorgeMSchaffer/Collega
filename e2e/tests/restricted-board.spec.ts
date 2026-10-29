import { expect, type Page, test } from '@playwright/test'
import { DEMO_PASSWORD, SEEDED } from '../seeded-accounts'
import { signIn } from './sign-in'

/**
 * Restricted boards and groups (`SPEC/20-feature-board-access-and-groups.md` BAG-6), through a real
 * browser and the real API: an Org Admin makes a group and a board, restricts the board to the
 * group; the group's member still sees it; a non-member gets the Not found page (the API's 404) at its URL and does
 * not find it in the Boards list; and removing the member from the group hides it from them too.
 *
 * Acme Robotics. The group and the board are the test's own (named with a timestamp), and the group
 * is deleted at the end, win or lose, which also drops its grant on the board. The member is the
 * seeded Noah Contributor, who signs in for real (one sign-in); the non-member is the seeded Read
 * Only account, which reuses its saved session.
 */
const MEMBER = 'user@acme-robotics.demo.collega.test'
const MEMBER_NAME = 'Noah Contributor'
const TIMEOUT = { timeout: 30_000 }

const stamp = Date.now()
const GROUP = `e2e group ${stamp}`
const BOARD = `e2e restricted ${stamp}`

const boardLink = (page: Page) => page.getByRole('link', { name: BOARD, exact: true })

/** The Boards list narrowed to the test's board: the list pages at ten, so unfiltered it can miss it. */
async function listFor(page: Page): Promise<void> {
  await page.goto(`/boards?q=${encodeURIComponent(BOARD)}`)
  await expect(page.getByRole('heading', { level: 1, name: 'Boards' })).toBeVisible(TIMEOUT)
}

async function expectSees(page: Page, boardId: string): Promise<void> {
  await listFor(page)
  await expect(boardLink(page)).toBeVisible(TIMEOUT)
  const response = await page.goto(`/boards/${boardId}`)
  expect(response?.status()).toBe(200)
  await expect(page.getByRole('heading', { level: 1, name: BOARD })).toBeVisible(TIMEOUT)
}

async function expectNotFound(page: Page, boardId: string): Promise<void> {
  // The Not found page, not the board. The HTTP status is not asserted: the desk streams, so
  // `notFound()` after the shell has flushed renders this page under a 200.
  await page.goto(`/boards/${boardId}`)
  await expect(page.getByRole('heading', { level: 1, name: 'Not found' })).toBeVisible(TIMEOUT)
  await expect(page.getByRole('heading', { level: 1, name: BOARD })).toHaveCount(0)
  await listFor(page)
  // The filter is applied on the client after the page paints, so wait for it to settle on "no
  // match" rather than asserting absence against a list that has not been filtered yet.
  await expect(boardLink(page)).toHaveCount(0)
  await expect(page.getByText(BOARD)).toHaveCount(0)
}

/** Picks one entry in an Access or member picker: type to narrow, then click the option. */
async function pick(page: Page, picker: ReturnType<Page['getByRole']>, name: string) {
  await picker.click()
  await picker.fill(name)
  await page.getByRole('option', { name: new RegExp(name) }).click()
}

test.describe('a Restricted board', () => {
  test('is seen by its group, hidden from everyone else, and hidden again when a member leaves', async ({
    browser,
    page,
  }) => {
    test.setTimeout(240_000)

    const admin = await browser.newContext({ storageState: SEEDED.orgAdmin.file })
    const reader = await browser.newContext({ storageState: SEEDED.readOnly.file })
    const adminPage = await admin.newPage()
    const readerPage = await reader.newPage()
    let groupId: string | null = null

    try {
      // The Org Admin makes a group holding Noah.
      await adminPage.goto('/settings/groups?group=new')
      const groupDrawer = adminPage.getByRole('complementary', { name: 'New group' })
      await expect(groupDrawer).toBeVisible(TIMEOUT)
      await expect(async () => {
        await groupDrawer.getByLabel(/^Name/).fill(GROUP)
        await expect(groupDrawer.getByLabel(/^Name/)).toHaveValue(GROUP)
      }).toPass(TIMEOUT)
      await pick(adminPage, groupDrawer.getByRole('combobox'), MEMBER_NAME)
      await expect(groupDrawer.getByText('Members · 1')).toBeVisible()
      await groupDrawer.getByRole('button', { name: 'Create group' }).click()
      await expect(adminPage).toHaveURL(/[?&]group=[0-9a-f-]{36}/i, TIMEOUT)
      groupId = new URL(adminPage.url()).searchParams.get('group')
      expect(groupId).toBeTruthy()

      // A board open to the whole organization, which Read Only can see.
      await adminPage.goto('/boards')
      await adminPage.getByRole('button', { name: 'Add New Board' }).click()
      const create = adminPage.getByRole('complementary', { name: 'Add New Board' })
      await create.getByLabel('Name', { exact: true }).fill(BOARD)
      await create.getByRole('button', { name: 'Create board' }).click()
      await expect(adminPage).toHaveURL(/[?&]board=[0-9a-f-]{36}/i, TIMEOUT)
      const boardId = new URL(adminPage.url()).searchParams.get('board') as string
      await expectSees(readerPage, boardId)

      // Restrict it to the group.
      await adminPage.goto(`/boards?board=${boardId}&mode=edit`)
      const edit = adminPage.getByRole('complementary', { name: BOARD })
      await expect(edit).toBeVisible(TIMEOUT)
      await edit.getByRole('radio', { name: /Only people and groups I choose/ }).check()
      await pick(adminPage, edit.getByRole('combobox', { name: 'People and groups' }), GROUP)
      await expect(edit.getByRole('button', { name: `Remove group ${GROUP}` })).toBeVisible()
      await edit.getByRole('button', { name: /^Save/ }).click()
      await expect(adminPage).toHaveURL(new RegExp(`board=${boardId}(?!.*mode=edit)`), TIMEOUT)

      // The Org Admin still sees it, with its lock.
      await listFor(adminPage)
      const row = adminPage.getByRole('row').filter({ hasText: BOARD })
      await expect(row.getByText('Restricted', { exact: true })).toHaveCount(1, TIMEOUT)

      // A member of the group sees it; someone outside the group is told it does not exist.
      await signIn(page, MEMBER, DEMO_PASSWORD)
      await expectSees(page, boardId)
      await expectNotFound(readerPage, boardId)

      // Removing the member from the group takes the board away from them.
      await adminPage.goto(`/settings/groups?group=${groupId}`)
      const members = adminPage.getByRole('complementary', { name: GROUP })
      await expect(members).toBeVisible(TIMEOUT)
      await members.getByRole('button', { name: `Remove ${MEMBER_NAME}` }).click()
      await expect(members.getByText('Members · 0')).toBeVisible()
      await members.getByRole('button', { name: 'Save' }).click()
      await expect(members.getByText('No members yet.')).toBeVisible(TIMEOUT)
      // The drawer empties its list before the save lands; the list's count comes from the server.
      await expect(
        adminPage.getByRole('row').filter({ hasText: GROUP }).getByRole('cell').nth(1),
      ).toHaveText('0', TIMEOUT)

      await expectNotFound(page, boardId)
    } finally {
      // Deleting the group also removes its grant, so the test's board is left with no one chosen.
      if (groupId) {
        await adminPage.goto(`/settings/groups?group=${groupId}`)
        const drawer = adminPage.getByRole('complementary', { name: GROUP })
        if (await drawer.isVisible().catch(() => false)) {
          await drawer.getByRole('button', { name: /Delete/ }).click()
          await adminPage.getByRole('button', { name: 'Delete group' }).click()
          await expect(adminPage.getByRole('button', { name: `View ${GROUP}` })).toHaveCount(0, TIMEOUT)
        }
      }
      await admin.close()
      await reader.close()
    }
  })
})
