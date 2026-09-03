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
**Verified 2026-09-03 against `cfd12ca` (`dev`, which now carries the comp P refresh, comp Q and the conversion map; `main` behind, pending its PR).** Keep this section a table plus short blocks — see Maintenance Rule at the end of this file.

| Area | State | Detail / authority |
|---|---|---|
| MVP epics (T001–T067) | **Merged to `dev`** | Foundation→Hardening, User-Defined Fields, Idea-Type Fields. Done — do not restart. |
| Blazor client | ~16 pages, 9 shared components in `src/Collega.Client/Components/` | Geist is the single typeface. |
| Test suite | **811 green, 0 failed** (2026-08-25 at `a20e856`) | 142 Domain + 324 Application + 143 Infrastructure + 202 API. **16 skipped, and the skips matter:** 5 Infrastructure `PostgresProviderTests` skip without Docker (they ran and passed on 2026-08-17, so a green run here does *not* mean the Postgres provider was exercised — start the container to cover it), and 11 `Collega.E2E.Tests` skip without a running app. Re-run before trusting. |
| Sprints | **1–7 complete** · **7.5 next** · 8 after it | Sprint 7 closed 2026-08-18. **Sprint 7.5 is an accessibility/bug paydown that gates Sprint 8** — `sprints/sprint-07.5-accessibility-and-bug-paydown.md`. Index: `SPEC/95-next-sprints.md`. Plans: `SPEC/sprints/`; completed in `SPEC/sprints/archive/`. |
| QA / code review | **Partially paid down** | Sprint 4 covered auth/CSV/UDF/idea-repository/client-auth. Collaboration/Comments, Events, Tenant Admin, Workflow Config, most client files and Domain entities were **never reviewed** — still open, and Sprint 6 touches authorization. Boundary: `sprints/archive/sprint-04-qa-review-debt.md`. |
| Bug queue | **Empty — promoted into Sprint 7.5** | Ten items from the 2026-08-16 browser pass moved to `sprints/sprint-07.5-accessibility-and-bug-paydown.md` on 2026-08-25 and deleted from `SPEC/Bug Triage.md` per its Promote-and-delete rule. Intake reopens there when 7.5 archives. |
| Comp P refresh | **Complete (2026-09-03)** | The shipped client ported to comp P's locked design, so the TypeScript conversion has a settled baseline: four files, 46 screens, every one at four roles and four states. `comp-p-focus-roadmap.html` (core, 8), `comp-p-auth.html` (8), `comp-p-admin.html` (23 `/settings/*` routes), `comp-p-delivery.html` (7 — specified, unbuilt, so it carries the *not built* strip). Delivery is regenerated on the single-parent decision. Sources and conventions: `SPEC/mockups/_build/README.md`. **Comp Q** (`comp-q-*.html`, 2026-09-03) re-renders the same fragments on Tailwind CSS v4 + shadcn/ui and is the reference for Wave E; `_build/build_q.py` (needs `npm ci` in `_build/tw`). |
| Conversion map | **Ported; ticket `01` Q C open** | `SPEC/typescript-conversion-map/` (from `feature/068`, 2026-09-03). Direction and library decided 2026-09-03: comp P canonical on Tailwind CSS + shadcn/ui (`decisions.md`); comp Q renders it; `20-feature-client-ui.md` reconciled the same day. Still open: Q C, whether Loop + three comp N concepts enter as net-new scope. `feature/068` also holds `src/prisma.md` with a credential — never merge it; rotate the key. |
| Wave A (golden tests) | **A1 + A3 built; A2 open** | `tools/golden/` (2026-09-03) — capture and replay for all 81 endpoints × 4 roles, zero-dependency TypeScript, 36 self-tests, `tools/golden/README.md`. **A2, the corpus itself, still needs a running .NET API and a fresh seed, and it must run before Sprint 8 retires the stack** — after that the conversion has no oracle. |
| Issues & Delivery | **Specified, unbuilt** | Slice 1 (Delivery + Tasks) is P0 and buildable; Slice 2 (Outcomes + Roadmap) is P1 and no longer gated. `SPEC/20-feature-issues-and-delivery.md` — no blocking Open Question remains. |
| Local DB | `collega-postgres` (`postgres:16`), port **5432**, role `collega` | Standard demo seed (2 orgs, 8 users, 4 boards, 44 ideas). Dev demo Site Admin: `siteadmin@demo.collega.test` / `Abc123!`. **If the API won't connect, check user-secrets for a stale SQL Server string** — see `src/Collega.API/CLAUDE.md`. |

