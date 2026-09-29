# Bug Triage

The working queue of bugs and minor tweaks to fold into an upcoming sprint. Jot items down here in whatever shape is quickest — a sentence is fine.

**This file is a queue, not a roadmap and not a history.** Two neighbours carry what it deliberately does not:

- `SPEC/ideas-inbox.md` — unrefined feature ideas. Nothing there is scheduled, and nothing there blocks work.
- `SPEC/archive/bug-triage-completed.md` — everything already fixed.

## Workflow

- Read this document before starting or resuming feature implementation.
- Items under `TODO` take priority over new features. Do not start a new feature while `TODO` has unresolved items unless the user explicitly approves an exception.
- When an item is fixed and its focused validation passes, **move it to `SPEC/archive/bug-triage-completed.md`** with the completion date and a concise verification note. Do not leave it here.
- Never let an item exist in two places. If a change is incomplete, unverified, or deferred, it stays in `TODO` with its status noted.

### Promote and delete

**When an item is promoted, it leaves this file.** Promotion means it has been written into a canonical spec (`SPEC/20-feature-*.md`, `SPEC/30-Contracts.md`) or scheduled into a sprint plan (`SPEC/sprints/`). At that point the spec or sprint file is its only home — delete the entry here rather than annotating it as "now scheduled as Sprint N".

This rule exists because the opposite happened: entries were promoted and kept, so this file accumulated ~1,100 words of Sprint 6/7 feature design duplicated from `SPEC/20-feature-ai-idea-assist.md` and `SPEC/sprints/sprint-06-view-as.md`, complete with a superseded decision left in place under strikethrough. A duplicate goes stale independently of its source, and then the two disagree.

Two corollaries:

- **Record reversals by deleting, never by striking through.** A struck-through decision leaves both readings in context.
- **Closed is not a status here.** An item marked "CLOSED" belongs in the completed archive, not in `TODO`.

### Scope

- Bugs and minor tweaks → `TODO` below.
- Feature ideas → `SPEC/ideas-inbox.md`.
- Design decisions that change behavior → the canonical spec first, per `CLAUDE.md`.

Keep entries short. A symptom, where it happens, and — if you know it — the cause. Longer analysis is welcome when the analysis *is* the value (a diagnosed root cause worth not re-deriving), but a scheduled feature's full design belongs in its sprint or spec file.

## TODO

- **`pnpm test:e2e` fails on a fresh checkout because the API isn't built yet.** Found 2026-09-29 in slice 127's QA run. `e2e/playwright.config.ts:120` starts the API with `node apps/api/dist/bootstrap.js`, but the API is only built in `global-setup.ts:82`, which Playwright runs after its `webServer` entries are up; `collega-e2e` has no workspace dependencies, so turbo's `^build` builds nothing. The comments at `playwright.config.ts:46` and `:114-115` describe the opposite order. Global setup's `DROP SCHEMA` also runs after the API is already listening. Proposed fix: build before starting the API, as the web entry already does (`pnpm exec turbo run build --filter=@collega/api && node apps/api/dist/bootstrap.js`), and correct the comments; pairs with the stale `e2e/AGENTS.md` follow-up from slice 122. Workaround: `pnpm exec turbo run build --filter=@collega/api` first.

All ten previously open items were promoted into `SPEC/sprints/sprint-07.5-accessibility-and-bug-paydown.md` on 2026-08-25 and deleted from here per the "Promote and delete" rule above — that sprint file is now their only home. They came from a live UI/UX pass against `dev` at `875b223` on 2026-08-16.
