import { test, expect } from '@playwright/test';
import { ACCOUNTS, loginExpectingShell, fillFluent } from './helpers';

/**
 * Critical-path stories 7 & 9 (see tests/Collega.E2E.Tests/CLAUDE.md catalog): the right slide-in
 * IdeaDrawer and its engagement surface — the app's core reason to exist, previously uncovered by any
 * browser test.
 *
 *   7 — Idea detail opens as a drawer; it is URL-addressable via /ideas?idea={id} and bare /ideas/{id};
 *       the retired /ideas/{id}/edit route no longer opens an editor.
 *   9 — Upvote, comment (incl. an @email mention token), tags, assignees, and a status move, all through
 *       the drawer, each persisting across a reload.
 *
 * A dedicated board + idea is created in setup (the board "New idea" button opens IdeaCreateModal
 * directly — the /ideas "Add New" path is intentionally avoided here because it currently opens the
 * brainstorm modal first). Tests are serial and share that fixture, so run in order.
 *
 * Selectors were derived from the live components (IdeaDrawer.razor / IdeaCreateModal.razor) but have
 * not yet been run against a live browser+API+DB stack — verify on first execution, then flip the
 * catalog rows to ✅.
 */
const stamp = Date.now();
const BOARD_NAME = `E2E Drawer Board ${stamp}`;
const IDEA_TITLE = `E2E Drawer Idea ${stamp}`;
const TAG = `e2e-tag-${stamp}`;
let boardId = '';
let ideaId = '';