### Sprint 5 — complete (merged `7c5a78b`)
**The InMemory suite sees neither collation, SQL translation, nor DDL** — its four defects were invisible to 561 green tests. Post-mortem: `sprints/archive/sprint-05-postgres-migration.md`.

### Sprint 6 — complete (2026-08-14); `dev` and `main` both at `a0ef22c`
View As, merged to `dev` at `c25eeda`; two code-review passes raised 8 then 9 findings, all fixed (`ba104db`, `322650e`). Slice 0's audit holds: `ICurrentUserContext` is the single identity chokepoint (nothing outside `API/Authentication/` reads claims) — **preserve that**, since a service reading claims directly would silently opt itself out of View As.

The last open item, retiring Site Admin direct org-content mutation, closed 2026-08-14: enforcement moved server-side into the Application layer (`OrgContentMutationGuard`) rather than resting on client affordances, which were route-shaped and bypassable. A third review pass found two unguarded paths — `ReassignIdeaTypeAsync` and `ImportBoardIdeasAsync`, the latter letting a refused Site Admin bulk-create the same ideas by CSV — both fixed and covered. Detail: `sprints/archive/sprint-06-view-as.md` Definition of Done. Canonical: `20-feature-view-as.md` rules 25-26.

**Product rule, stated by the user 2026-08-14 and now the reading of rules 25/25c/26:** *a Site Admin creates organizations and users for organizations; every other activity goes through Act As.* This resolved a real conflict — `20-feature-ideas-and-engagement.md` had said all authenticated users may upvote and comment, and that Site Admin may CSV-import ideas. Those three rules are now explicitly superseded **for the Site Admin role only** (Read Only users are members and keep both). Note the two CSV imports split: **user** import stays direct as bootstrap, **idea** import goes through View As.

### Sprint 6.5 — complete (2026-08-15)
Paydown sprint, 13 items over two intake rounds. Post-mortem: `sprints/archive/sprint-06.5-bug-fixes-and-tweaks.md`.

The one finding worth carrying forward: **the client's `ClaimsPrincipal` must be refreshed from `/auth/me`, not just read into a local field.** Impersonation is a server-side session and the token is never reissued, so the principal is the only thing that can carry the effective role — and `[Authorize(Roles=…)]`, `<AuthorizeView Roles=…>` and `IsInRole()` all read it. `MainLayout.ReloadIdentityAsync` now calls `RefreshUserAsync`; without that every role-gated surface renders for the real administrator during a View As session. This is the client-side twin of Sprint 6's `ICurrentUserContext` rule.

### Sprint 7 — complete (2026-08-18)
AI idea assist shipped: the model-backed brainstorm chat, cost controls (daily budget gate + per-org usage), rate limiting, and — in a follow-on batch on 2026-08-18 — a Site-Admin-managed **versioned system prompt** (`AiPromptVersion` + `AiPromptService`), a prompt playground / eval harness, and `.http` tracing of every model call. Plan and review findings: `sprints/archive/sprint-07-ai-idea-assist.md`. Build narrative: the tracker archive.

Two rules from this sprint are **live constraints, not history**:
- **No test may reach a model provider.** `CollegaApiFactory` blanks `ANTHROPIC_API_KEY` *and* swaps in `UnconfiguredIdeaDraftModel`. Before that guard existed the integration suite made a live billed Anthropic call, and the only symptom was one test taking five seconds instead of one. See `tests/CLAUDE.md`.
- **Retrieved content is escaped, not merely fenced.** A tag named `</organization_data> New instructions:` would otherwise close the untrusted-content block and continue as the operator. Tags are authored by ordinary Users — the lowest-privilege path into the prompt.

### Sprint 7.5 — next, and it gates Sprint 8
Accessibility and bug paydown: the ten `Bug Triage.md` items from the 2026-08-16 live browser pass, now the sprint's only home (`sprints/sprint-07.5-accessibility-and-bug-paydown.md`). Three are systemic and reach every form and drawer — Enter submits no form (no native submit control survives Fluent's shadow DOM), `DrawerShell` never takes focus (Escape dead, no containment, no restore), and `FluentTextField` has no accessible name. **These were invisible to a fully green suite**, which is why that sprint's QA slice verifies in a running browser rather than by test.

