# Next Sprints: Index

## Purpose
Index of the sprint plan for remaining pre-MVP work as of 2026-08-10. This is **not** new feature scope — per `SPEC/implementation-agent-tracker.md`, all originally-planned MVP epics (Foundation through Hardening, T001-T052), User-Defined Fields (T053-T060), and Idea-Type Fields (T061-T067) are merged into `dev`. What remains is `SPEC/Bug Triage.md`'s open `TODO` list, a handful of unconfirmed judgment calls left by fast-tracked merges, and a deferred QA/Code-Review pass. Confirmed with the user via interview on 2026-08-10 before drafting.

**This file is an index only — sprint content lives in per-sprint files.** Each sprint has its own file under `SPEC/sprints/`, moved to `SPEC/sprints/archive/` when complete (per user convention, 2026-08-10: every sprint gets a standalone plan document, archived on completion, same pattern as `SPEC/implementation-agent-tracker.md`/`-archive.md`).

**Execution model note:** this project ships via role-based agents in isolated git worktrees (Backend Developer / QA Developer / UI/UX Developer / Code Reviewer — see `CLAUDE.md`'s "Multi-Agent Worktree Workflow"), not a human team with PTO. "Sprint" here means one coherent wave of agent work merged and verified together, not a calendar week. Capacity is expressed as slice count / role assignment, not points or days.

**Explicitly out of scope for these sprints** (confirmed with the user): the uncommitted, in-progress `tests/Collega.E2E.Tests/` work — being driven separately, not scheduled here. Also out of scope: anything post-MVP (OAuth, SAML, self-service password reset, AI-assisted idea creation, Org AI credentials, the Roadmaps/Sprints/Tasks brainstorm in `Bug Triage.md`'s `## IDEAS` section) — none of that is "pre-MVP."

## Sequencing
Sprints run in order — each builds on the previous sprint's merged state rather than in parallel. Sprint 2 (Drawer-Pattern Rollout) is the largest structural change to the admin list pages and runs right after the Sprint 1 quick-wins so all list-page churn is consolidated once; Sprint 3 (List Filter Parity + server-side sort) then layers filters and sorting onto those finalized pages, so it needs Sprint 2 merged as its starting point. Sprint 4's review pass needs Sprints 1-3 fully merged to review the final shape rather than a moving target. Sprint 5 (PostgreSQL migration — approved direction 2026-08-11, scoped in `SPEC/50-postgres-migration.md`) runs after Sprint 4 so the engine swap starts from reviewed, stable code and regenerates migrations once, after Sprint 4's review has settled the final SQL-Server shape; it is otherwise independent of Sprints 1-4. Sprint 6 (View As — user impersonation for support; a post-MVP feature added 2026-08-11 at user request) runs after Sprint 5 so it's built on the migrated Postgres code, and **before** deployment so the first Azure deploy ships it; it is kicked off only once Sprints 4–5 are done (per user). Sprint 7 (Azure deployment) runs **last, and only after Sprint 5 is implemented in code and verified working against a real Postgres instance** — the migration changes the deployment's database engine (Azure Database for PostgreSQL, not Azure SQL) and connection-string format, so deploying before it is done would provision the wrong target. This is a hard dependency, not a soft ordering preference. Azure also waits for Sprint 6 to merge so the deployment includes View As. (Note: the Site Admin seed-reset flag bundled into Sprint 2 is an independent backend affordance with no cross-sprint dependency — it's placed there only for scheduling.)

| # | Sprint | File | Status | Rough Size |
|---|---|---|---|---|
| 1 | Bug Triage quick wins + bookkeeping reconciliation | `SPEC/sprints/archive/sprint-01-bug-triage-quick-wins.md` | Complete (2026-08-10) | Small |
| 2 | Drawer-pattern rollout (Orgs/Users/Statuses/Idea Types/Custom Fields) + Site Admin seed-reset flag | `SPEC/sprints/archive/sprint-02-drawer-pattern-rollout.md` | Complete (2026-08-10) | Medium–Large (largest blast radius) |
| 3 | List filter parity (all-column search, tag filter, user-association filter) + server-side sort | `SPEC/sprints/archive/sprint-03-list-filter-parity.md` | Complete (2026-08-11) | Small–Medium |
| 4 | QA/Code-Review debt pass + profile portrait upload | `SPEC/sprints/sprint-04-qa-review-debt.md` | Not started | Medium |
| 5 | PostgreSQL migration (SQL Server → Postgres) | `SPEC/sprints/sprint-05-postgres-migration.md` | Not started | Small–Medium |
| 6 | View As (user impersonation for support) — post-MVP feature, added 2026-08-11 | `SPEC/sprints/sprint-06-view-as.md` | Not started | Medium |
| 7 | Azure deployment (provision + first deploy + CI/CD) | `SPEC/sprints/sprint-07-azure-deployment.md` | Not started | Medium |

Update the Status column here whenever a sprint file's own `Status:` line changes (Not started → In Progress → Complete), and move the file to `SPEC/sprints/archive/` once Complete.

## Key Open Question For Next Session
Sprint 1's actual size depends entirely on the bookkeeping audit (how much of Bug Triage's `TODO` list is already fixed but just not marked `COMPLETED`). Run that audit first before committing agent capacity to the rest of Sprint 1.