test.describe.serial('Idea drawer & engagement', () => {
  test('setup: Org Admin creates a board; User creates an idea on it', async ({ page }) => {
    await loginExpectingShell(page, ACCOUNTS.orgAdmin.email, ACCOUNTS.orgAdmin.password);
    await page.goto('/settings/boards/new');
    await fillFluent(page, 'name', BOARD_NAME);
    // Keep "Allow Users to move ideas between statuses" checked so the User can move the card in this suite.
    await expect(page.locator('input[type=checkbox]')).toBeChecked();
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

    // A plain User authors the idea (create modal opens directly from the board header).
    await loginExpectingShell(page, ACCOUNTS.user.email, ACCOUNTS.user.password);
    await page.goto(`/board/${boardId}`);
    await page.getByRole('button', { name: /new idea/i }).click();
    await page.locator('#cr-title').fill(IDEA_TITLE);
    await page.locator('#cr-desc').fill('Drawer engagement fixture created by the E2E suite.');
    await expect(page.locator('#cr-type option')).not.toHaveCount(0);
    await page.locator('#cr-type').selectOption({ index: 0 });
    await page.locator('#cr-impact').selectOption({ index: 0 });
    const createButton = page.getByRole('button', { name: /create idea/i });
    await expect(createButton).toBeEnabled();
    await createButton.click();
    await expect(page.getByText(IDEA_TITLE, { exact: true })).toBeVisible();
  });

  test('drawer opens from the Ideas list and is URL-addressable', async ({ page }) => {
    await loginExpectingShell(page, ACCOUNTS.user.email, ACCOUNTS.user.password);
    await page.goto('/ideas');

    // Find our idea's row and open the drawer via its Details button.
    const row = page.getByRole('row', { name: new RegExp(IDEA_TITLE) });
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: 'Details' }).click();

    // Drawer shows the idea title as its heading, and the URL carries ?idea={id}.
    await expect(page.getByRole('heading', { name: IDEA_TITLE })).toBeVisible();
    await expect(page).toHaveURL(/\/ideas\?idea=/);
    ideaId = new URL(page.url()).searchParams.get('idea') ?? '';
    expect(ideaId).toBeTruthy();

    // Deep-link 1: query form survives a fresh navigation/reload.
    await page.goto(`/ideas?idea=${encodeURIComponent(ideaId)}`);
    await expect(page.getByRole('heading', { name: IDEA_TITLE })).toBeVisible();

    // Deep-link 2: bare /ideas/{id} route opens the same drawer.
    await page.goto(`/ideas/${encodeURIComponent(ideaId)}`);
    await expect(page.getByRole('heading', { name: IDEA_TITLE })).toBeVisible();

    // Retired route: /ideas/{id}/edit must NOT open an idea editor (no matching route anymore).
    await page.goto(`/ideas/${encodeURIComponent(ideaId)}/edit`);
    await expect(page.getByRole('button', { name: /upvote this idea/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /save changes/i })).toHaveCount(0);
  });

  test('User upvotes and comments (with an @mention token)', async ({ page }) => {
    await loginExpectingShell(page, ACCOUNTS.user.email, ACCOUNTS.user.password);
    await page.goto(`/ideas?idea=${encodeURIComponent(ideaId)}`);

    // Upvote: the toggle flips its accessible name; the change persists across reload.
    await page.getByRole('button', { name: /upvote this idea/i }).click();
    await expect(page.getByRole('button', { name: /remove your upvote/i })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: /remove your upvote/i })).toBeVisible();

    // Comment: an email with @ is a mention token (delivery is persisted server-side, verified there;
    // here we only assert the comment renders).
    const commentBody = `E2E comment ${stamp} for @${ACCOUNTS.orgAdmin.email}`;
    await page.getByRole('textbox', { name: 'Add a comment' }).fill(commentBody);
    await page.getByRole('button', { name: /post comment/i }).click();
    await expect(page.getByText(commentBody, { exact: false })).toBeVisible();
    await page.reload();
    await expect(page.getByText(commentBody, { exact: false })).toBeVisible();
  });

  test('User edits their idea: adds a tag and an assignee, then saves', async ({ page }) => {
    // Edited by the authoring User (not an admin): the assignee picker is populated by
    // GET /organizations/{id}/members, which any in-org caller may read, and the creating author may
    // change the assignee collection (SPEC/20-feature-ideas-and-engagement.md Permissions).
    await loginExpectingShell(page, ACCOUNTS.user.email, ACCOUNTS.user.password);
    await page.goto(`/ideas?idea=${encodeURIComponent(ideaId)}`);

    await page.getByRole('button', { name: 'Edit idea' }).click();
    await expect(page.locator('#ed-title')).toHaveValue(IDEA_TITLE);

    // Add a unique tag.
    await page.getByPlaceholder('Add a tag').fill(TAG);
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.locator('.editchip', { hasText: TAG })).toBeVisible();

    // Add the first assignable user (the select's first real option after the "Add assignee…" prompt).
    const assigneeSelect = page.locator('select:has(option:text-is("Add assignee…"))');
    await assigneeSelect.selectOption({ index: 1 });
    await expect(page.locator('.chips .editchip')).not.toHaveCount(0);

    await page.getByRole('button', { name: /save changes/i }).click();

    // Back in the read view the tag is shown and survives a reload.
    await expect(page.getByText(TAG, { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText(TAG, { exact: true })).toBeVisible();
    await expect(page.getByText('Unassigned')).toHaveCount(0);
  });

  test('User moves the idea to a different status from the drawer', async ({ page }) => {
    await loginExpectingShell(page, ACCOUNTS.user.email, ACCOUNTS.user.password);
    await page.goto(`/ideas?idea=${encodeURIComponent(ideaId)}`);

    const statusSelect = page.getByLabel('Move in board');
    await expect(statusSelect).toBeVisible();
    const options = (await statusSelect.locator('option').allTextContents()).map((s) => s.trim());
    expect(options.length).toBeGreaterThanOrEqual(2);

    // Move to the last status (guaranteed different from the create default, which is the first lane).
    await statusSelect.selectOption({ label: options[options.length - 1] });
    await expect(page.getByText('Status updated.')).toBeVisible();

    // The move persists: reopening the drawer shows the new status selected.
    await page.goto(`/ideas?idea=${encodeURIComponent(ideaId)}`);
    await expect(page.getByLabel('Move in board').locator('option:checked')).toHaveText(
      options[options.length - 1],
    );
  });
});
