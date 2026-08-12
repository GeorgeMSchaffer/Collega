# Next Sprints: Index

## Purpose
Index of the sprint plan for remaining pre-MVP work as of 2026-08-10. This is **not** new feature scope — per `SPEC/implementation-agent-tracker.md`, all originally-planned MVP epics (Foundation through Hardening, T001-T052), User-Defined Fields (T053-T060), and Idea-Type Fields (T061-T067) are merged into `dev`. What remains is `SPEC/Bug Triage.md`'s open `TODO` list, a handful of unconfirmed judgment calls left by fast-tracked merges, and a deferred QA/Code-Review pass. Confirmed with the user via interview on 2026-08-10 before drafting.

**This file is an index only — sprint content lives in per-sprint files.** Each sprint has its own file under `SPEC/sprints/`, moved to `SPEC/sprints/archive/` when complete (per user convention, 2026-08-10: every sprint gets a standalone plan document, archived on completion, same pattern as `SPEC/implementation-agent-tracker.md`/`-archive.md`).

**Execution model note:** this project ships via role-based agents in isolated git worktrees (Backend Developer / QA Developer / UI/UX Developer / Code Reviewer — see `CLAUDE.md`'s "Multi-Agent Worktree Workflow"), not a human team with PTO. "Sprint" here means one coherent wave of agent work merged and verified together, not a calendar week. Capacity is expressed as slice count / role assignment, not points or days.

**Explicitly out of scope for these sprints** (confirmed with the user): the uncommitted, in-progress `tests/Collega.E2E.Tests/` work — being driven separately, not scheduled here. Also out of scope: anything post-MVP (OAuth, SAML, self-service password reset, Org AI credentials, the Roadmaps/Sprints/Tasks brainstorm in `Bug Triage.md`'s `## IDEAS` section) — none of that is "pre-MVP."

**Two post-MVP features have since been pulled in by explicit user decision** and are scheduled here despite not being pre-MVP: **View As** (Sprint 6, added 2026-08-11 — now load-bearing, since it is the Site Admin's only org-content mutation path) and **AI-assisted idea drafting** (Sprint 7, added 2026-08-11 — *not* load-bearing; the product works with it dark). Per-org AI credentials remain out of scope; AI idea assist v1 uses a single deployment-level key.

## Sequencing
Sprints run **strictly in order** — each builds on the previous sprint's merged state, not in parallel.

| # | Blocked by | Why that dependency exists |
|---|---|---|
| 2 | 1 | Largest structural change to the admin list pages; runs right after the quick-wins so all list-page churn is consolidated once. |
| 3 | 2 | Layers filters and server-side sort onto the *finalized* list pages. |
| 4 | 1–3 | The review pass needs a settled shape to review, not a moving target. |
| 5 | 4 | Engine swap starts from reviewed, stable code and regenerates migrations **once**, after Sprint 4 settles the final SQL-Server shape. Otherwise independent of 1–3. |
| 6 | 5 | Built on the migrated Postgres code, and must land **before** deployment so the first Azure deploy ships View As. |
| 7 | 6 | Its one schema addition must be generated against the final engine; must precede deployment so the first Azure deploy provisions its key. |
| 8 | 5 **(hard)**, 6, 7 | **Hard dependency, not a preference:** the migration changes the deployment's database engine (Azure Database for PostgreSQL, not Azure SQL) and connection-string format. Deploying before Sprint 5 is implemented *and verified against a real Postgres instance* provisions the wrong target. Also waits on 6 and 7 so the deploy includes them. |

Note: the Site Admin seed-reset flag bundled into Sprint 2 has no cross-sprint dependency — it sits there for scheduling convenience only.

| # | Sprint | File | Status | Rough Size |
|---|---|---|---|---|
| 1 | Bug Triage quick wins + bookkeeping reconciliation | `SPEC/sprints/archive/sprint-01-bug-triage-quick-wins.md` | Complete (2026-08-10) | Small |
| 2 | Drawer-pattern rollout (Orgs/Users/Statuses/Idea Types/Custom Fields) + Site Admin seed-reset flag | `SPEC/sprints/archive/sprint-02-drawer-pattern-rollout.md` | Complete (2026-08-10) | Medium–Large (largest blast radius) |
| 3 | List filter parity (all-column search, tag filter, user-association filter) + server-side sort | `SPEC/sprints/archive/sprint-03-list-filter-parity.md` | Complete (2026-08-11) | Small–Medium |
| 4 | QA/Code-Review debt pass + profile portrait upload + code-review hardening batch (folded in 2026-08-11) | `SPEC/sprints/sprint-04-qa-review-debt.md` | Not started | Medium |
| 5 | PostgreSQL migration (SQL Server → Postgres) | `SPEC/sprints/sprint-05-postgres-migration.md` | Not started | Small–Medium |
| 6 | View As (act-as impersonation; D-MODE locked 2026-08-11 = full act-as — now also the Site Admin's only org-content mutation path) | `SPEC/sprints/sprint-06-view-as.md` | Not started | Medium |
| 7 | AI-assisted idea drafting (idea brainstorm chat; four design decisions locked 2026-08-11, `Anthropic` package approved) | `SPEC/sprints/sprint-07-ai-idea-assist.md` | Not started | Medium |
| 8 | Azure deployment (provision + first deploy + CI/CD) | `SPEC/sprints/sprint-08-azure-deployment.md` | Not started | Medium |

Update the Status column here whenever a sprint file's own `Status:` line changes (Not started → In Progress → Complete), and move the file to `SPEC/sprints/archive/` once Complete.

## Key Open Question For Next Session
Sprint 1's actual size depends entirely on the bookkeeping audit (how much of Bug Triage's `TODO` list is already fixed but just not marked `COMPLETED`). Run that audit first before committing agent capacity to the rest of Sprint 1.
