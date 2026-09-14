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
 * Collega browser E2E. Drives the whole application - `apps/web` on :3000 against `apps/api` on
 * :3001 - both started by Playwright, so `pnpm test:e2e` needs nothing running beforehand.
 *
 * The suite this replaces drove the frozen Blazor client at :5098 against the .NET API at :5103,
 * and its seven specs were retired with it (see e2e/README.md).
 *
 * **The API is here because the screens need it.** `/boards`, `/boards/[boardId]`, `/ideas` and
 * `/ideas/[ideaId]` stopped reading `lib/mock.ts` during Wave D - they `fetch` `apps/api` - and with
 * no API running they fail *at render*, so a spec written over any of them failed however carefully
 * it was written. That was the gate on every product spec, and this config is F2 removing it.
 *
 * `global-setup.ts` drops and rebuilds a schema of its own before either server starts, so a run
 * begins from the seeded state rather than from whatever the last run left. It refuses to do that
 * to anything but a local `collega_e2e` schema; read its comments before pointing it anywhere.
 *
 * **Order matters here.** Playwright starts `webServer` entries in parallel, so the web app may be
 * ready before the API is - but the web app renders nothing that fetches until a test navigates,
 * and each entry's own `url` is polled until it answers. The API's is its health endpoint, which
 * depends on nothing, so it answers as soon as the host is listening.
 */
export default defineConfig({
  testDir: './tests',
  globalSetup: './global-setup.ts',
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
  webServer: [
    {
      // Built output rather than a watcher, matching `tools/local/start.ts`: nothing in a test run
      // edits the API, and `global-setup.ts` has already built it.
      //
      // `DATABASE_URL` is read from the variable global setup writes back, so this starts against
      // the schema it just rebuilt. Re-deriving it here could answer differently and the failure
      // would look like a seeding bug.
      command: 'node apps/api/dist/bootstrap.js',
      cwd: '..',
      // Health depends on nothing, so it answers the moment the host is listening - which is what
      // makes it the right readiness probe rather than a route that needs the database.
      url: 'http://localhost:3001/api/v1/health',
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
      stdout: 'ignore',
      stderr: 'pipe',
      env: {
        PORT: '3001',
        DATABASE_URL: process.env.COLLEGA_E2E_DATABASE_URL ?? '',
        NODE_ENV: 'test',
        // Deterministic across runs, and never a real key: the token this signs lives for the
        // length of one suite.
        ACCESS_TOKEN_SIGNING_KEY: 'e2e-signing-key-not-a-secret-32-chars-min',
        // The config fragment requires these at boot (auth requirement #8), but nothing in a test
        // run uses them: `db:bootstrap-admin` is not part of this setup, and the specs sign in as
        // the seeded demo accounts. A deliberately unused address, so it cannot be mistaken for one.
        SITE_ADMIN_EMAIL: 'unused-by-e2e@collega.invalid',
        SITE_ADMIN_PASSWORD: 'NotUsed!ByAnySpec1',
      },
    },
    {
      // Through turbo, from the repository root, because `@collega/design-system` resolves to its
      // `dist/` - so `next dev` on its own fails to resolve every primitive on a fresh clone. The
      // `dev` task already declares `^build`; this reuses that graph rather than restating it.
      //
      // `dev` rather than `build && start`: a cold production build costs more than it buys, and
      // the screens render the same either way.
      command: 'pnpm exec turbo run dev --filter=@collega/web',
      cwd: '..',
      url: 'http://localhost:3000/login',
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
      stdout: 'ignore',
      stderr: 'pipe',
      // No COLLEGA_API_URL: `apps/web/lib/api/config.ts` defaults to this exact address, and setting
      // it here would hide the day that default stops being right. `tools/local/start.ts` makes the
      // same choice for the same reason.
      env: { PORT: '3000', NODE_ENV: 'test' },
    },
  ],
})
