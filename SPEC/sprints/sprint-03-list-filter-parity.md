# Sprint 3: List Filter Parity + Server-Side Sort

**Status:** Not started
**Sequence:** 3 of 4 — see `SPEC/95-next-sprints.md` for the full sequence and how these sprints relate. Starts after Sprint 2 (`sprint-02-drawer-pattern-rollout.md`) is merged.

> **Reorder note (2026-08-10):** moved after the Drawer-Pattern Rollout so filters + sort land on the finalized list-page structure, not one that's about to be rebuilt. Also absorbs the Ideas-list **sorting** item (moved out of Sprint 1): per the user decision to **extend the API**, filters and sort are implemented server-side (real query params + `SPEC/30-Contracts.md` updates), not client-side over the loaded page — today's type/status filtering is client-side-only, a known limitation this sprint supersedes.
**When complete:** move this file to `SPEC/sprints/archive/`, set Status to `Complete` with the completion date, and update `SPEC/95-next-sprints.md`'s index.

## Goal
Every list page's search/filtering matches the Bug Triage spec: search covers every displayed column, tag-supporting entities get a tag filter, and entities with a user association (created-by/assigned-to) get a user filter. The Ideas list gains server-side column sorting. Filters and sort are implemented **server-side** (query params + contract updates), correct across all pages under pagination.

## Capacity
| Role | Slices this sprint | Notes |
|---|---|---|
| Backend Developer | 1 | Likely needs API query-param support beyond what `ListToolbar`'s existing all-column search already covers (tag filter, user-association filter) |
| Client Developer | 1 | Filter UI additions per entity |
| QA Developer | 1 | Contract + integration test coverage for new filter params |
| **Total** | **3** | |

## Sprint Backlog
| Priority | Item | Notes | Dependencies |
|---|---|---|---|
| P0 | Audit each list page's current search against "every displayed column" — Organizations, Users, Boards, Statuses, Idea Types, Custom Fields, Ideas | T-UI-2's `ListToolbar` added search to all admin lists already — confirm it's genuinely all-column, not just a subset | None |
| P0 | Tag search filter on tag-supporting entities | Ideas has tags today; confirm whether any other entity needs this per the spec's entity list | Depends on audit above |
| P0 | User-association filter (created-by / assigned-to) where applicable | Ideas is the clear case (author/assignees); confirm no other entity needs it | Depends on audit above |
| P1 | Server-side sorting on the Ideas list (Title, Created By, Assigned To, Status, Created Date) via clickable column headers | Moved here from Sprint 1; add `sort`/`dir` query params to the org ideas endpoint + `SPEC/30-Contracts.md`, wire sortable headers | Server-side per the "extend the API" decision |

## Risks
| Risk | Impact | Mitigation |
|---|---|---|
| "Every displayed column" search on wide tables may be expensive server-side without indexes | Slow list pages under load | Scope to the columns actually specified in Bug Triage; add DB indexes if a specific column proves slow, don't over-build |

## Definition of Done
- [ ] Every list page's search covers its full displayed-column set
- [ ] Tag and user-association filters present wherever the entity supports them
- [ ] Ideas list sortable server-side by Title, Created By, Assigned To, Status, Created Date
- [ ] `SPEC/30-Contracts.md` + feature spec updated for the new filter/sort query params
- [ ] API + client tests cover new filter/sort params; build 0/0
