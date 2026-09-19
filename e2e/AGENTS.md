# e2e

The Playwright suite. Separate from `pnpm check` because it needs a running app:
`pnpm test:e2e`.

Playwright starts `apps/web` itself, so nothing needs to be running first — but it starts **only**
`apps/web`. Read the header comment in `playwright.config.ts` before writing a spec: the screens
that now `fetch` `apps/api` (`/boards`, `/boards/[boardId]`, `/ideas`, `/ideas/[ideaId]`) fail at
render with no API up, however the spec is written. Delivery and the settings surfaces are still
fixture-backed and work today.

Adding `apps/api` as a second `webServer`, against a dropped-and-seeded throwaway database, is the
prerequisite for covering the rest — it is not done, and it gates every product spec. See
`README.md`, "What the tests can and cannot see".

What is here today is the harness; **F2 owns the flows that go back on top of it**. The seven specs
that drove the frozen Blazor client were retired with it.

## Conventions

- One worker, no retries, no parallelism — the suite shares one database.
- `PLAYWRIGHT_CHROMIUM_PATH` overrides the browser when Playwright's own download is unreachable;
  `.claude/hooks/session-start.sh` sets it in Claude Code on the web. Leave it unset elsewhere.
- Never run `playwright install` in a web session — a Chromium is already provided.
- Assert on what the user sees, via roles and accessible names, not on CSS classes.
