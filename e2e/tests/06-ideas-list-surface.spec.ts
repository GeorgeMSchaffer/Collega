import { test, expect } from '@playwright/test';
import { ACCOUNTS, loginExpectingShell } from './helpers';

/**
 * Critical-path story 11 — the global /ideas surface: scope chips (All / Created by me / Assigned to me),
 * server-side search, sortable column headers, and paging. These are read-only assertions against the
 * demo seed (no mutation), so they don't depend on a fresh DB the way the stateful flows do.
 *
 * Selectors derived from Pages/Ideas.razor; verify on first live run, then flip the catalog rows.
 */
test.describe.serial('Ideas list surface', () => {
  test('scope chips, search, and clear', async ({ page }) => {
    await loginExpectingShell(page, ACCOUNTS.user.email, ACCOUNTS.user.password);
    await page.goto('/ideas');

    // The three scope chips are present; "All" starts active.
    const allChip = page.getByRole('button', { name: 'All', exact: true });
    await expect(allChip).toHaveClass(/on/);
    await expect(page.getByRole('button', { name: 'Created by me' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Assigned to me' })).toBeVisible();

    // Switching scope activates the chosen chip.
    await page.getByRole('button', { name: 'Created by me' }).click();
    await expect(page.getByRole('button', { name: 'Created by me' })).toHaveClass(/on/);

    // Search: typing a query that matches nothing yields the empty state; Clear restores the list.
    await page.getByRole('button', { name: 'All', exact: true }).click();
    const search = page.getByPlaceholder('Search title & text fields…');
    await search.fill(`zzz-no-match-${Date.now()}`);
    // The input binds on @onchange; a programmatic fill()+blur() doesn't raise Blazor's change event,
    // so dispatch it explicitly to trigger the server-side search reload.
    await search.dispatchEvent('change');
    await expect(page.getByText('No ideas match this filter')).toBeVisible();
    await page.getByRole('button', { name: 'Clear' }).click();
    await expect(page.getByText('No ideas match this filter')).toHaveCount(0);
  });

  test('sortable column headers toggle sort direction', async ({ page }) => {
    await loginExpectingShell(page, ACCOUNTS.user.email, ACCOUNTS.user.password);
    await page.goto('/ideas');

    // Default sort is Created desc; the Title header is sortable and reflects aria-sort when clicked.
    const titleHeader = page.getByRole('columnheader', { name: /^Title/ });
    await titleHeader.click();
    await expect(titleHeader).toHaveAttribute('aria-sort', 'ascending');
    await titleHeader.click();
    await expect(titleHeader).toHaveAttribute('aria-sort', 'descending');
  });

  test('page-size control is present with the documented options', async ({ page }) => {
    await loginExpectingShell(page, ACCOUNTS.user.email, ACCOUNTS.user.password);
    await page.goto('/ideas');

    // The pager only renders when there are results; the demo seed has ideas for the demo user.
    const sizeSelect = page.locator('.pager select');
    await expect(sizeSelect).toBeVisible();
    const sizes = (await sizeSelect.locator('option').allTextContents()).map((s) => s.trim());
    expect(sizes).toEqual(['25', '50', '100', '250']);
  });
});
