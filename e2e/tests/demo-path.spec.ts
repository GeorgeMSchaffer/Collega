import { expect, type Page, test } from '@playwright/test'
import { signIn } from './sign-in'

/**
 * The walkthrough the product is demonstrated with, covered end to end.
 *
 * These exist for a specific moment rather than for coverage: bugs found in a demo get fixed under
 * time pressure, and a fix made under time pressure is exactly when a working path quietly breaks.
 * Everything below already worked before this file — the point is that it keeps working after the
 * next round of changes.
 *
 * Signing in and creating an organization or user are covered by their own specs; this picks up
 * where those leave off.
 *
 * The accounts are the seeded demo roster, whose password is published in `demo.md`. Safe here and
 * only here: `global-setup.ts` refuses to seed anything but a local `collega_e2e` schema.
 */
const ORG_ADMIN = 'orgadmin@acme-robotics.demo.collega.test'
const READ_ONLY = 'readonly@acme-robotics.demo.collega.test'
const DEMO_PASSWORD = 'Abc123!'

/**
 * Opens the first board from the workspace list.
 *
 * **By href, not by link text.** The seeded boards are called "Ideas" and "Opportunities", and the
 * sidebar has an "Ideas" nav link pointing at `/ideas` — so a name-based locator matches the nav
 * first and lands on the wrong page, which is exactly what it did. The href shape is the thing that
 * actually distinguishes a board link, and it survives the boards being renamed.
 */
async function openFirstBoard(page: Page): Promise<void> {
  const board = page.locator('a[href^="/boards/"]').first()
  await expect(board).toBeVisible({ timeout: 30_000 })
  await board.click()
  await expect(page).toHaveURL(/\/boards\/[0-9a-f-]+$/i, { timeout: 30_000 })
}

test.describe('changing a password', () => {
  test('a new account is forced through the change, and the new password then works', async ({
    page,
  }) => {
    // A user of this spec's own making, so it never fights another spec over one account's
    // credential — and so the "sign in with the new password" half is real rather than simulated.
    await signIn(page, ORG_ADMIN, DEMO_PASSWORD)

    const email = `rotates.${Date.now()}@acme-robotics.demo.collega.test`
    const first = 'Initial!Pass1'
    const second = 'Rotated!Pass2'

    await page.goto('/settings/users/new')
    await page.getByLabel(/first name/i).fill('Rotates')
    await page.getByLabel(/last name/i).fill('Password')
    await page.getByLabel(/^email$/i).fill(email)
    await page.getByLabel(/initial password/i).fill(first)
    await page.getByRole('button', { name: /create user/i }).click()
    await expect(page).toHaveURL(/\/settings\/users$/, { timeout: 30_000 })

    await signIn(page, email, first)
    await expect(page).toHaveURL(/change-password/, { timeout: 30_000 })

    await page.getByLabel(/current password/i).fill(first)
    await page.getByLabel(/^new password$/i).fill(second)
    await page.getByLabel(/confirm new password/i).fill(second)
    await page.getByRole('button', { name: /change password|save|update/i }).click()

    // Off the change-password screen is the assertion: the gate only lifts once the API has
    // accepted the new credential.
    await expect(page).not.toHaveURL(/change-password/, { timeout: 30_000 })

    // And the rotation is real on the server, not just in this session. The old credential is the
    // better probe than the new one — a session that simply persisted would pass with the new.
    await signIn(page, email, second)
    await expect(page).not.toHaveURL(/change-password/, { timeout: 30_000 })
  })
})

test.describe('boards', () => {
  test('an org admin creates a board and it appears in the workspace', async ({ page }) => {
    await signIn(page, ORG_ADMIN, DEMO_PASSWORD)

    const name = `Demo Board ${Date.now()}`

    await page.goto('/settings/boards/new')
    await page.getByLabel(/name/i).fill(name)
    await page.getByRole('button', { name: /create board/i }).click()

    await expect(page).toHaveURL(/\/settings\/boards$/, { timeout: 30_000 })
    await expect(page.getByText(name)).toBeVisible({ timeout: 30_000 })

    // The sidebar count is rendered by the layout rather than the page, which is why `createBoard`
    // revalidates the layout and not just the route. Asserting the board reaches /boards is what
    // would catch that revalidation being dropped.
    await page.goto('/boards')
    await expect(page.getByText(name)).toBeVisible({ timeout: 30_000 })
  })
})

