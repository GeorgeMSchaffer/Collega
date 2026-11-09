# Browser E2E

Read `README.md` for the startup recipe, recording, traces and diagnostics. Read the header comment
in `playwright.config.ts` before changing startup or server behavior.

- Each run drops, recreates, migrates and seeds the dedicated `collega_e2e` schema. The URL guard
  rejects non-local hosts or any other schema before servers start, and setup checks again before
  dropping. Preserve both safety checks.
- Specs share one seeded database and run serially; a spec's writes are visible to later specs.
  Start a fresh run when a test needs a clean state.
- `COLLEGA_E2E_WEB_PORT` and `COLLEGA_E2E_API_PORT` select ports. Outside CI, an existing server
  may be reused, which skips this checkout's build and can drive a stale server or infrastructure
  output. Choose free ports; if requests hang, check the existing server before changing config.
- Reuse `SEEDED.<role>.file` storage state except in tests about sign-in or accounts created by the
  test. The login limit is twenty attempts per minute; unnecessary sign-ins consume the suite's
  budget.
- Turbo strict environment mode passes only declared variables. Add any new E2E variable read by
  the suite to `turbo.json`.
- `PLAYWRIGHT_CHROMIUM_PATH` is for the hosted Claude web session only. Leave it unset elsewhere
  and never run `playwright install` in a web session.
- Assert user-visible behavior with roles and accessible names, not CSS classes.
