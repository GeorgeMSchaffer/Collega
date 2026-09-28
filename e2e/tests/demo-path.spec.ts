import { expect, type Page, test } from '@playwright/test'
import { SEEDED } from '../seeded-accounts'
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
const ORG_ADMIN = SEEDED.orgAdmin.email
const DEMO_PASSWORD = 'Abc123!'

/** A seeded board in every demo organization, with ideas in its lanes. */
const SEEDED_BOARD = 'Ideas'

/**
 * Opens the seeded "Ideas" board from the Boards screen.
 *
 * **Filtered by name, not the first board link.** Boards page at ten and sort by name, and this
 * suite creates boards of its own ("Demo Board …" sorts ahead of "Ideas") - so the first link is
 * whichever board an earlier test left behind, with no ideas on it. `?q=` narrows the list, and the
 * href prefix plus the exact name keep out the sidebar's "Ideas" nav link, which points at `/ideas`.
 */
async function openSeededBoard(page: Page): Promise<void> {
  await page.goto(`/boards?q=${encodeURIComponent(SEEDED_BOARD)}`)
  const board = page
    .locator('a[href^="/boards/"]')
    .filter({ hasText: new RegExp(`^${SEEDED_BOARD}$`) })
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
  // The stored session rather than a sign-in: these tests are about boards, and making each one
  // prove the login flow first is what exhausted the rate limiter (`auth.setup.ts`).
  test.use({ storageState: SEEDED.orgAdmin.file })

  test('an org admin creates a board in the drawer and it appears in the list', async ({
    page,
  }) => {
    const name = `Demo Board ${Date.now()}`

    // The page header's one creation action opens the board drawer rather than a route.
    await page.goto('/boards')
    await page.getByRole('button', { name: 'Add New Board' }).click()
    await expect(page).toHaveURL(/[?&]board=new/, { timeout: 30_000 })

    const form = page.getByRole('complementary', { name: 'Add New Board' })
    await form.getByLabel('Name', { exact: true }).fill(name)
    await form.getByRole('button', { name: 'Create board' }).click()

    // A new board opens in the view drawer once created: its name heads the drawer, and the URL
    // names the board instead of `new`.
    await expect(page.getByRole('complementary', { name })).toBeVisible({ timeout: 30_000 })
    await expect(page).toHaveURL(/[?&]board=[0-9a-f-]{36}/i, { timeout: 30_000 })

    // Read back from a fresh load, filtered by name: the list pages at ten, so unfiltered it shows
    // this board only while fewer than ten sort ahead of it.
    await page.goto(`/boards?q=${encodeURIComponent(name)}`)
    await expect(page.getByRole('link', { name, exact: true })).toBeVisible({ timeout: 30_000 })
  })
})

test.describe('ideas on a board', () => {
  test.use({ storageState: SEEDED.orgAdmin.file })

  test('authoring an idea puts it on the board', async ({ page }) => {
    await openSeededBoard(page)

    const title = `Demo idea ${Date.now()}`

    // The form opens in the drawer, from the page header's Add New Idea.
    await page.getByRole('button', { name: 'Add New Idea' }).click()
    await expect(page).toHaveURL(/[?&]new=1/, { timeout: 30_000 })
    await page.getByLabel(/title/i).fill(title)
    await page.getByLabel(/problem/i).fill('Authored by the E2E suite.')
    await page.getByLabel('Solution 1').fill('Try it on one board first.')
    await page.getByLabel(/impact rationale/i).fill('Saves an hour a week.')
    await page.getByLabel(/business impact/i).selectOption({ index: 1 })
    await page.getByLabel(/idea type/i).selectOption({ index: 1 })
    await page
      .getByRole('button', { name: /create|add idea|save/i })
      .last()
      .click()

    // The drawer opens on the new idea, so its heading is the proof the create went through.
    const drawer = page.getByRole('complementary', { name: title })
    await expect(drawer).toBeVisible({ timeout: 30_000 })

    // The drawer lives in the URL, so a reload - or a shared link - reopens it on the same idea.
    await expect(page).toHaveURL(/[?&]idea=[0-9a-f-]{36}/i)
    await page.reload()
    await expect(drawer).toBeVisible({ timeout: 30_000 })
    // The server renders the drawer open; its heading takes focus once it has hydrated, in the same
    // effect that starts listening for Escape.
    await expect(drawer.getByRole('heading', { name: title })).toBeFocused({ timeout: 30_000 })

    // Escape closes it and takes the idea out of the URL, leaving the board behind it.
    await page.keyboard.press('Escape')
    await expect(page).not.toHaveURL(/[?&]idea=/, { timeout: 30_000 })
    await expect(drawer).toBeHidden()
  })

  test('an idea moves a lane to the right and stays there across a reload', async ({ page }) => {
    await openSeededBoard(page)

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
  test.use({ storageState: SEEDED.readOnly.file })

  test('sees the board and is refused authoring, with the reason shown', async ({ page }) => {
    await openSeededBoard(page)

    // **The control is shown, not hidden** — and that is the product decision worth pinning. A role
    // that may not author gets the same "Add New Idea" button carrying `aria-disabled` and pointing at
    // its reason through `aria-describedby`, rather than a hole where the topbar action was. The
    // page header renders it through `GatedAction`: never a hole, always the reason.
    //
    // This spec originally asserted the opposite and failed, which is the test doing its job on the
    // person writing it.
    const newIdea = page.getByRole('button', { name: 'Add New Idea' })
    await expect(newIdea).toHaveCount(1)
    await expect(newIdea).toHaveAttribute('aria-disabled', 'true')

    // The reason is reachable from the control rather than merely present somewhere on the page:
    // `aria-describedby` is what makes it the button's reason for a screen reader too.
    const describedBy = await newIdea.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    await expect(page.locator(`#${String(describedBy)}`)).not.toBeEmpty()

    // And it is a refusal to author, not a refusal to look: the board still renders, under the
    // page's one level-1 heading. The top bar is a breadcrumb `nav`, not a second `h1`, so this
    // locator must match exactly one element - it fails in strict mode if a second comes back.
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(SEEDED_BOARD, {
      timeout: 30_000,
    })
  })
})
