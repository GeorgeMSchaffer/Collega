import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Where the suite's database is, worked out once and read by both the config and the global setup.
 *
 * **This lives in its own module because of when Playwright evaluates things.** `webServer[].env` in
 * `playwright.config.ts` is a plain object literal, evaluated when that module loads — which is
 * strictly *before* `globalSetup` runs. So a global setup that writes `COLLEGA_E2E_DATABASE_URL`
 * back into `process.env` writes it too late to be read: the servers were already handed whatever
 * the variable held at config time, which was nothing.
 *
 * That was the shape of a real defect. With `DATABASE_URL: ''` the Nest host falls back to the
 * `POSTGRES_*` parts in `.env` and composes a connection string with no `?schema=` — the developer's
 * own `public` schema. So the setup dropped and rebuilt `collega_e2e` on every run, seeded it, and
 * then the whole suite ran against `public` and wrote its organizations, users and ideas into the
 * database `pnpm dev` uses. Fourteen "Journey Co" organizations had accumulated there before anyone
 * looked (2026-09-14). Every isolation claim in `global-setup.ts` was true of a schema nothing
 * touched.
 *
 * Both callers importing one function is what keeps that from drifting apart again: the config
 * cannot derive a different answer from the setup, because there is only one derivation.
 */

const HERE = dirname(fileURLToPath(import.meta.url))

/**
 * The repository's own `.env`, loaded before anything reads `process.env`.
 *
 * Playwright starts this process itself, so nothing else has loaded it — `pnpm dev` loads the same
 * file through `tools/local/start.ts`. Real environment variables win, which is what lets CI point
 * `DATABASE_URL` or `COLLEGA_E2E_DATABASE_URL` somewhere else without editing a file.
 */
export function loadRepositoryEnv(): void {
  const envFile = resolve(HERE, '..', '.env')
  if (existsSync(envFile)) process.loadEnvFile(envFile)
}

/**
 * The suite's connection string: its own schema inside whatever database is configured.
 *
 * `COLLEGA_E2E_DATABASE_URL` overrides it outright, for CI with a database of its own.
 */
export function e2eDatabaseUrl(): string {
  const explicit = process.env.COLLEGA_E2E_DATABASE_URL?.trim()
  if (explicit) return explicit

  const base = process.env.DATABASE_URL?.trim()
  if (!base) {
    throw new Error(
      'Neither COLLEGA_E2E_DATABASE_URL nor DATABASE_URL is set.\n\n' +
        'The E2E suite needs a database it may drop. Run `pnpm dev` once to write DATABASE_URL into\n' +
        '.env, or set COLLEGA_E2E_DATABASE_URL to a throwaway of your own.',
    )
  }

  const url = new URL(base)
  url.searchParams.set('schema', 'collega_e2e')
  return url.toString()
}
