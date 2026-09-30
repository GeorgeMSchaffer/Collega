# Collega Implementation Agent Tracker

## Purpose
Track what's true right now: current implementation status and what's next. **This file is kept short and current-only on purpose** — full narrative history (per-slice build write-ups, judgment calls, UI comp sign-off history, the original T001-T052 backlog) lives in `SPEC/archive/implementation-agent-tracker-archive.md` up to 2026-09-28, and that file is no longer added to; from 2026-09-28, finished rows, finished narratives and recorded reversals go to `SPEC/tracker-history.md`. Read this file for "what's true right now"; read those two for "how did we get here" or "what did slice X actually build."

## Ground-Truth Verification — read this before trusting anything below
Before making any status, planning, or scope claim about this project — in this session or any future one — re-read the Current Status section below AND run `git log --oneline -10` fresh in that same turn. Never answer from recollection, even within the same conversation. This file was split from a 291-line narrative log on 2026-08-10 specifically because an agent answered a planning question from stale in-context memory while ~2 weeks of real parallel-agent work had landed without that memory being refreshed. A large date jump, an unfamiliar recent commit, or "it's been a while since I checked" are signals to verify more, not less. See also `CLAUDE.md`'s "Ground-Truth Verification" section.

## Pre-Feature Triage Gate
- Before starting or resuming implementation, read `SPEC/Bug Triage.md`.
- Unresolved items in its `TODO` section take priority over new feature work. Do not start a new feature until those items are cleared unless the user explicitly approves an exception.
- After a fix is complete and focused validation passes, move the item out of `TODO` into `SPEC/archive/bug-triage-completed.md` with its completion date and verification note; do not retain it in both places.
- When an item is promoted into a canonical spec or a sprint plan, **delete it from the queue** — the spec or sprint file becomes its only home. Feature ideas live in `SPEC/ideas-inbox.md` and do not gate work.

## Current Status

Active and next work only. The earlier rows, the completed-sprint narratives and the 2026-09-12
Application QA pass write-up moved verbatim to [`SPEC/tracker-history.md`](tracker-history.md) on
2026-09-28; read it for how something reached its state. Rows moved that day which still carry
open work (the rows are in that file; each stays listed here until it closes):

- **Sprint 9 — the conversion:** Wave F — F1, F2, F4 and F5 open.
- **Deployment (Vercel)** and **Branch inventory:** owner-side steps still owed.
- **Authentication hardening:** tests owed.
- **Issues & Delivery:** Slice 2 (Outcomes, Roadmap) has no backend.
- **Schema drift:** awaiting someone with access to run the three rebuild commands.
- **Slice 117:** its carry-over of rule 33's shared-case comparison.
- **Sprint 12** (the prompt-eval runner, `SPEC/sprints/sprint-12-prompt-eval-runner.md`): slices
  113-115, 117 and 118 are merged; 116 (the v1 baseline) remains.

