# Collega Implementation Agent Tracker

## Purpose
Track what's true right now: current implementation status and what's next. **This file is kept short and current-only on purpose** — full narrative history (per-slice build write-ups, judgment calls, UI comp sign-off history, the original T001-T052 backlog) lives in `SPEC/archive/implementation-agent-tracker-archive.md`. Read this file for "what's true right now"; read the archive for "how did we get here" or "what did slice X actually build."

## Ground-Truth Verification — read this before trusting anything below
Before making any status, planning, or scope claim about this project — in this session or any future one — re-read the Current Status section below AND run `git log --oneline -10` fresh in that same turn. Never answer from recollection, even within the same conversation. This file was split from a 291-line narrative log on 2026-08-10 specifically because an agent answered a planning question from stale in-context memory while ~2 weeks of real parallel-agent work had landed without that memory being refreshed. A large date jump, an unfamiliar recent commit, or "it's been a while since I checked" are signals to verify more, not less. See also `CLAUDE.md`'s "Ground-Truth Verification" section.

## Pre-Feature Triage Gate
- Before starting or resuming implementation, read `SPEC/Bug Triage.md`.
- Unresolved items in its `TODO` section take priority over new feature work. Do not start a new feature until those items are cleared unless the user explicitly approves an exception.
- After a fix is complete and focused validation passes, move the item out of `TODO` into `SPEC/archive/bug-triage-completed.md` with its completion date and verification note; do not retain it in both places.
- When an item is promoted into a canonical spec or a sprint plan, **delete it from the queue** — the spec or sprint file becomes its only home. Feature ideas live in `SPEC/ideas-inbox.md` and do not gate work.