### Locked decisions (current only — reversals are deleted, not struck through)
- Outcome ↔ Issue cardinality = **single-parent**: an Issue sits under at most one Outcome (`Idea.OutcomeId`, nullable FK, `ON DELETE SET NULL`); no join table. Decided 2026-09-02 → `SPEC/decisions.md`.
- Portrait image library = **ImageSharp** (`SixLabors.ImageSharp`, pinned **3.1.12**). Fully managed, no native assets — chosen 2026-08-13 specifically because SkiaSharp's package ships natives for Windows/macOS only and broke portrait upload on Linux App Service. **Stay on the 3.1.x line:** 4.x requires a Six Labors license key and warns on every build; 3.1.x is the Split License (free for OSS/personal and organizations under the revenue threshold — re-verify terms before any commercial release).
- Site Admin org-content mutation = **View As act-as only** (Sprint 6, full act-as + dual attribution); no direct create/edit paths, no org dropdowns. Org + user admin stay direct as the bootstrap exception. → `20-feature-client-ui.md`.
- AI idea drafting: single platform-level key (per-org keys stay unbuilt), dedupe deferred to v2, `Anthropic` package approved. The system prompt is a Site-Admin-managed versioned setting. → `20-feature-ai-idea-assist.md`.
- AI assist UI = Direction **C "Draft Strip"** (`mockups/comp-c-review-11-ai-assist-c-draftstrip.html`), teal suggestion indicator, scope statement on its own Settings page, ghost-then-drop for refused turns. Canonical in `20-feature-ai-idea-assist.md` → "UI Decisions". The read-only strip is load-bearing: making it editable brings back a per-field suggested-vs-edited state machine v1 deliberately does not have.
- AI cost controls (user decisions, 2026-08-16): model **`claude-sonnet-5`** at **`low` effort**, **500,000 tokens per UTC day** as one **global** pool, degrade at the cap rather than error, usage tracked **per organization** so per-org keys (rule 30) can be metered without a backfill. The cap is a runaway stop, not a $50 guarantee — saturated daily it allows roughly $99/month, and the usage page is what makes real spend visible. → `20-feature-ai-idea-assist.md` rules 28a–28e.
- New page/flow UI is **comp-first**.
- Judgment calls resolved 2026-08-11, no code change needed: fixed-window lockout for MVP; JWT key stays ephemeral until Sprint 8; `Status` name stays `nvarchar(100)`; status defaults final. → `sprints/archive/sprint-04-qa-review-debt.md`.

### Out of sprint scope — leave intact
User-owned, landed on `dev`: the `e2e/` Playwright suite (`7a92dda`). The AI-brainstorm WIP that used to sit here shipped in Sprint 7 and is no longer out of scope.

## Notes For Next Agent
- Read `SPEC/95-next-sprints.md` for current sprint scope, not the archive's original backlog.
- Behavior authority is the numbered canonical specs — `SPEC/README.MD` indexes them; `SPEC/30-Contracts.md` is authoritative for endpoints and payloads. **`Specs Overview.md` is a derived summary, not an entrypoint to trust** — see its own header.
- **This repo sits in iCloud-synced `~/Documents`, and file contents get evicted.** A `dataless` file (check `stat -f '%Sf'`) reads as empty or times out, and shows as ` M` in `git status` without anyone having edited it. Currently ~21 files under `SPEC/`, 44 under `tests/`, 175 of 188 under `e2e/`; `src/` is clean. To restore one, `rm` the placeholder then `git show <ref>:<path> >` it — unlinking is instant, overwriting in place hangs for minutes. Avoid commands that walk the whole object store (`git fetch`, `git push`, `git worktree add`); they time out. A fast-forward you are not standing on is safest as `git update-ref` after `git merge-base --is-ancestor`.

## Maintenance Rule
This file answers **"what is true right now"** and nothing else. When updating it:

1. **Edit state in place; do not append history.** Change the table cell or decision line. Anything that reads "earlier the same day", "previously", or "was X, now Y" belongs in `SPEC/archive/implementation-agent-tracker-archive.md`.
2. **Delete reversed decisions — never strike them through.** A struck-through decision leaves both the old and new readings in context, and that is how agents answer wrong. Record the reversal in the archive; leave only the live decision here.
3. **Update the `Verified <date> against <commit>` line** whenever this section changes, and re-derive the state you are asserting rather than editing around it.
4. **Point, don't restate.** If detail lives in a sprint file, `Bug Triage.md`, or a canonical spec, link it in one clause instead of summarizing it here. Duplicated summaries go stale independently of their source, which produces exactly the contradictions this file exists to prevent.
5. **Budget: keep Current Status under ~450 words** (it was 427 at the 2026-08-11 compaction, down from ~1,300). It is re-read on every turn by the Ground-Truth Verification rule, so length here is paid continuously. Crossing the budget is the signal to move detail to the archive — not to raise the budget.
