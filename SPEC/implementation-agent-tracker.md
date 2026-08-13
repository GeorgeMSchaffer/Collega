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
**Verified 2026-08-13 against `00bd6fb` (`dev`).** Keep this section a table plus short blocks — see Maintenance Rule at the end of this file.

| Area | State | Detail / authority |
|---|---|---|
| MVP epics (T001–T067) | **Merged to `dev`** | Foundation→Hardening, User-Defined Fields, Idea-Type Fields. Done — do not restart. |
| Blazor client | ~16 pages, 9 shared components in `src/Collega.Client/Components/` | Geist is the single typeface. |
| Test suite | **580 green** (2026-08-12) | 113 Domain + 194 Application + 120 Infrastructure + 153 API. Three need Docker (skip cleanly without it; CI excludes via `--filter "Category!=Container"`). Re-run before trusting. |
| Sprints | 1–5 complete · **6 in progress** · 7–8 not started | Index: `SPEC/95-next-sprints.md`. Plans: `SPEC/sprints/`; completed in `SPEC/sprints/archive/`. |
| QA / code review | **Partially paid down** | Sprint 4 covered auth/CSV/UDF/idea-repository/client-auth. Collaboration/Comments, Events, Tenant Admin, Workflow Config, most client files and Domain entities were **never reviewed** — still open, and Sprint 6 touches authorization. Boundary: `sprints/archive/sprint-04-qa-review-debt.md`. |
| Bug queue | **Empty** | `SPEC/Bug Triage.md` `TODO` is clear as of 2026-08-12 — nothing gates the start of Sprint 6. |
| Local DB | `collega-postgres` (`postgres:16`), port **5432**, role `collega` | Standard demo seed (2 orgs, 8 users, 4 boards, 44 ideas). Dev demo Site Admin: `siteadmin@demo.collega.test` / `Abc123!`. **If the API won't connect, check user-secrets for a stale SQL Server string** — see `src/Collega.API/CLAUDE.md`. |

### Sprint 5 — complete (merged `7c5a78b`)
**The InMemory suite sees neither collation, SQL translation, nor DDL** — all four defects it found were invisible to 561 green tests, so container-backed `PostgresProviderTests` is the only real proof the DB behaves. Post-mortem: `sprints/archive/sprint-05-postgres-migration.md`.

### Sprint 6 — in progress (started 2026-08-13)
View As. **Spec + contracts written, no implementation code yet** — stopped for design review, since a mistake here is a privilege-escalation hole. Canonical: `20-feature-view-as.md`; endpoints: `30-Contracts.md` → "View As Contracts"; plan: `sprints/sprint-06-view-as.md`.

### Locked decisions (current only — reversals are deleted, not struck through)
- Portrait image library = **SkiaSharp**.
- Site Admin org-content mutation = **View As act-as only** (Sprint 6, full act-as + dual attribution); no direct create/edit paths, no org dropdowns. Org + user admin stay direct as the bootstrap exception. → `20-feature-client-ui.md`.
- AI idea drafting = **Sprint 7**; `Anthropic` package approved, single platform-level key, dedupe deferred to v2. → `20-feature-ai-idea-assist.md`.
- New page/flow UI is **comp-first**.
- Judgment calls resolved 2026-08-11, no code change needed: fixed-window lockout for MVP; JWT key stays ephemeral until Sprint 8; `Status` name stays `nvarchar(100)`; status defaults final. → `sprints/archive/sprint-04-qa-review-debt.md`.

### Out of sprint scope — leave intact
User-owned, landed on `dev`: the `e2e/` Playwright suite (`7a92dda`) and the AI-brainstorm WIP in `Ideas.razor`/`IdeaBrainstormModal.razor`.

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
