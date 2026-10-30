import { type Browser, expect, type Page, test } from '@playwright/test'
import { DEMO_PASSWORD, SEEDED } from '../seeded-accounts'
import { signIn } from './sign-in'

/**
 * Sign-in messages (`SPEC/20-feature-login-messages.md` LMS-3, LMS-4, LMS-7), through a real browser
 * and the real API: an Org Admin writes a Modal that needs acknowledging and a Banner that comes
 * back every sign-in; a User then sees the modal and the banner, acknowledges the modal, closes the
 * banner, and after signing out and in again the acknowledged message stays gone while the closed
 * banner is back.
 *
 * Acme Robotics' own messages, so no other organization sees them. The titles carry a timestamp and
 * both messages are deleted at the end, win or lose, so a rerun against a kept database starts
 * clean. Two real sign-ins (the User's, twice); the Org Admin reuses the saved session.
 */
const USER = 'user@acme-robotics.demo.collega.test'
const TIMEOUT = { timeout: 30_000 }

/**
 * Closes sign-in modals other than `keep`, with Escape (which is Close, so nothing is
 * acknowledged). The desk shows every message in the page's scope to whoever is signed in, the
 * Org Admin included, and a database that has been used by hand may hold messages of its own.
 */
async function closeDialogs(page: Page, keep?: string): Promise<void> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const dialog = page.getByRole('dialog').first()
    const shown = await dialog
      .waitFor({ state: 'visible', timeout: attempt === 0 ? 3_000 : 1_000 })
      .then(() => true)
      .catch(() => false)
    if (!shown) return
    const title = (await dialog.getByRole('heading').first().innerText()).trim()
    if (title === keep) return
    await page.keyboard.press('Escape')
    await expect(page.getByRole('heading', { name: title, level: 2 })).toHaveCount(0)
  }
}

async function createMessage(
  page: Page,
  message: { title: string; body: string; display: 'Modal' | 'Banner'; mode: RegExp },
): Promise<void> {
  await page.goto('/settings/login-messages?message=new')
  await closeDialogs(page)
  const drawer = page.getByRole('complementary', { name: 'New message' })
  await expect(drawer).toBeVisible(TIMEOUT)
  // The drawer can hydrate after the first keystrokes and drop them, so fill and submit are
  // retried together until the row appears.
  await expect(async () => {
    await drawer.getByLabel(/^Title/).fill(message.title)
    await drawer.getByLabel(/^Message/).fill(message.body)
    await drawer.getByRole('radio', { name: new RegExp(`^${message.display}`) }).check()
    await drawer.getByRole('radio', { name: message.mode }).check()
    await drawer.getByRole('button', { name: 'Create message' }).click()
    await expect(page).not.toHaveURL(/[?&]message=new/, { timeout: 5_000 })
  }).toPass(TIMEOUT)
  await expect(row(page, message.title)).toBeVisible(TIMEOUT)
}

const row = (page: Page, title: string) => page.getByRole('row').filter({ hasText: title })

async function deleteMessage(page: Page, title: string): Promise<void> {
  await page.goto('/settings/login-messages')
  await closeDialogs(page)
  const target = row(page, title)
  if ((await target.count()) === 0) return
  await target.getByRole('button', { name: /Delete/ }).click()
  await page.getByRole('button', { name: 'Delete message' }).click()
  await expect(target).toHaveCount(0, TIMEOUT)
}

/**
 * Runs `press` and waits for the server action it triggers to answer. The message disappears from
 * the page at once and the API records the response afterwards, so a reload straight after the
 * click would race the write.
 */
async function recorded(page: Page, press: () => Promise<void>): Promise<void> {
  const answer = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && 'next-action' in response.request().headers(),
    TIMEOUT,
  )
  await press()
  await answer
}

async function signOut(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/login/, TIMEOUT)
}

async function adminPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ storageState: SEEDED.orgAdmin.file })
  return context.newPage()
}

test.describe('sign-in messages', () => {
  test('a user sees the modal then the banner; acknowledging survives sign-out, a closed banner returns', async ({
    browser,
  }) => {
    const stamp = Date.now()
    const modalTitle = `E2E terms ${stamp}`
    const bannerTitle = `E2E maintenance ${stamp}`
    const admin = await adminPage(browser)

    try {
      await createMessage(admin, {
        title: modalTitle,
        body: 'Please read and acknowledge.',
        display: 'Modal',
        mode: /Acknowledge required/,
      })
      await createMessage(admin, {
        title: bannerTitle,
        body: 'Short outage on Saturday.',
        display: 'Banner',
        mode: /Every sign-in/,
      })
      await closeDialogs(admin)
      // The list shows both as live, and the modal's count starts at zero.
      await expect(row(admin, modalTitle).getByText('Live')).toBeVisible(TIMEOUT)
      await expect(row(admin, modalTitle).getByText(/0 of \d+ acknowledged/)).toBeVisible()

      const userContext = await browser.newContext()
      const user = await userContext.newPage()
      await signIn(user, USER, DEMO_PASSWORD)

      await closeDialogs(user, modalTitle)
      // The modal is up, and the banner is on the page behind it.
      const modal = user.getByRole('dialog', { name: modalTitle })
      await expect(modal).toBeVisible(TIMEOUT)
      await expect(modal.getByRole('button', { name: 'Acknowledge' })).toBeVisible()
      await expect(modal.getByRole('button', { name: 'Close', exact: true })).toBeVisible()
      const banner = user.getByRole('region', { name: `Organization message: ${bannerTitle}` })
      await expect(banner).toBeVisible()

      // Acknowledge the modal; the banner stays until it is closed.
      await recorded(user, () => modal.getByRole('button', { name: 'Acknowledge' }).click())
      await expect(modal).toHaveCount(0)
      await expect(banner).toBeVisible()
      await recorded(user, () => banner.getByRole('button', { name: 'Close' }).click())
      await expect(banner).toHaveCount(0)

      // Both responses were recorded: neither returns on a reload within this sign-in.
      await user.reload()
      await expect(user.getByRole('navigation').first()).toBeVisible(TIMEOUT)
      await expect(user.getByRole('dialog', { name: modalTitle })).toHaveCount(0)
      await expect(
        user.getByRole('region', { name: `Organization message: ${bannerTitle}` }),
      ).toHaveCount(0)

      // After the next sign-in the acknowledged modal stays gone and the closed banner is back.
      // A sign-in time has one-second resolution (the token's `iat`) and a close made in the same
      // second as the next sign-in still counts as made during it, so let the second pass.
      await user.waitForTimeout(1_100)
      await signOut(user)
      await signIn(user, USER, DEMO_PASSWORD)
      await closeDialogs(user)
      await expect(
        user.getByRole('region', { name: `Organization message: ${bannerTitle}` }),
      ).toBeVisible(TIMEOUT)
      await expect(user.getByRole('dialog', { name: modalTitle })).toHaveCount(0)
      await userContext.close()

      // The admin's report counts the User's acknowledgement.
      await admin.goto('/settings/login-messages')
      await closeDialogs(admin)
      await expect(row(admin, modalTitle).getByText(/1 of \d+ acknowledged/)).toBeVisible(TIMEOUT)
    } finally {
      await deleteMessage(admin, modalTitle).catch(() => undefined)
      await deleteMessage(admin, bannerTitle).catch(() => undefined)
      await admin.context().close()
    }
  })
})
