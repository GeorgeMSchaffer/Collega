import { defineConfig, devices } from '@playwright/test'

/**
 * Where to find a Chromium, when the one Playwright wants is not downloadable.
 *
 * Claude Code on the web ships a Chromium but blocks `cdn.playwright.dev`, and the build it ships
 * is not the build this Playwright pins - so neither `playwright install` nor the bundled default
 * resolves. `.claude/hooks/session-start.sh` points this at the browser that is actually present.
 * Unset everywhere else, which is the normal case: Playwright uses its own download.
 */
const chromiumPath = process.env.PLAYWRIGHT_CHROMIUM_PATH

/**
 * Collega browser E2E. Drives `apps/web` (Next.js, http://localhost:3000), which Playwright starts
 * itself - so `pnpm test:e2e` needs nothing running beforehand.
 *
 * The suite this replaces drove the frozen Blazor client at :5098 against the .NET API at :5103,
 * and its seven specs were retired with it (see e2e/README.md). What remains here is the harness:
 * F2 owns the flows that go back on top of it.
 *
 * `apps/web` still reads `lib/mock.ts`, so nothing here reaches a database or an API yet. When
 * Wave D lands, `apps/api` becomes a second `webServer` entry and the fixtures give way to a seed.
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
    baseURL: 'http://localhost:3000',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(chromiumPath ? { launchOptions: { executablePath: chromiumPath } } : {}),
      },
    },
  ],
  webServer: {
    // Through turbo, from the repository root, because `@collega/design-system` resolves to its
    // `dist/` - so `next dev` on its own fails to resolve every primitive on a fresh clone. The
    // `dev` task already declares `^build`; this reuses that graph rather than restating it.
    //
    // `dev` rather than `build && start`: the fixtures are in-process either way, and a cold
    // production build costs more than it buys while there is no server data to render.
    command: 'pnpm exec turbo run dev --filter=@collega/web',
    cwd: '..',
    url: 'http://localhost:3000/login',
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
    stderr: 'pipe',
  },
})
