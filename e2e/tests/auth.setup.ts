import { mkdirSync } from 'node:fs'
import { test as setup } from '@playwright/test'
import { DEMO_PASSWORD, SEEDED, STATE_DIR } from '../seeded-accounts'
import { signIn } from './sign-in'

/**
 * Signs in once per seeded role and saves the session, so the specs do not each sign in again.
 *
 * ## Why this exists
 *
 * `POST /auth/login` allows **twenty attempts per minute per caller IP**, and a full suite run used
 * to sign in twenty-seven times inside two minutes. So running everything at once exhausted the
 * limiter partway through and failed specs that had nothing to do with authentication — on the
 * login screen, with a message that reads like a wrong password (see `sign-in.ts`). Measured
 * 2026-09-14.
 *
 * Each role signs in here exactly once and the cookie is reused, which is also simply what the
 * specs mean: a test about moving an idea between lanes is not a test about signing in, and making
 * it prove the login flow first only makes it slower and more fragile.
 *
 * ## What deliberately does NOT use these
 *
 * - `signs-in.spec.ts`, which is about signing in.
 * - `journey.spec.ts`, which builds its own accounts, rotates a forced password mid-chain and
 *   switches identity as the story requires. Reusing a cookie there would skip the thing under
 *   test.
 * - Any spec step that signs in as an account it has just created. Those are real sign-ins on
 *   purpose, and `signIn` clears cookies first, so they work unchanged inside a stored session.
 */

for (const [role, { email, file }] of Object.entries(SEEDED)) {
  setup(`authenticate as ${role}`, async ({ page }) => {
    mkdirSync(STATE_DIR, { recursive: true })
    await signIn(page, email, DEMO_PASSWORD)
    await page.context().storageState({ path: file })
  })
}
