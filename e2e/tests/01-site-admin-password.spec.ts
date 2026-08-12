import { test, expect } from '@playwright/test';
import { ACCOUNTS, NEW_SITE_ADMIN_PASSWORD, login, loginExpectingShell, fillFluent } from './helpers';

/**
 * Flow 1 — Log in as the Site Admin and set a new password.
 * The seeded Site Admin is created with a forced first-login password change, so the first sign-in
 * routes to /change-password; after changing it, signing in with the new password reaches the shell.
 *
 * NOTE: this mutates the shared CollegaE2E database (the Site Admin password is now changed), so a
 * re-run requires a fresh database. See e2e/README.md.
 */
test('Site Admin first login forces a password change, then signs in with the new password', async ({ page }) => {
  await login(page, ACCOUNTS.siteAdmin.email, ACCOUNTS.siteAdmin.password);

  await expect(page).toHaveURL(/\/change-password/);
  await fillFluent(page, 'current', ACCOUNTS.siteAdmin.password);
  await fillFluent(page, 'new', NEW_SITE_ADMIN_PASSWORD);
  await fillFluent(page, 'confirm', NEW_SITE_ADMIN_PASSWORD);
  await page.getByRole('button', { name: /update password/i }).click();

  // The change signs the user out and returns to login with a confirmation note.
  await expect(page).toHaveURL(/\/login/);

  // The new password now works and lands in the authenticated shell.
  await loginExpectingShell(page, ACCOUNTS.siteAdmin.email, NEW_SITE_ADMIN_PASSWORD);
});