| Area | State | Detail / authority |
|---|---|---|
| Sprints | **1–7 complete** · **7.5 closed** · **9 (the conversion) is the ACTIVE sprint** | Sprint 7 closed 2026-08-18. **Sprint 8 was cancelled 2026-09-04** — the .NET stack is never deployed; everything goes to Vercel at the end of the conversion (`SPEC/decisions.md`). Sprint 7.5 is an accessibility/bug paydown — `sprints/sprint-07.5-accessibility-and-bug-paydown.md`. Index: `SPEC/95-next-sprints.md`. Plans: `SPEC/sprints/`; completed in `SPEC/sprints/archive/`. |
| **Slice 119 — SPEC restructure for context efficiency, Phase 1** | **Phase 1 merged into `dev` 2026-09-28, reviewer approved after one round of fixes.** Documentation only. Phase 2 is slice 120. | `SPEC/sprints/spec-context-restructure.md` Phase 1: `decisions.md` becomes an index, the newest 15 entries and `SPEC/decisions/archive-*.md`; this file keeps active and next work, with finished rows and the completed-sprint narratives moved verbatim to `SPEC/tracker-history.md`; `30-Contracts.md` keeps the conventions and an index, with each contract section in `SPEC/contracts/`; the two "Idea Field Option Contracts" sections are merged, conflicts marked for the user to decide; "At a glance" blocks on `05`, `20-*` and `50-*`; the reading order in `AGENTS.md`. Moved text is byte-identical. |
| **Slice 120 — SPEC restructure, Phase 2 (condensing)** | **Merged into `dev` 2026-09-29, reviewer approved.** on `feature/120-spec-context-restructure-phase-2`. Documentation only. | `SPEC/sprints/spec-context-restructure.md` steps 7–11, one commit per file, each checked by a fact inventory and a separate reviewer. Done: every `SPEC/contracts/*.md` file in the Route / Roles / Request / Response / Errors / Rules template; the Idea Field Option contract resolved to the code (`SPEC/decisions.md` 2026-09-28); `05`, every `20-*` spec but `oauth` and `saml` (already terse) and every `50-*` spec condensed; `SPEC/tracker-history.md` split into dated files of at most 40,000 bytes under `SPEC/tracker-history/`, with a rotation rule; this Current Status; `SPEC/Specs Overview.md` and the SPECKIT auth spec pointed at the contract files. `decisions.md` gained one entry; its index lines were already one line each and are unchanged. |
| **Slice 121 — Resolve the spec contradictions** | **Merged into `dev` 2026-09-29, reviewer approved after one round of fixes.** on `feature/121-resolve-spec-contradictions`. Spec only, no application code. | The user's thirteen answers to Phase 2's contradictions (`SPEC/decisions.md` 2026-09-29, "Spec contradictions resolved") applied, one commit per file, checked by before/after fact inventories; plus the staleness Phase 2 reported — broken above/below pointers from the contract split, stale status lines, and paths into the deleted .NET tree. **Follow-ups — done in slice 124:** contracts for the six `/field-definitions` routes, `PUT`/`DELETE /auth/me/portrait`, the `GET /users/{userId}` success shape, the statuses item's `color`/`sortOrder`, and the organizations `sortBy` (`users/import-template` has no code, so no contract); the idea form's Business Impact preselection; the `session-cookie.ts` comments; the C# blocks in `20-feature-idea-type-fields.md`; the SPECKIT auth copy's bearer-token lines; and the password-change wording in `40-test-strategy.md` and `05` (the API *does* regenerate the security stamp — this row said it didn't). **Follow-up, still open (features):** the browser idle deadline (auth requirements 38–42) is unbuilt; `POST /boards/{boardId}/swimlanes/reorder` has no web caller. Also: the deferred per-org key rule was read as hiding three `aiKey*` metadata fields from User/Read Only with `aiKeyConfigured` visible — confirm when per-org keys are specified. |
| **Slice 125 — Vercel CLI for pulling environment values** | **Merged into `dev` 2026-09-29, reviewer approved; review fixes applied before merge.** | `vercel` 60.1.3 as a root devDependency (61.0.0 was inside pnpm's release-age hold; no exemptions added). `pnpm env:pull` writes the API project's Development variables to the gitignored root `.env.local` (asks before replacing a file the CLI didn't create). `.vercel` ignored. The prompt-eval runner reads `PROMPT_EVAL_ANTHROPIC_API_KEY` from the environment, then `.env.local`, then `.env` (spec rule 36). The owner links with `pnpm exec vercel login` and `pnpm exec vercel link --repo`. **For QA:** a `credentials.test.ts` case for the list form. |
| **Slice 122 — The test harnesses reuse sessions** | **Merged into `dev` 2026-09-29, reviewer approved.** on `feature/122-harness-sessions`. | Clears the two Bug Triage items where the auth rate limiter broke the harnesses (`SPEC/decisions.md` 2026-09-29, "The test harnesses reuse sessions; the auth rate limits stay"). Production limits unchanged. The golden replay holds one session per role across scenarios and re-signs only after a View As scenario (about sixty logins a run to twelve); the Playwright suite's last seeded sign-in outside `auth.setup.ts` moved to the stored session (fifteen to fourteen). Verified with limits intact: the E2E suite passes 38/38 and the replay runs to completion (360/447 match, 52 accepted, 35 unexplained, 69 stale — byte-identical to the old per-scenario re-sign, paced under the limits). **Not touched:** the unexplained differences and the stale accepted entries — the replay is a regression detector, not a gate. **Follow-ups:** prune the 69 stale entries in `tools/golden/src/accepted.ts`, and triage the 35 unexplained differences as fix, accept and record, or deliberately do better (`SPEC/decisions.md` 2026-09-11). **Follow-up — done in slice 128:** the stale `e2e/AGENTS.md` rewritten for both servers, with the convention that a spec reuses `SEEDED.*.file` through `storageState` unless signing in is what it tests. |
| **Slice 123 — Removing a lane moves its ideas** | **Merged into `dev` 2026-09-29, reviewer approved after one round of fixes.** on `feature/123-move-ideas-off-removed-lane`. Clears the Bug Triage item "A board can drop a lane that still holds ideas". | `SPEC/decisions.md` 2026-09-29 "Removing a lane moves its ideas"; Board rule 14; `contracts/boards.md` `PUT /boards/{boardId}` gains `ideaMoves`. Rules in `BoardService.update` (`planIdeaMoves`), the move staged in the board save's unit of work, `IdeaStatusChanged` per moved idea; the board form's confirm step (`IdeaMovesGuard`) on the list kit's `ConfirmDialog`, which now takes children. No tests written (QA pass follows). Not done: the SPECKIT derived copies. **Known edge:** an idea moved *into* a lane this save removes, between the save counting the lane and committing, is not moved and ends up in no column (the move only takes ideas it counted, and only if still in the lane). |
| **Slice 124 — Close the spec-vs-code gaps from slice 121** | **Merged into `dev` 2026-09-29, reviewer approved.** on `feature/124-spec-code-gaps`. | Slice 121's small follow-ups, each written from the code (`SPEC/decisions.md` 2026-09-29 "Contracts and wording written from the code"): the idea form preselects the first active Business Impact and, by user decision 2026-09-29, the first active Idea Type on create; new `contracts/field-definitions.md`, the portrait routes in `contracts/auth.md`, `GET /users/{userId}` in full, the statuses item's `color`/`sortOrder`, the organizations `sortBy`; a required password change is described as ending the session (four specs); the stale `session-cookie.ts` comments; the C# blocks in `20-feature-idea-type-fields.md`; the SPECKIT auth copy. |
| **Slice 127 — QA for slices 122–126** | **Merged into `dev` 2026-09-29, reviewer approved.** on `feature/127-qa-harness-lanes-contracts`. | 74 new tests; each rule checked by breaking it — 67 mutations, all caught. **123 (application, 22):** `BoardService.update` refusals keyed `ideaMoves` with the contract's exact messages (singular and plural, one per stranded lane, invalid target incl. the removed lane itself, source not removed or never a lane, duplicate source, every problem in one refusal deduplicated, a malformed move on a save that removes nothing), archived board `409` before the moves are read, a lane added in the same save as target, an empty removed lane (with or without an entry) moving nothing, the move staged between the board save and the one commit, one `IdeaStatusChanged` per idea in `changeStatus`'s shape, `BoardUpdated` metadata `ideaMoves`, View As attribution, nothing audited on refusal. **123 (infrastructure, 5, live Postgres, skipped without `DATABASE_URL`):** `listLaneIdeas` returns only that board's live Discovery ideas; a service save moves them and leaves soft-deleted ideas, Issues and another board's ideas; `moveIdeas`'s `status_id` filter leaves an idea moved out meanwhile; lanes and moves roll back together; a refused save changes nothing. **123 (API, 7):** `toIdeaMoves` — entries passed through, non-arrays as none, missing/non-string ids as `''`, a refusal rendered as `400` keyed `ideaMoves`. **123 (web, 12):** `IdeaMovesGuard` asks only when a removed lane holds ideas, one picker per lane with its count defaulting to the first remaining lane, posts `moveFrom`/`moveTo` pairs, Cancel sends nothing, a double click submits once, asks again after a confirmed save; `ConfirmDialog` Tab/Shift+Tab cycle includes its children and is unchanged without them. **124 (web, 5):** the idea form preselects the first Idea Type and Business Impact on create and shows the type's fields at once, sends them untouched, keeps an edit's own values, leaves both unchosen for empty catalogs. **125 (prompt-eval, 7):** `.env.local` before `.env`, blank or absent falls through, missing first file falls through, environment wins, `ANTHROPIC_API_KEY` never read. **126 (10):** `readEnvFile`'s parsing and the opt-in moved unchanged into `tools/local/env-file.ts` (`parseEnvText`, `allowsRemoteDatabase`) because `start.ts` runs on import; `tools/local` joins the workspace so `pnpm check` runs them. **122 (golden, 6):** one sign-in per role across scenarios, re-sign after a View As scenario, a scenario's own accounts re-signed every scenario, `todo` View As steps ignored, `resetSessions` scopes, and the committed corpus within one sign-in per role per View As boundary. **Playwright:** 38/38 on a scratch database with production limits, 14 successful sign-ins (1 deliberate failure). **Defects:** none in the slices' code. **Reported, not fixed:** on a clean checkout the E2E run fails with `apps/api/dist/bootstrap.js` missing — Playwright starts `webServer` before `global-setup.ts` builds it, contrary to the config's comment; build the API first. The three live-database migration tests need a role with `CREATEDB`. **Not covered:** `cli.ts`'s one-line reset policy (the test repeats it; `cli.ts` runs on import); the prompt-eval default file order (`DEFAULT_DEPS` is not exported); the move sending no notification (`BoardService` has no notifier to assert against); slice 123's known edge of an idea moved *into* a removed lane mid-save; a golden spot-check of the new contracts — `contracts/field-definitions.md` was written against the frozen fixtures, so a test would pin one frozen record to another. |
| **Slice 128 — The E2E suite builds the API before starting it** | **Merged into `dev` 2026-09-29, reviewer approved.** on `feature/128-e2e-build-order`. Clears the Bug Triage item "`pnpm test:e2e` fails on a fresh checkout because the API isn't built yet". | The API `webServer` entry builds through turbo before `node apps/api/dist/bootstrap.js` (timeout 240 s for a cold build); `global-setup.ts` no longer builds, since it runs after the servers are up. The schema reset stays after the API is listening — safe because the API opens no connection before its first query (0 connections after boot and health, 1 after the first login) — and the config, `global-setup.ts` and `README.md` now describe that order. `turbo.json` passes `COLLEGA_E2E_*` and `DATABASE_URL` through, which strict env mode had been dropping, so the port and database overrides now reach `pnpm test:e2e`. `e2e/AGENTS.md` rewritten (slice 122's follow-up). Verified on a fresh worktree, scratch database, ports 3100/3101, production limits: 38/38 cold with no `dist/` and turbo's cache bypassed (117 s), 38/38 warm (100 s). **Still stale, not touched:** `e2e/README.md`'s section "The prerequisite: `apps/api` as a second `webServer`" describes wiring that F2 finished. Optional hardening from review: move `refuseIfNotDisposable`'s schema and local-host checks into `e2eDatabaseUrl()` so the config refuses before any server starts. |
| **Slice 129 — Browser idle sign-out** | **Awaiting review.** on `feature/129-idle-sign-out`. Tests owed (QA). | `SPEC/20-feature-auth.md` requirements 38–42, previously unbuilt (slice 121's follow-up). `IdleSignOut`, mounted by the desk layout: thirty minutes without pointer, key, touch, wheel/scroll or visibility activity sends the tab to `/login?expired=1`; from minute 28 a `role="alertdialog"` shows a live countdown with **Stay signed in** (resets the browser idle clock only, never the JWT) and **Sign out** (explicit, so no notice). The token's absolute expiry, read from the cookie's `exp` by `sessionRemainingMs`, also lands on the expired notice. Activity and session end synchronize across tabs through `lib/session-signal.ts` (`BroadcastChannel`, `localStorage` fallback); the login page's `SessionEndedSignal` tells the other tabs, with the notice it arrived with. The expired notice now reads "Your session expired. Sign in again to continue." Development-only `COLLEGA_DEV_IDLE_TIMEOUT_SECONDS`/`COLLEGA_DEV_IDLE_WARNING_SECONDS` shorten the timings for manual checks. **Open:** `contracts/auth.md` still says the idle deadline is not built in `apps/web`; contracts are read-only for slices, so that line awaits an owner edit. |

### Locked decisions (current only — reversals are deleted, not struck through)
- Outcome ↔ Issue cardinality = **single-parent**: an Issue sits under at most one Outcome (`Idea.OutcomeId`, nullable FK, `ON DELETE SET NULL`); no join table. Decided 2026-09-02 → `SPEC/decisions.md`.
- Site Admin org-content mutation = **View As act-as only** (Sprint 6, full act-as + dual attribution); no direct create/edit paths, no org dropdowns. Org + user admin stay direct as the bootstrap exception. → `20-feature-client-ui.md`.
- AI idea drafting: single platform-level key (per-org keys stay unbuilt), dedupe deferred to v2, `Anthropic` package approved. The system prompt is a Site-Admin-managed versioned setting. → `20-feature-ai-idea-assist.md`.
- AI assist UI = Direction **C "Draft Strip"** (`mockups/comp-c-review-11-ai-assist-c-draftstrip.html`), teal suggestion indicator, scope statement on its own Settings page, ghost-then-drop for refused turns. Canonical in `20-feature-ai-idea-assist.md` → "UI Decisions". The read-only strip is load-bearing: making it editable brings back a per-field suggested-vs-edited state machine v1 deliberately does not have.
- AI cost controls (user decisions, 2026-08-16): model **`claude-sonnet-5`** at **`low` effort**, **500,000 tokens per UTC day** as one **global** pool, degrade at the cap rather than error, usage tracked **per organization** so per-org keys (rule 30) can be metered without a backfill. The cap is a runaway stop, not a $50 guarantee — saturated daily it allows roughly $99/month, and the usage page is what makes real spend visible. → `20-feature-ai-idea-assist.md` rules 28a–28e.
- New page/flow UI is **comp-first**.
- **List endpoints need a total order.** The golden capture found four places where one was missing or was only total by generated id, which is stable inside a deployment but not between two seeded from the same data. Under paging an arbitrary tie-break does not merely reorder a page, it decides what is on it.
  - Tie-break on something stable and meaningful — email, not id, where the two differ.
  - **And assert the concrete order**: the InMemory provider makes "no duplicates across pages" pass with the tie-break removed, which is how one such test sat green and worthless (`tests/CLAUDE.md`).
- TypeScript conversion, decided 2026-09-03 → `SPEC/decisions.md`:
  - the .NET test suite is **discarded** (golden contract corpus plus per-slice Vitest, written by a QA agent);
  - deployment is **Vercel + Prisma Postgres**, so Nest runs serverless and keeps no in-process state;
  - net-new scope is **Wave G** — Loop, decision records, commitment strip, Triage Mode — with momentum, duplicate clustering and vote budget out. Wave G is revisited after cutover (2026-09-08), and F1 is not a gate (2026-09-11).
- Judgment calls resolved 2026-08-11, no code change needed: fixed-window lockout for MVP; `Status` name stays `nvarchar(100)`; status defaults final. → `sprints/archive/sprint-04-qa-review-debt.md`.

### Agreed order of work (2026-09-12, decided with the user)
Settled in one sitting, so a later reader meets the whole set rather than one row of it. Items are
sequenced, not merely listed.

1. **`apps/web/lib/data/delivery.ts` onto the API.** The last data module still entirely on
   `../mock`; every other reader in `lib/data/` is at least partly converted. The five delivery
   screens already exist from Wave E and the eighteen endpoints are live and seeded, so this is the
   seam working as designed — replace reader bodies, not signatures.
   - **Open question handed over with it: Outcomes have no backend at all** (no table, no entity,
     no endpoint; fixture and spec only, and the roadmap screen is built on them). Leave the three
     outcome readers on the fixture, or amend the schema again under ticket `06` — decide, do not
     invent.
2. **QA pass over `packages/application`,** in its own worktree, by an agent that did not write the
   code. 13,006 lines, six test files, and it carries authorization. Scheduled 2026-09-08 and never
   started; it is the only layer of consequence with no such pass. The D1 round is the pattern —
   26 → 87 tests, two divergences found that implementer and reviewer both missed.
3. **D6 and D7 together as one slice** — AI assist and View As, the last fifteen of the eighty-one.
   Taken together rather than View-As-first so Wave D closes in one pass.
4. **F6 deletes the .NET stack, after D6/D7** — not before. **Done 2026-09-13.** Gate: 23/23, `0 cached`.
   - 481 files: `src/Collega.*`, `tests/`, `Collega.sln`, `global.json`, `.config/dotnet-tools.json`,
     `DOTNET.md`, `tools/Collega.AiPlayground`, `deploy/azure`, `docker/proxy-ca`,
     `.claude/launch.json`, and the compose `api` and `web` services.
   - `README.md` was rewritten around installation, running locally, seeding and deployment — the
     deployment section did not exist before.
   - `SPEC/decisions.md` 2026-09-13 records the sweep rule (remove stale pointers, keep inherited
     rationale) and the two things that needed work rather than deletion: **`tools/golden` parsed
     the controllers**, which would have broken `replay` and `coverage`, not just `inventory` — the
     endpoint list is now a committed snapshot verified against the fixture manifest; and **the
     AI-assist evaluation corpus moved to `tools/prompt-eval`** because its .NET runner did not
     survive, which is a **capability lost, not relocated** (see "Known open risks").

5. **Rescope and spec the AI integration — after this batch, decided 2026-09-13.** Sequencing, not
   cancellation. **No further AI feature work starts on the current spec.** The full entry,
   including what it does not mean, is `SPEC/decisions.md` 2026-09-13. Why:
   - `SPEC/20-feature-ai-idea-assist.md` is live behind eleven endpoints and does one job: draft one
     new idea, in a chat, from a standing start.
   - Ingestion and refinement have no spec, similar-idea retrieval and org documents are deferred to
     v2 on `pgvector` the schema does not have.
   - The admin surface is the last fixture-backed screen in the product, and prompt changes became
     unmeasurable when F6 deleted the evaluation runner.

Deferred with reasons recorded in `SPEC/decisions.md` 2026-09-12: the rate limiter's collision with
the golden replay. Amended there the same day: the account lockout, which no longer needs the shared
store to stop being a denial-of-service.

**Owner-side and not blocked on code:**
- The `collega` web project still carries the settings §11 describes (no Root Directory, Output
  Directory pinned to `public`, framework unset) and cannot be fixed through the API —
  `create_git_project` reuses a linked project rather than recreating it, and applies
  `rootDirectory` only at creation.
- Its production branch is `main`, which was fast-forwarded to `dev` on 2026-09-12 so at least the
  code is current.
- Preview's `DATABASE_URL` points at the database holding the real Site Admin, confirmed from a
  build log rather than inferred.

### Known open risks (recorded, deliberately unscheduled — do not read as "handled")

- **Corpus-scale prompt evaluation has no tool** (since 2026-09-13, slice F6). `tools/Collega.AiPlayground` scored the AI-assist system prompt across nine cases with repeats, a spend ceiling and a cache guard; it was a .NET console application and was deleted with the stack. The corpus survived as `tools/prompt-eval/` and the interactive `tools/prompt-lab.html` still works, but nothing can now answer "is this prompt better than that one, across the corpus?" That matters because the scope gate it measured is a security control (`SPEC/20-feature-ai-idea-assist.md` rules 7-10, 25) and requirement 37c measured that a handful of interactive probes proves almost nothing. **Treat any prompt edit as unmeasured until a replacement runner exists.**
- **Account-lockout denial of service.** Five failed sign-ins lock an account for 15 minutes, and five is below any per-IP rate limit that lets real people sign in — so five anonymous requests deny sign-in to any user whose email is known, repeatably. Fixing it needs a per-IP failure counter, which needs state outliving a request: either a schema change (frozen at S0.2) or a shared store. **Schedule it with the Redis/Vercel KV work the rate limiter already needs** to be a real ceiling rather than a per-warm-instance speed bump — one dependency, two problems. Not fixed now; no production users yet, and the first real tenant is what changes that.
- **Registration is a cross-tenant account-enumeration oracle.** A valid invite code plus `201`-vs-`409` tells an anonymous caller whether any address has an account, in any organization, because `users.normalized_email` is globally unique. Hiding the status was tried on 2026-09-10 and reverted — it changed nothing, because the fork is the oracle. The real fix is asynchronous verify-by-email registration. The per-IP rate limit is the only bound today.

The last two — both on the anonymous auth surface, both confirmed against running code, and both in `SPEC/decisions.md` 2026-09-11 with the reasoning — are named here so a planning pass meets them.

### Out of sprint scope — leave intact
User-owned, landed on `dev`: the `e2e/` Playwright suite (`7a92dda`). The AI-brainstorm WIP that used to sit here shipped in Sprint 7 and is no longer out of scope.

## Notes For Next Agent
- Read `SPEC/95-next-sprints.md` for current sprint scope, not the archive's original backlog.
- Behavior authority is the numbered canonical specs — `SPEC/README.MD` indexes them; `SPEC/30-Contracts.md` is authoritative for endpoints and payloads. **`Specs Overview.md` is a derived summary, not an entrypoint to trust** — see its own header.
- **On the macOS machine only, this repo sits in iCloud-synced `~/Documents` and file contents get evicted.** It does not apply to the Windows checkout at `C:\code\Collega`, where none of the following has been observed — check which machine you are on before acting on it. A `dataless` file (check `stat -f '%Sf'`) reads as empty or times out, and shows as ` M` in `git status` without anyone having edited it. Currently ~21 files under `SPEC/`, 44 under `tests/`, 175 of 188 under `e2e/`; `src/` is clean. To restore one, `rm` the placeholder then `git show <ref>:<path> >` it — unlinking is instant, overwriting in place hangs for minutes. Avoid commands that walk the whole object store (`git fetch`, `git push`, `git worktree add`); they time out. A fast-forward you are not standing on is safest as `git update-ref` after `git merge-base --is-ancestor`.

## Maintenance Rule
This file answers **"what is true right now"** and nothing else. When updating it:

0. **Verify wave status by merge commit, never by memory or by this file's previous state.** This row
   has now gone stale twice, and the second time it under-reported by four Wave B partitions and all of
   Wave C — six merged slices that a reader would have rebuilt. Under-reporting is the dangerous
   direction. The check takes one command and settles it:

   ```bash
   git log --date=short --format='%h %ad %s' origin/dev | grep -iE 'Merge Wave'
   ```

   Cross-check against the tree rather than trusting the message — a merge commit says a branch landed,
   not that it did anything. `ls packages/application/src` and `ls packages/domain/src` show which
   feature areas exist; `find apps/api/src -name '*.controller.ts'` shows how much of Wave D is real;
   `apps/api/src/app.modules.generated.ts` lists every feature module the host has actually registered.


1. **Edit state in place; do not append history.** Change the table cell or decision line. Anything that reads "earlier the same day", "previously", or "was X, now Y" belongs in `SPEC/tracker-history.md`.
2. **Delete reversed decisions — never strike them through.** A struck-through decision leaves both the old and new readings in context, and that is how agents answer wrong. Record the reversal in `SPEC/tracker-history.md`; leave only the live decision here.
3. **Update the `Verified <date> against <commit>` line** whenever this section changes, and re-derive the state you are asserting rather than editing around it.
4. **Point, don't restate.** If detail lives in a sprint file, `Bug Triage.md`, or a canonical spec, link it in one clause instead of summarizing it here. Duplicated summaries go stale independently of their source, which produces exactly the contradictions this file exists to prevent.
5. **Budget: keep Current Status under ~450 words** (it was 427 at the 2026-08-11 compaction, down from ~1,300). It is re-read on every turn by the Ground-Truth Verification rule, so length here is paid continuously. Crossing the budget is the signal to move detail to `SPEC/tracker-history.md` — not to raise the budget.
6. **Finished items move to `SPEC/tracker-history.md`, verbatim.** When a row's work is merged and
   nothing on it is still open, move the row to the end of the table in the newest rows file under
   `SPEC/tracker-history/`; a finished narrative section moves under the "Narratives" heading of the
   newest narratives file. Each file stays at or under 40,000 bytes; that file's rotation rule says
   when to start the next. Only active and next work stays here. Rows moved on 2026-09-28 that still
   carry open work stay listed in the Current Status intro until they close.
