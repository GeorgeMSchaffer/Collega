import { test, expect } from '@playwright/test';
import { ACCOUNTS, loginExpectingShell, fillFluent } from './helpers';

/**
 * Flows 6, 7 & 8 — an Org Admin creates a board that allows User status moves; a User adds a card to
 * it (via the IdeaCreateModal); the User then moves the card through all of the board's statuses (via
 * the IdeaDrawer status control — the same server call the Kanban drag makes; native HTML5 drag under
 * Blazor is unreliable to automate, see e2e/README.md).
 *
 * The three steps share the board created in step 1 (captured board id), so they run serially.
 */
const stamp = Date.now();
const BOARD_NAME = `E2E Board ${stamp}`;
const CARD_TITLE = `E2E Card ${stamp}`;
let boardId = '';

test.describe.serial('Board, card, and status moves', () => {
  test('Org Admin creates a board with User moves allowed', async ({ page }) => {
    await loginExpectingShell(page, ACCOUNTS.orgAdmin.email, ACCOUNTS.orgAdmin.password);
    await page.goto('/settings/boards/new');

    await fillFluent(page, 'name', BOARD_NAME);
    // The "Allow Users to move ideas between statuses" checkbox is checked by default — keep it so a
    // plain User can move cards in flow 8.
    await expect(page.locator('input[type=checkbox]')).toBeChecked();

    // Add three statuses from the Available column so the card can move through several lanes.
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
  });

  test('User adds a card to the board', async ({ page }) => {
    await loginExpectingShell(page, ACCOUNTS.user.email, ACCOUNTS.user.password);
    await page.goto(`/board/${boardId}`);

    await page.getByRole('button', { name: /new idea/i }).click();

    // IdeaCreateModal — native inputs. Idea type / Business impact default to their first option;
    // the Create button stays disabled until the board context finishes loading.
    await page.locator('#cr-title').fill(CARD_TITLE);
    await page.locator('#cr-desc').fill('Created by the E2E suite.');
    await expect(page.locator('#cr-type option')).not.toHaveCount(0);
    await page.locator('#cr-type').selectOption({ index: 0 });
    await page.locator('#cr-impact').selectOption({ index: 0 });

    const createButton = page.getByRole('button', { name: /create idea/i });
    await expect(createButton).toBeEnabled();
    await createButton.click();

    // The modal closes and the new card appears on the board.
    await expect(page.getByText(CARD_TITLE, { exact: true })).toBeVisible();
  });

  test('User moves the card through all statuses', async ({ page }) => {
    await loginExpectingShell(page, ACCOUNTS.user.email, ACCOUNTS.user.password);
    await page.goto(`/board/${boardId}`);

    // Click the card to open the Idea drawer.
    await page.getByText(CARD_TITLE, { exact: true }).click();

    // The drawer's status control (sr-only label "Move in board") lists the board's swimlanes.
    const statusSelect = page.getByLabel('Move in board');
    await expect(statusSelect).toBeVisible();

    const optionLabels = (await statusSelect.locator('option').allTextContents()).map((s) => s.trim());
    expect(optionLabels.length).toBeGreaterThanOrEqual(3);

    // Move through every status in order; after each successful move the chosen option is selected.
    for (const label of optionLabels) {
      await statusSelect.selectOption({ label });
      await expect(statusSelect.locator('option:checked')).toHaveText(label);
    }
  });
});
