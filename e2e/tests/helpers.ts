import { Page, Locator, expect } from '@playwright/test';

/** Seeded accounts in the CollegaE2E database (Development demo seed + configured Site Admin). */
export const ACCOUNTS = {
  siteAdmin: { email: 'admin@collega.local', password: 'rsbr220Sql!' },
  orgAdmin: { email: 'orgadmin@acme-robotics.demo.collega.test', password: 'Abc123!' },
  user: { email: 'user@acme-robotics.demo.collega.test', password: 'Abc123!' },
};

/** A valid password per the policy (upper, lower, digit, symbol, >= 8). */
export const NEW_SITE_ADMIN_PASSWORD = 'NewPass123!';

/**
 * Fill a Fluent UI Blazor text field by the host element id. `<fluent-text-field id="x">` keeps its
 * real <input> in a shadow root and is not a labelable target, so we target the inner control (Playwright
 * pierces open shadow DOM) rather than getByLabel.
 */
export async function fillFluent(page: Page, hostId: string, value: string): Promise<void> {
  await page.locator(`#${hostId}`).locator('input, textarea').first().fill(value);
}

/**
 * Choose an option in a Fluent UI Blazor `<fluent-select id="x">` (a custom combobox, not a native
 * select): open it, then click the option by its visible label.
 */
export async function selectFluent(page: Page, hostId: string, optionLabel: string): Promise<void> {
  await page.locator(`#${hostId}`).click();
  await page.getByRole('option', { name: optionLabel, exact: true }).click();
}

/** Sign in through the real login form. Does not assert the destination (varies by account state). */
export async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await fillFluent(page, 'email', email);
  await fillFluent(page, 'password', password);
  await page.getByRole('button', { name: /sign in/i }).click();
}

/** Sign in and assert we land in the authenticated shell (not bounced back to /login). */
export async function loginExpectingShell(page: Page, email: string, password: string): Promise<void> {
  await login(page, email, password);
  await expect(page).not.toHaveURL(/\/login/);
  // The 64px rail is present on every authenticated screen.
  await expect(page.locator('aside.rail')).toBeVisible();
}

/** Sign out (the /logout route clears the session and returns to login). */
export async function logout(page: Page): Promise<void> {
  await page.goto('/logout');
  await expect(page).toHaveURL(/\/login/);
}
