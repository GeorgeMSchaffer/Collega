import { test, expect } from '@playwright/test';
import { ACCOUNTS, loginExpectingShell, fillFluent } from './helpers';

/**
 * Critical-path story: admin delete of an idea via the drawer danger zone (IdeaDrawer.razor). Delete is
 * Org-Admin+ only (_canDelete), so the whole flow runs as Org Admin: it creates a throwaway board +
 * idea, opens the drawer, deletes it, and asserts the drawer closes, the idea leaves the list, and a
 * deep-link to the now-deleted idea can no longer load it.
 *
 * Serial: the delete test consumes the fixture created in setup.
 */
const stamp = Date.now();
const BOARD_NAME = `E2E Delete Board ${stamp}`;
const IDEA_TITLE = `E2E Delete Idea ${stamp}`;
let boardId = '';
let ideaId = '';

test.describe.serial('Idea admin delete', () => {
  test('setup: Org Admin creates a board and an idea on it', async ({ page }) => {
    await loginExpectingShell(page, ACCOUNTS.orgAdmin.email, ACCOUNTS.orgAdmin.password);

    await page.goto('/settings/boards/new');
    await fillFluent(page, 'name', BOARD_NAME);
    await expect(page.locator('input[type=checkbox]')).toBeChecked();
    // A board needs at least two swimlanes; add a few from the Available column (mirrors spec 04).
    for (let i = 0; i < 3; i++) {
      await page.getByRole('button', { name: 'Add' }).first().click();
    }
    await page.getByRole('button', { name: /create board/i }).click();
    await expect(page).toHaveURL(/\/settings\/boards$/);

    const editHref = await page
      .getByRole('row', { name: new RegExp(BOARD_NAME) })
      .getByRole('link', { name: 'Edit' })
      .getAttribute('href');
    boardId = editHref!.split('/').pop()!;
    expect(boardId).toBeTruthy();

    await page.goto(`/board/${boardId}`);
    await page.getByRole('button', { name: /new idea/i }).click();
    await page.locator('#cr-title').fill(IDEA_TITLE);
    await page.locator('#cr-desc').fill('Delete fixture created by the E2E suite.');
    await expect(page.locator('#cr-type option')).not.toHaveCount(0);
    await page.locator('#cr-type').selectOption({ index: 0 });
    await page.locator('#cr-impact').selectOption({ index: 0 });
    const createButton = page.getByRole('button', { name: /create idea/i });
    await expect(createButton).toBeEnabled();
    await createButton.click();
    await expect(page.getByText(IDEA_TITLE, { exact: true })).toBeVisible();
  });

  test('Org Admin deletes the idea from the drawer danger zone', async ({ page }) => {
    await loginExpectingShell(page, ACCOUNTS.orgAdmin.email, ACCOUNTS.orgAdmin.password);
    await page.goto('/ideas');

    const row = page.getByRole('row', { name: new RegExp(IDEA_TITLE) });
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: 'Details' }).click();
    await expect(page.getByRole('heading', { name: IDEA_TITLE })).toBeVisible();
    ideaId = new URL(page.url()).searchParams.get('idea') ?? '';
    expect(ideaId).toBeTruthy();

    // Danger zone: first click arms the confirm, second click deletes.
    await page.getByRole('button', { name: 'Delete idea' }).click();
    await expect(page.getByText("Delete this idea? This can't be undone.")).toBeVisible();
    await page.getByRole('button', { name: 'Confirm delete' }).click();

    // The drawer closes (host navigates back to /ideas, dropping the ?idea= param) and the idea is gone
    // from the list.
    await expect(page).toHaveURL(/\/ideas$/);
    await expect(page.getByRole('heading', { name: IDEA_TITLE })).toHaveCount(0);
    await expect(page.getByRole('row', { name: new RegExp(IDEA_TITLE) })).toHaveCount(0);
  });

  test('a deep-link to the deleted idea no longer loads it', async ({ page }) => {
    await loginExpectingShell(page, ACCOUNTS.orgAdmin.email, ACCOUNTS.orgAdmin.password);
    await page.goto(`/ideas?idea=${encodeURIComponent(ideaId)}`);

    // The drawer opens but the idea can't be fetched (soft-deleted, excluded from reads): the header
    // falls back to "Idea unavailable" and the original title never renders.
    await expect(page.getByRole('heading', { name: 'Idea unavailable' })).toBeVisible();
    await expect(page.getByRole('heading', { name: IDEA_TITLE })).toHaveCount(0);
  });
});
