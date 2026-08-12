import { test, expect } from '@playwright/test';
import { ACCOUNTS, loginExpectingShell, fillFluent } from './helpers';

/**
 * Flows 4 & 5 — as an Org Admin, add a status, then delete it.
 * A fresh, unreferenced status is used so the delete isn't blocked by the "status in use by a board"
 * guard, and the demo org has >2 active statuses so the 2-active floor is not tripped.
 */
const stamp = Date.now();
const STATUS_NAME = `E2E Status ${stamp}`;

test.describe.serial('Org Admin status management', () => {
  test('adds a status', async ({ page }) => {
    await loginExpectingShell(page, ACCOUNTS.orgAdmin.email, ACCOUNTS.orgAdmin.password);
    await page.goto('/settings/statuses');

    await page.getByRole('button', { name: /new status/i }).click();
    await fillFluent(page, 'name', STATUS_NAME);
    // Color and sort order keep their defaults.
    await page.getByRole('button', { name: /^save$/i }).click();

    await expect(page.getByRole('cell', { name: STATUS_NAME })).toBeVisible();
  });

  test('deletes the created status', async ({ page }) => {
    await loginExpectingShell(page, ACCOUNTS.orgAdmin.email, ACCOUNTS.orgAdmin.password);
    await page.goto('/settings/statuses');

    await page.getByRole('row', { name: new RegExp(STATUS_NAME) }).getByRole('button', { name: 'Delete' }).click();

    await expect(page.getByRole('cell', { name: STATUS_NAME })).toHaveCount(0);
  });
});
