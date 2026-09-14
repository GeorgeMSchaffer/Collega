# Collega browser E2E (Playwright)

Browser tests that drive `apps/web` in a headless Chromium. Playwright starts the app itself, so:

```bash
pnpm test:e2e
```

is the whole thing — nothing needs to be running first.

## What is here, and what is not

The harness, and a two-assertion check that the harness works. **There are no product flows yet.**

This suite used to drive the Blazor client at `:5098` against the .NET API at `:5103`. That stack is
frozen (`SPEC/decisions.md` 2026-09-06) and its seven specs went with it — they were written against
FluentUI's shadow roots and a `CollegaE2E` database seeded on API boot, and neither exists in the
TypeScript stack. Rewriting them for the Next client is slice **F2**, and QA writes them, per
`CLAUDE.md`. Nothing in `SPEC/` holds their flow list, so it is kept at the bottom of this file —
F2 starts from a list of what was covered rather than from the deleted specs.

What replaced them, `tests/harness.spec.ts`, asserts only that a route renders server-side and that
the route gate redirects an anonymous visitor to `/login`. If it ever needs a fixture or a login, it
has stopped being a harness check and belongs in a spec of its own.

## What the tests can and cannot see

**The suite drives the whole application.** `playwright.config.ts` starts `apps/api` on :3001 and
`apps/web` on :3000, and `global-setup.ts` drops and rebuilds a schema of its own before either
starts — so a run begins from the seeded demo data rather than from whatever the last run left.
Nothing needs to be running beforehand.

**The database is a schema, not a second database.** `collega_e2e` inside whatever `DATABASE_URL`
names, so `public` — where `pnpm dev` keeps your demo data — is untouched, and no CREATE DATABASE
privilege is needed. `COLLEGA_E2E_DATABASE_URL` overrides it for CI. The setup **refuses** any URL
that is not a local `collega_e2e`: it drops the schema it is given, and that is not a mistake worth
making once.

Until F2 this said the opposite, and the paragraph below is what it said. It is kept because it
explains why the suite had one spec:

> `playwright.config.ts` starts `apps/web` and nothing else. That used to cost nothing, because
> every screen answered from `apps/web/lib/mock.ts`. It is now the single thing blocking product
> coverage.

These four screens are wired to the real API and `fetch` `apps/api` on render — **they now work
here**, and before F2 they failed at render however carefully a spec was written:

| Screen | Route |
|---|---|
| Boards list | `/boards` |
| Board detail | `/boards/[boardId]` |
| Ideas list | `/ideas` |
| Idea detail, inspector included | `/ideas/[ideaId]` |

They render because the API is here. Note what that means for a failure: if one of these screens
fails to render at all, suspect the API server rather than the assertion — its output is on stderr,
and `global-setup.ts`'s migrate and seed run before either server starts, so a database problem
surfaces there rather than in a test.

`apps/web/lib/data/index.ts` is the seam and names exactly which readers have been converted; check
it before assuming a screen is fixture-backed. **The AI-assist admin screens are the exception that
remains** — `getAiAssist`, `getAiPrompt`, `getUsage` and `getUsageForOrganization` in
`lib/data/admin.ts` still answer from `lib/mock.ts`, so nothing they show persists and a flow that
writes through them cannot pass. The outcome readers answer empty by design (Slice 2 has no
backend), which is not the same thing and is not a gap to cover.

`tests/signs-in.spec.ts` is the spec that proves all of the above is actually wired: it could not
have passed before F2, because signing in needs the API, the database and the seed at once. If the
second `webServer` entry ever stops working, that is the test that should say so.

## The prerequisite: `apps/api` as a second `webServer`

Covering the four screens above needs `apps/api` added as a second `webServer` entry in
`playwright.config.ts`, listening on `:3001` (`apps/web/lib/api/config.ts` defaults
`COLLEGA_API_URL` to `http://127.0.0.1:3001/api/v1`), pointed at a database dropped and seeded per
run. Two things are worth knowing before starting:

- **`apps/api` has no `dev` or `start` script.** It builds and typechecks; nothing launches it. That
  script is part of this work, not a given.
- **Sign-in has to go through the app.** The session is an httpOnly cookie the API issues, and only
  the Next server talks to the API — the browser never does. So a spec cannot inject a token; it
  signs in through `/login` like a reader, or reuses a Playwright storage state captured that way.

**The database half is ready.** Five seed modules under
`packages/infrastructure/prisma/seed/modules/` build the demo dataset — 2 organizations, 10 users,
4 boards, 44 ideas, with accounts that sign in — and a throwaway database is three commands and
under four seconds:

