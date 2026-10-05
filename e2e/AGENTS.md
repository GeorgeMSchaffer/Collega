# e2e

The Playwright suite. Separate from `pnpm check` because it runs the whole application:
`pnpm test:e2e` from the repository root. `README.md` has the longer story (what the screens can
see, the retired flows, recording a run); this file is what to know before touching a spec.

## What a run does

`playwright.config.ts` is the authority; its header comment explains the order. In short:

1. Playwright starts two `webServer` entries in parallel, each building what it runs first:
   `apps/api` (`turbo run build --filter=@collega/api`, then `node apps/api/dist/bootstrap.js`) and
   `apps/web` (`next dev`, after turbo builds `@collega/design-system`). Turbo caches, so only a
   cold checkout pays for the build.
2. Once both answer, `global-setup.ts` drops and recreates the `collega_e2e` schema, migrates it and
   seeds the demo data. The API is already listening; that is safe only because it runs no query
   at boot. Keep it that way.
3. The `setup` project (`tests/auth.setup.ts`) signs each seeded role in once, then the specs run —
   one worker, no retries, one shared database.

## Database

- A **schema**, not a database: `collega_e2e` inside `DATABASE_URL` (read from the root `.env`,
  which `pnpm dev` writes), so `public` is untouched. `COLLEGA_E2E_DATABASE_URL` replaces the whole
  URL; it must carry `?schema=collega_e2e`.
- `e2eDatabaseUrl()` refuses any other schema and any non-local host, so the config stops before any
  server starts, and global setup checks again before it drops. Don't loosen that.
- Every run starts from the seed. Specs may change data, and a later spec in the same run sees it.

## Ports

`COLLEGA_E2E_WEB_PORT` and `COLLEGA_E2E_API_PORT` (default 3000 and 3001) let a run sit beside
`pnpm dev` or another checkout. Outside CI `reuseExistingServer` is on: whatever already answers on
those ports is what gets driven, against whatever database it has, and its build step never runs —
including the build the seed imports, so this checkout's `packages/infrastructure/dist` is used as
it is.
Pick free ports rather than sharing.

## Signing in

`seeded-accounts.ts` names each seeded role's saved session, `SEEDED.<role>.file`. **A spec reuses
it** — `test.use({ storageState: SEEDED.orgAdmin.file })` — unless signing in is what the spec is
about (`signs-in.spec.ts`) or it signs in as an account it just created (`journey.spec.ts`).
`POST /auth/login` allows twenty attempts a minute and the suite runs with production limits, so
every extra real sign-in brings a run closer to failing for a reason unrelated to its test.

## Running it

On a fresh checkout, `pnpm install` and a reachable local Postgres are all it needs — nothing has to
be built or running first:

```bash
pnpm test:e2e
COLLEGA_E2E_DATABASE_URL='postgresql://user:pass@127.0.0.1:5432/db?schema=collega_e2e' \
  COLLEGA_E2E_WEB_PORT=3100 COLLEGA_E2E_API_PORT=3101 pnpm test:e2e
```

`turbo.json` passes `CI`, `COLLEGA_E2E_*`, `DATABASE_URL`, `PLAYWRIGHT_BROWSERS_PATH` and
`PLAYWRIGHT_CHROMIUM_PATH` through to the suite. Any other variable it reads must be added there, or turbo's strict env mode drops it.

## Conventions

- Assert on what the user sees — roles and accessible names — not on CSS classes.
- `PLAYWRIGHT_CHROMIUM_PATH` overrides the browser when Playwright's own download is unreachable;
  `.claude/hooks/session-start.sh` sets it in Claude Code on the web. Leave it unset elsewhere, and
  never run `playwright install` in a web session.