## Current Status
**Verified 2026-08-27 against `14cae01` (`dev`, pushed; `main` at `0f63b36`, 4 commits behind `dev` — Sprint 7's two feature commits plus two doc/config commits await a PR).** Keep this section a table plus short blocks — see Maintenance Rule at the end of this file.

| Area | State | Detail / authority |
|---|---|---|
| MVP epics (T001–T067) | **Merged to `dev`** | Foundation→Hardening, User-Defined Fields, Idea-Type Fields. Done — do not restart. |
| Blazor client | ~29 pages, 23 shared components in `src/Collega.Client/Components/` | Geist is the single typeface. |
| Test suite | **760 green** (2026-08-27, `14cae01`) | 131 Domain + 300 Application + 143 Infrastructure + 186 API. Infrastructure includes five `PostgresProviderTests` that **skip without Docker** — they skipped on this run, so 765 is the count with a container up. 11 `Collega.E2E.Tests` skip without a running app. Re-run before trusting. |
| Sprints | **1–7 complete** · **8 next and last** | Sprint 7 closed 2026-08-27. Sprint 8 is Azure deployment — but the bug queue below gates it: it is what puts the product in front of real users. Index: `SPEC/95-next-sprints.md`. Plans: `SPEC/sprints/`; completed in `SPEC/sprints/archive/`. |
| QA / code review | **Partially paid down** | Sprint 4 covered auth/CSV/UDF/idea-repository/client-auth. Collaboration/Comments, Events, Tenant Admin, Workflow Config, most client files and Domain entities were **never reviewed** — still open, and Sprint 6 touches authorization. Boundary: `sprints/archive/sprint-04-qa-review-debt.md`. |
| Bug queue | **`SPEC/Bug Triage.md` — 10 open items, and they gate Sprint 8** | A live browser pass on 2026-08-16 against `875b223`, each item reproduced in the running app. Mostly accessibility; three are systemic Fluent-UI patterns repeated across many files, so they are one fix each, not ten. Read the file — the diagnoses there are the value. |
| Local DB | `collega-postgres` (`postgres:16`), port **5432**, role `collega` | Standard demo seed (2 orgs, 8 users, 4 boards, 44 ideas). Dev demo Site Admin: `siteadmin@demo.collega.test` / `Abc123!`. **If the API won't connect, check user-secrets for a stale SQL Server string** — see `src/Collega.API/CLAUDE.md`. |

### Rules carried forward from Sprints 5, 6 and 6.5 — all complete
Post-mortems hold the narrative: `sprints/archive/sprint-05-postgres-migration.md`, `sprints/archive/sprint-06-view-as.md`, `sprints/archive/sprint-06.5-bug-fixes-and-tweaks.md`. Four findings outlived their sprints and constrain any change:

- **The InMemory provider sees neither collation, SQL translation, nor DDL.** Sprint 5's four defects were invisible to 561 green tests. Postgres-backed coverage is the only thing that catches that class.
- **`ICurrentUserContext` is the single server-side identity chokepoint** — nothing outside `API/Authentication/` reads claims. **Preserve that:** a service reading claims directly silently opts itself out of View As.
- **Its client twin: the `ClaimsPrincipal` must be refreshed from `/auth/me`, not read once into a local field.** Impersonation is a server-side session and the token is never reissued, so the principal is the only carrier of the effective role — and `[Authorize(Roles=…)]`, `<AuthorizeView Roles=…>` and `IsInRole()` all read it. `MainLayout.ReloadIdentityAsync` calls `RefreshUserAsync`; without it every role-gated surface renders for the real administrator mid-View-As.
- **Site Admin org-content mutation is enforced server-side** (`OrgContentMutationGuard` in Application), not by client affordances, which were route-shaped and bypassable. Product rule, user-stated 2026-08-14: *a Site Admin creates organizations and users for organizations; every other activity goes through Act As.* It supersedes `20-feature-ideas-and-engagement.md`'s upvote/comment/CSV-import rules **for the Site Admin role only** — Read Only users are members and keep both. The two CSV imports split: **user** import stays direct as bootstrap, **idea** import goes through View As.

### Sprint 7 — complete (2026-08-27); AI idea assist is live on `dev`
Built and reviewed 2026-08-16 (five review findings, all fixed); closed 2026-08-27 when the last DoD item landed. Build narrative, the live-model verification, and the review list: `sprints/archive/sprint-07-ai-idea-assist.md` and the tracker archive.

Three things from it that constrain later work:

- **The AI transcript cap is counted in user turns, not entries** — 20 user turns, ~40 entries, both bounds enforced server-side (`IdeaAssistService.ValidateTranscript`). `30-Contracts.md` had said "max 20 entries", which would have halved the feature to 10 turns; corrected 2026-08-27 to match rule 5 and the shipped code (user decision). Cost context if it is ever retuned: ~$0.0036/turn.
- **No test may reach a model provider.** `CollegaApiFactory` blanks `Ai__ApiKey` *and* swaps in `UnconfiguredIdeaDraftModel`. Not theoretical — before the guard existed the integration suite made a live billed Anthropic call, and the only symptom was one test taking five seconds instead of one. See `tests/CLAUDE.md`.
- **`Ai__ApiKey` is Optional deployment config, never Required.** Unset is a supported state (rule 31): the feature runs dark and the API must not fail startup. → `50-azure-deployment.md` §3.

### Locked decisions (current only — reversals are deleted, not struck through)
- Portrait image library = **ImageSharp** (`SixLabors.ImageSharp`, pinned **3.1.12**). Fully managed, no native assets — chosen 2026-08-13 specifically because SkiaSharp's package ships natives for Windows/macOS only and broke portrait upload on Linux App Service. **Stay on the 3.1.x line:** 4.x requires a Six Labors license key and warns on every build; 3.1.x is the Split License (free for OSS/personal and organizations under the revenue threshold — re-verify terms before any commercial release).
- Site Admin org-content mutation = **View As act-as only** (Sprint 6, full act-as + dual attribution); no direct create/edit paths, no org dropdowns. Org + user admin stay direct as the bootstrap exception. → `20-feature-client-ui.md`.
- AI idea drafting = **shipped in Sprint 7**; `Anthropic` package approved, single platform-level key, dedupe deferred to v2. Per-org AI credentials (the `ai-key` contracts in `30-Contracts.md`) stay deliberately unimplemented — rule 30. → `20-feature-ai-idea-assist.md`.
- AI assist UI = Direction **C "Draft Strip"** (`mockups/comp-c-review-11-ai-assist-c-draftstrip.html`), teal suggestion indicator, scope statement on its own Settings page, ghost-then-drop for refused turns. Comp gate passed 2026-08-16; four decisions, canonical in `20-feature-ai-idea-assist.md` → "UI Decisions".
- AI cost controls (user decisions, 2026-08-16): model **`claude-sonnet-5`** at **`low` effort**, **500,000 tokens per UTC day** as one **global** pool, degrade at the cap rather than error, usage tracked **per organization** so per-org keys (rule 30) can be metered without a backfill. The cap is a runaway stop, not a $50 guarantee — saturated daily it allows roughly $99/month, and the usage page is what makes real spend visible. → `20-feature-ai-idea-assist.md` rules 28a–28e.
- New page/flow UI is **comp-first**.
- Judgment calls resolved 2026-08-11, no code change needed: fixed-window lockout for MVP; JWT key stays ephemeral until Sprint 8; `Status` name stays capped at 100 chars (`character varying(100)` since the Postgres cutover; the call was recorded pre-Sprint-5 as `nvarchar(100)`); status defaults final. → `sprints/archive/sprint-04-qa-review-debt.md`.

### Out of sprint scope — leave intact
- The `e2e/` Playwright suite (`7a92dda`), user-owned. Deleted once in `3c367f3` by mistake and restored in `9301073`; it is live.
- **Six user-added comps (`2e9bacb`, `14cae01`), triaged 2026-08-27 into `SPEC/ideas-inbox.md`, which is their home.** G "Signal", H "Loop" and I "Memory" are **feature proposals** drawn deliberately *in* the locked Comp C language, so only the feature is under review, not the look. D "Focus Desk", E "Workspace Canvas" and F "Editorial Brief" are **alternate shells** to Comp C, which stays locked. Nothing here is scheduled and nothing here gates work; don't build against them.

The earlier AI-brainstorm WIP in `Ideas.razor`/`IdeaBrainstormModal.razor` is no longer a carve-out: Sprint 7 rewrote both against comp 11C (`78e116a`).

## Notes For Next Agent
- Read `SPEC/95-next-sprints.md` for current sprint scope, not the archive's original backlog.
- Behavior authority is the numbered canonical specs — `SPEC/README.MD` indexes them; `SPEC/30-Contracts.md` is authoritative for endpoints and payloads. **`Specs Overview.md` is a derived summary, not an entrypoint to trust** — see its own header.

## Maintenance Rule
This file answers **"what is true right now"** and nothing else. When updating it:

1. **Edit state in place; do not append history.** Change the table cell or decision line. Anything that reads "earlier the same day", "previously", or "was X, now Y" belongs in `SPEC/archive/implementation-agent-tracker-archive.md`.
2. **Delete reversed decisions — never strike them through.** A struck-through decision leaves both the old and new readings in context, and that is how agents answer wrong. Record the reversal in the archive; leave only the live decision here.
3. **Update the `Verified <date> against <commit>` line** whenever this section changes, and re-derive the state you are asserting rather than editing around it.
4. **Point, don't restate.** If detail lives in a sprint file, `Bug Triage.md`, or a canonical spec, link it in one clause instead of summarizing it here. Duplicated summaries go stale independently of their source, which produces exactly the contradictions this file exists to prevent.
5. **Budget: keep Current Status under ~450 words** (it was 427 at the 2026-08-11 compaction, down from ~1,300). It is re-read on every turn by the Ground-Truth Verification rule, so length here is paid continuously. Crossing the budget is the signal to move detail to the archive — not to raise the budget.
