import { defineConfig, devices } from '@playwright/test'
import { e2eDatabaseUrl, loadRepositoryEnv } from './database-url'

// Before anything below reads `process.env` - `webServer[].env` is evaluated as this module loads.
loadRepositoryEnv()

/**
 * The schema every server below is pointed at.
 *
 * Derived here rather than read back from what `global-setup.ts` exports into the environment,
 * because this object literal is evaluated before global setup runs - see `database-url.ts` for
 * what that cost when it was the other way round.
 */
const DATABASE_URL = e2eDatabaseUrl()

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
 * The two ports, 3000 and 3001 unless overridden - so the suite can run beside a `pnpm dev` (or
 * another checkout's run) that already holds them. `reuseExistingServer` would otherwise quietly
 * drive whatever app answers there, against whatever database it has.
 */
const WEB_PORT = process.env.COLLEGA_E2E_WEB_PORT?.trim() || '3000'
const API_PORT = process.env.COLLEGA_E2E_API_PORT?.trim() || '3001'

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
 * **Order matters here, and it is not the order this file reads in.** Playwright starts both
 * `webServer` entries in parallel and waits for each one's `url` to answer; only then does it run
 * `globalSetup`, and only after that the tests. So:
 *
 * 1. Each server builds what it runs as part of its own command. Global setup is too late to build
 *    anything a server needs - it runs after the servers are up, which is how a fresh checkout came
 *    to fail with no `apps/api/dist` to start.
 * 2. `global-setup.ts` then drops, migrates and seeds the suite's own schema while the API is
 *    already listening. That is safe because nothing has touched the database yet: the Prisma
 *    client connects lazily on its first query (the API never calls `$connect` and runs no query at
 *    boot), the readiness probe below is a route that needs no database, and no test runs until
 *    global setup returns. A query at boot would break that, so keep boot database-free.
 *
 * `e2eDatabaseUrl()` below refuses anything but a local `collega_e2e` schema, so a bad URL stops the
 * run here, before either server starts; read `database-url.ts` before pointing it anywhere.
 *
 * The web app may be ready before the API is, which does not matter: it renders nothing that
 * fetches until a test navigates.
 */
export default defineConfig({
  testDir: './tests',
  globalSetup: './global-setup.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  // `record.mjs` adds a JSON reporter through the environment so it can read the run back in
  // declaration order; an ordinary run keeps just the list.
  reporter: process.env.COLLEGA_E2E_VIDEO === 'on' ? [['list'], ['json']] : [['list']],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',

    /**
     * Video, and why it is worth keeping on a pass.
     *
     * `COLLEGA_E2E_VIDEO=on` records every test rather than only the ones that fail, which is how
     * you watch the suite instead of reading its output. A green run that nobody has watched is a
     * green run nobody has checked: these specs drive real screens, so the recording is the only
     * artefact that shows what the screens actually looked like while they passed.
     *
     * Off by default because a full run writes a file per test and none of it is wanted in CI.
     * `pnpm --filter collega-e2e test:record` sets it.
     */
    video: process.env.COLLEGA_E2E_VIDEO === 'on' ? 'on' : 'retain-on-failure',
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
  },
  projects: [
    /**
     * Signs in once per seeded role and saves the cookie; everything else depends on it.
     *
     * The suite used to sign in twenty-seven times per run against a login limit of twenty per
     * minute, so running it whole exhausted the limiter and failed specs that were not about
     * authentication - see `tests/auth.setup.ts`. Its own sign-ins are real, which is why it is a
     * project rather than a `globalSetup` step: it needs a browser.
     */
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        ...(chromiumPath ? { launchOptions: { executablePath: chromiumPath } } : {}),
      },
    },
    {
      name: 'chromium',
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        ...(chromiumPath ? { launchOptions: { executablePath: chromiumPath } } : {}),
      },
    },
  ],
  webServer: [
    {
      // Built output rather than a watcher, matching `tools/local/start.ts`: nothing in a test run
      // edits the API. Built here, before it starts, because this command is the first thing
      // Playwright runs - see the order above - and `collega-e2e` depends on no workspace package,
      // so turbo's `^build` for this task builds nothing. Turbo caches, so a warm run costs seconds.
      command: 'pnpm exec turbo run build --filter=@collega/api && node apps/api/dist/bootstrap.js',
      cwd: '..',
      // Health depends on nothing, so it answers the moment the host is listening - which is what
      // makes it the right readiness probe rather than a route that needs the database.
      url: `http://localhost:${API_PORT}/api/v1/health`,
      // Covers a cold build of the API and every package beneath it, Prisma generate included.
      timeout: 240_000,
      reuseExistingServer: !process.env.CI,
      stdout: 'ignore',
      stderr: 'pipe',
      // The same DATABASE_URL global setup rebuilds, from the same function, so the server cannot
      // end up pointed at a different schema than the one that was just seeded.
      env: {
        PORT: API_PORT,
        DATABASE_URL,
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
      //
      // On other ports the app is started the way `tools/local/start.ts` starts it: turbo's strict
      // environment would drop the COLLEGA_API_URL below, and the web app would then quietly call
      // whatever API holds :3001.
      command:
        WEB_PORT === '3000' && API_PORT === '3001'
          ? 'pnpm exec turbo run dev --filter=@collega/web'
          : `pnpm exec turbo run build --filter=@collega/design-system && pnpm --filter @collega/web exec next dev --port ${WEB_PORT}`,
      cwd: '..',
      url: `http://localhost:${WEB_PORT}/login`,
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
      stdout: 'ignore',
      stderr: 'pipe',
      // No COLLEGA_API_URL on the default ports: `apps/web/lib/api/config.ts` defaults to this exact
      // address, and setting it here would hide the day that default stops being right.
      // `tools/local/start.ts` makes the same choice for the same reason.
      env: {
        PORT: WEB_PORT,
        NODE_ENV: 'test',
        ...(API_PORT === '3001' ? {} : { COLLEGA_API_URL: `http://127.0.0.1:${API_PORT}/api/v1` }),
      },
    },
  ],
})