```bash
dropdb CollegaE2E && createdb CollegaE2E
DATABASE_URL=…/CollegaE2E pnpm --filter @collega/infrastructure db:migrate
DATABASE_URL=…/CollegaE2E pnpm --filter @collega/infrastructure db:seed
```

Re-running the seed against an existing database is inert by design, so a spec that needs a clean
slate must drop and recreate rather than re-seed.

So the remaining gate is the wiring itself, not the pieces: `apps/api` exists and the four screens
above already call it, but this suite never starts it. Until it does, the honest coverage here is
the harness check and nothing more.

## Claude Code on the web

`.claude/hooks/session-start.sh` prepares a cloud session: Node 24, `pnpm install`, a native
PostgreSQL 16 cluster, `prisma migrate deploy`, and `PLAYWRIGHT_CHROMIUM_PATH`.

That last one matters here. The container ships a Chromium but blocks `cdn.playwright.dev`, so
`playwright install` cannot run, and the build it ships is not the build this Playwright pins.
`playwright.config.ts` reads `PLAYWRIGHT_CHROMIUM_PATH` and launches the browser that is present;
unset — the normal case on a development machine — Playwright uses its own download, as usual.

`turbo.json` passes that variable and `PLAYWRIGHT_BROWSERS_PATH` through explicitly. Turbo 2 runs
strict env mode by default, so an undeclared variable never reaches the test process; the ffmpeg
Playwright wants for failure video is found through the second one.

## Running it

```bash
pnpm test:e2e                        # from the repository root
pnpm --filter collega-e2e test       # the same thing
cd e2e && pnpm exec playwright test --headed   # watch it drive the browser
```

Failures keep a trace, a screenshot and a video under `e2e/test-results/`:

```bash
cd e2e && pnpm exec playwright show-trace test-results/<test>/trace.zip
```

**One gotcha, and it will cost you twenty minutes if you hit it blind.** `reuseExistingServer` is on
outside CI, so a dev server you left running is the one the tests drive. A Next dev server whose
parent was killed can keep the port without answering on it, and Playwright's start-up check passes
against a server that then never responds — presenting as `page.goto` timeouts, not as a server
error. If runs hang, check the port before you touch the config:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' http://localhost:3000/login   # 000 with something on :3000 means wedged
pgrep -f next-server | xargs -r kill -9
```

## Flows the retired suite covered

Kept for F2. These ran green against the Blazor stack; they are a starting list, not a
specification — where one disagrees with `SPEC/`, the spec wins.

| # | Flow |
|---|---|
| 1 | Site Admin first-login forced password change |
| 2–3 | Org Admin creates two users, then deactivates them (there is no hard delete — "delete" is deactivate) |
| 4–5 | Org Admin adds a status, then deletes it |
| 6–8 | Org Admin creates a board · User adds a card · User moves it through every status |
| 9 | Idea drawer opens from the Ideas list and is URL-addressable |
| 10–13 | Upvote · comment with an @mention · edit adding a tag and an assignee · status move from the drawer |
| 14–16 | Scope chips, server-side search and clear · sortable column headers · page-size options |
| 17–18 | Org Admin deletes an idea from the drawer danger zone · the deep link stops loading |

Three things the old suite learned the hard way, all still true of the product:

- **Flow 1 is one-shot per database.** It consumes the Site Admin's forced password change, so
  re-running the suite needs a fresh database rather than a re-run.
- **Status moves were driven through the drawer, not by dragging the Kanban.** Native HTML5 drag was
  unreliable to automate; the drawer control exercises the same server call.
- **A plain User can set an assignee** on an idea they authored — the picker reads
  `GET /organizations/{id}/members`, which any in-org caller may read, not the Org-Admin+ user list.

## Watching a run

```bash
pnpm --filter collega-e2e test:record            # the whole suite
pnpm --filter collega-e2e test:record journey    # one file
```

Writes `e2e/recordings/` as `NN - <spec> › <describe> › <title>.webm`, **numbered in the order the
tests ran** rather than by filename. That ordering is the point for `journey.spec.ts`, which is a
chain — sorting its clips any other way puts step 7 before step 1. A test that did not pass carries
its status in the name.

`record.mjs` reads Playwright's JSON reporter rather than the `test-results/` directory names, which
carry a hash in the middle and give every file the same name. Video is off by default; an ordinary
`pnpm test:e2e` still keeps it only for failures.

**Known: a full run is not repeatable within the hour.** It signs in 27 times against an hourly
per-IP limit of 100, so roughly the fourth consecutive run starts failing on the login screen for a
reason that has nothing to do with the product. Recorded in `SPEC/Bug Triage.md`. Until it is fixed,
a spec that fails in a full run is worth re-running on its own before believing it.