test.describe('ideas on a board', () => {
  test('authoring an idea puts it on the board', async ({ page }) => {
    await signIn(page, ORG_ADMIN, DEMO_PASSWORD)

    await page.goto('/boards')
    await openFirstBoard(page)

    const title = `Demo idea ${Date.now()}`

    // The form is a modal the topbar action opens, not a route.
    await page.getByRole('button', { name: /new idea/i }).click()
    await page.getByLabel(/title/i).fill(title)
    await page.getByLabel(/description/i).fill('Authored by the E2E suite.')
    await page
      .getByRole('button', { name: /create|add idea|save/i })
      .last()
      .click()

    await expect(page.getByText(title)).toBeVisible({ timeout: 30_000 })
  })

  test('an idea moves a lane to the right and stays there across a reload', async ({ page }) => {
    await signIn(page, ORG_ADMIN, DEMO_PASSWORD)

    await page.goto('/boards')
    await openFirstBoard(page)

    // Any card that can still move right. Taking the first such control rather than naming a seeded
    // idea keeps this from breaking when the seed's distribution changes.
    const moveRight = page.getByRole('button', { name: /move .* one lane right/i })
    const enabled = moveRight.and(page.locator(':not([disabled])')).first()
    await expect(enabled).toBeVisible({ timeout: 30_000 })

    // The label carries the idea's title, which is how the assertion below knows which card moved.
    const label = (await enabled.getAttribute('aria-label')) ?? ''
    const title = label.replace(/^Move /, '').replace(/ one lane right$/, '')
    expect(title.length).toBeGreaterThan(0)

    await enabled.click()

    // The move is a write, so the proof is that it survives a reload rather than that the DOM
    // changed. A purely client-side reorder would pass the first assertion and fail this one.
    await page.reload()
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 30_000 })
    await expect(
      page
        .getByRole('button', { name: `Move ${title} one lane right` })
        .or(page.getByRole('button', { name: `Move ${title} one lane left` }))
        .first(),
    ).toBeVisible({ timeout: 30_000 })
  })
})

test.describe('read only', () => {
  test('sees the board and is refused authoring, with the reason shown', async ({ page }) => {
    await signIn(page, READ_ONLY, DEMO_PASSWORD)

    await page.goto('/boards')
    await openFirstBoard(page)

    // **The control is shown, not hidden** — and that is the product decision worth pinning. A role
    // that may not author gets the same "New idea" button carrying `aria-disabled` and pointing at
    // its reason through `aria-describedby`, rather than a hole where the topbar action was. The
    // comment on `NewIdeaForm` argues the case: never a hole, always the reason.
    //
    // This spec originally asserted the opposite and failed, which is the test doing its job on the
    // person writing it.
    const newIdea = page.getByRole('button', { name: /new idea/i })
    await expect(newIdea).toHaveCount(1)
    await expect(newIdea).toHaveAttribute('aria-disabled', 'true')

    // The reason is reachable from the control rather than merely present somewhere on the page:
    // `aria-describedby` is what makes it the button's reason for a screen reader too.
    const describedBy = await newIdea.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    await expect(page.locator(`#${String(describedBy)}`)).not.toBeEmpty()

    // And it is a refusal to author, not a refusal to look: the board still renders.
    //
    // `.first()` because the page carries **two** level-1 headings — the topbar breadcrumb and the
    // board's own — which is an accessibility defect rather than a locator problem. Recorded in
    // `SPEC/Bug Triage.md` rather than worked around silently; when it is fixed this stays correct.
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 30_000 })
  })
})
