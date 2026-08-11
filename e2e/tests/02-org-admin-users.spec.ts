import { test, expect } from '@playwright/test';
import { ACCOUNTS, loginExpectingShell, fillFluent, selectFluent } from './helpers';

/**
 * Flows 2 & 3 — as an Org Admin, create two users, then "delete" (deactivate) them.
 * There is no hard-delete user endpoint; the app deactivates users (status -> Inactive) via the
 * user edit form, which is what "delete the two users" maps to here.
 */
const stamp = Date.now();
const INITIAL_PASSWORD = 'Abc123!';
const USERS = [
  { first: 'Ellie', last: `E2E-${stamp}`, email: `e2e-user1-${stamp}@example.com` },
  { first: 'Evan', last: `E2E-${stamp}`, email: `e2e-user2-${stamp}@example.com` },
];

test.describe.serial('Org Admin user management', () => {
  test('creates two users', async ({ page }) => {
    await loginExpectingShell(page, ACCOUNTS.orgAdmin.email, ACCOUNTS.orgAdmin.password);

    for (const u of USERS) {
      await page.goto('/settings/users/new');
      await fillFluent(page, 'first', u.first);
      await fillFluent(page, 'last', u.last);
      await fillFluent(page, 'email', u.email);
      await fillFluent(page, 'pw', INITIAL_PASSWORD);
      // Role defaults to "User" and Status to "Active" — leave the defaults.
      await page.getByRole('button', { name: /create user/i }).click();

      await expect(page).toHaveURL(/\/settings$/);
      await expect(page.getByRole('cell', { name: u.email })).toBeVisible();
    }
  });

  test('deactivates the two users', async ({ page }) => {
    await loginExpectingShell(page, ACCOUNTS.orgAdmin.email, ACCOUNTS.orgAdmin.password);

    for (const u of USERS) {
      await page.goto('/settings');
      await page.getByRole('row', { name: new RegExp(u.email) }).getByRole('link', { name: 'Edit' }).click();
      await expect(page).toHaveURL(/\/settings\/users\//);

      await selectFluent(page, 'status', 'Inactive');
      await page.getByRole('button', { name: /save changes/i }).click();

      await expect(page).toHaveURL(/\/settings$/);
      await expect(page.getByRole('row', { name: new RegExp(u.email) }).getByText('Inactive')).toBeVisible();
    }
  });
});
