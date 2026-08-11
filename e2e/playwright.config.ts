import { defineConfig, devices } from '@playwright/test';

/**
 * Collega browser E2E. Drives the Blazor WASM client (http://localhost:5098) against the live API
 * (http://localhost:5103) and a throwaway SQL database. The flows are stateful and ordered, so tests
 * run serially (workers: 1, fullyParallel: false).
 *
 * Prerequisites (see e2e/README.md): SQL Server up, API running on :5103 against a FRESH CollegaE2E
 * database (Development env so demo orgs/users are seeded and the Site Admin still requires a first-
 * login password change), and the client running on :5098.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5098',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
