import type { Page } from '@playwright/test'

/**
 * Signing in, and telling the two refusals apart.
 *
 * Every spec had its own copy of this, which was fine until the failure mode below showed up in
 * three places at once.
 *
 * ## Why it inspects the refusal instead of just waiting
 *
 * **A rate-limited sign-in looks almost exactly like a wrong password.** `LoginForm` renders the
 * same sentence for both and differs only by a trailing "Five failed attempts within 15 minutes
 * lock the account" — which is deliberately absent when the limiter turned the request away, since
 * that request never reached the account. So a spec that only waits for the URL to change reports
 * `expect(page).not.toHaveURL(/\/login/) timed out` and nothing else, and the obvious reading is
 * that the credential is wrong.
 *
 * It is not. `POST /auth/login` allows twenty attempts per minute per caller IP, and a full run of
 * this suite used to sign in about twenty-seven times in under two minutes (measured 2026-09-14),
 * failing specs that had nothing to do with sign-in in a way that looked like credential bugs.
 *
 * `auth.setup.ts` fixed that: the seeded roles sign in once and every other spec reuses the stored
 * cookie, so a run now signs in fourteen times, nine of them as accounts the specs create
 * themselves (measured 2026-09-29). If a new spec pushes that back towards twenty, this is how
 * the failure will read - as what it is, not as a password that was always correct.
 */
export async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.context().clearCookies()
  await page.goto('/login')
  await page.getByLabel(/email/i).fill(email)
  await page.getByLabel(/password/i).fill(password)
  await page.getByRole('button', { name: /sign in/i }).click()

  // **Navigation first, and nothing raced against it.** Racing an alert locator loses twice over:
  // the login page already carries an empty `role="alert"`, so the race resolves instantly and
  // reports a refusal that has not happened, and `/change-password` renders one of its own saying
  // "Change your password", so a *successful* sign-in by an account mid-rotation reads as refused.
  // Leaving the login page is the only unambiguous success signal there is.
  const left = await page
    .waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20_000 })
    .then(() => true)
    .catch(() => false)
  if (left) return

  // Still here, so something refused it. The alert says which, and the distinction is invisible on
  // screen: the limiter's sentence and a wrong password's are the same but for the trailing
  // lockout note, which is deliberately absent when the request never reached the account.
  const text = (
    await page
      .getByRole('alert')
      .filter({ hasText: /\S/ })
      .first()
      .innerText()
      .catch(() => '')
  )
    .replace(/\s+/g, ' ')
    .trim()

  if (text === '') {
    throw new Error(`Sign-in for ${email} never left /login, and the page showed no reason.`)
  }

  throw new Error(
    text.includes('Five failed attempts')
      ? `Sign-in for ${email} was refused: "${text}"`
      : `Sign-in for ${email} was RATE LIMITED, not refused.

` +
          'The login endpoint allows 20 attempts per minute per caller IP. The credential is almost' +
          ' certainly fine - re-run the spec on its own, or wait a minute.' +
          ` The page said: "${text}"`,
  )
}
