import { expect, type Page } from '@playwright/test'

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
 * It is not. `POST /auth/login` allows twenty attempts per minute per caller IP, and **a single
 * full run of this suite exceeds that**: twenty-five tests sign in around twenty-seven times in
 * under two minutes. Measured 2026-09-14, when the whole suite was first run after the database
 * isolation fix — two specs failed on sign-in, neither of them about sign-in, and both looked like
 * credential bugs. `SPEC/Bug Triage.md` recorded this as an hourly-limit problem that appears on
 * the fourth consecutive run; that was the wrong bucket and far too generous.
 *
 * The real fix is `storageState` — authenticate once per role and reuse the cookie, which takes the
 * twenty-seven down to about four. Until that exists, this at least makes the failure say what it
 * is rather than sending the next person to check a password that was always correct.
 */
export async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.context().clearCookies()
  await page.goto('/login')
  await page.getByLabel(/email/i).fill(email)
  await page.getByLabel(/password/i).fill(password)
  await page.getByRole('button', { name: /sign in/i }).click()

  // The alert and the navigation race, so whichever settles first decides. Waiting for the URL
  // alone is what produced the unreadable timeout this function exists to replace.
  const refusal = page.getByRole('alert').filter({ hasText: /sign in|password|incorrect|try/i })
  await Promise.race([
    page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30_000 }),
    refusal.first().waitFor({ state: 'visible', timeout: 30_000 }),
  ]).catch(() => undefined)

  if (
    await refusal
      .first()
      .isVisible()
      .catch(() => false)
  ) {
    const text = (await refusal.first().innerText()).replace(/\s+/g, ' ').trim()
    const limited = !text.includes('Five failed attempts')
    throw new Error(
      limited
        ? `Sign-in for ${email} was RATE LIMITED, not refused.\n\n` +
            `The login endpoint allows 20 attempts per minute per IP and this suite signs in about\n` +
            `27 times per run. The credential is almost certainly fine. Re-run a single spec, or wait\n` +
            `a minute. The page said: "${text}"`
        : `Sign-in for ${email} was refused: "${text}"`,
    )
  }

  await expect(page, `sign-in for ${email} never left /login`).not.toHaveURL(/\/login/, {
    timeout: 30_000,
  })
}
