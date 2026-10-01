# Sprint 10 — Comp R, phase 1

**Status:** Complete (2026-09-27). Slices 099–103 are merged into `dev`; slice 103, the QA slice, merged on 2026-09-27.

**Goal:** Boards, a board and Ideas work the way comp R (`SPEC/mockups/comp-r-portico-prototype.html`)
does, in the Terrazzo theme family, with ideas carrying Problem, Proposed solutions and Impact
rationale. Authority: `SPEC/decisions.md` 2026-09-27 (three entries), `20-feature-client-ui.md`
"List and detail pattern" and "Themes", `20-feature-ideas-and-engagement.md` rule 2a,
`20-feature-boards-and-statuses.md` rule 13, `30-Contracts.md`.

**Out of this phase:** the prompt-eval runner (phase 2), idea assistant v2 (phase 3), and moving the
Settings and Delivery lists to the pattern. Until phase 3, *Add New Idea* opens the form in the
normal-width drawer with no assistant; the v1 chat is not wired into the web app today and stays
unwired.

**Bug Triage exception** granted for this sprint, conditional on slice 100 fixing the "two
level-1 headings" item.

## Slices

| # | Slice | Role | Depends on | Scope |
|---|---|---|---|---|
| 099 | Structured ideas, list queries, board archive (API) | Backend | — | Migration adding `problem`, `proposed_solutions`, `impact_rationale`; `description` nullable; backfill per rule 2a. Domain limits (2000; 1–5 × 500; 1000). Create/update/detail/list contracts. CSV import/export carry the three fields (a row without them gets the rule 2a backfill). Repeatable `boardId`/`statusId`/`priority`/`tag` filters, new `sortBy` values, widened `search` (board, priority, tags, Problem); paging unchanged (the screens send 10/25/50/100; no new `400`). Board `archive`/`unarchive`, `includeArchived`, `isArchived`/`archivedAtUtc`; an archived board refuses new ideas, moves and edits (`409`), including edits to its own settings. Demo seed writes real values. Golden accepted differences recorded. |
| 100 | Themes, page header, list-pattern kit (web) | UI/UX | — | Five themes as token sets in `packages/design-system` (Terrazzo default; Portico, Piazza Sera, Lagoon; Notte dark), each with `--suggest`; fonts per theme; picker at the right of the top bar; choice in a cookie read on the server so the first render is themed. `Topbar` stops being an `h1`; a `PageHeader` (H1 + description + one "Add New {Item}" action) — fixes the two-`h1` Bug Triage item on every desk screen. The shared kit: text filter, multi-select with type-to-find, view switch, sortable table with Actions column, pager (10/25/50/100), overlay drawer (view/edit/create, focus handling), confirm dialog, row actions hidden by permission. State in the URL. Comps P/Q palette updated to Terrazzo so they stay a reference. |
| 101 | Boards screen on the pattern (web) | UI/UX | 099, 100 | List default, Cards alternative, Status filter (Active default / Archived), sort and page in the client, Actions: View, Edit, Archive/Unarchive; board drawer for view, edit and create (replaces the Settings navigation for these). |
| 102 | Ideas and a board on the pattern (web) | UI/UX | 099, 100 | Ideas: List default, Cards, server-side filter/sort/page; a board: Lanes default (lane columns as comp R), List alternative. Idea drawer replaces the docked inspector: view (facts, Problem, Proposed solutions, Impact rationale, custom fields, engagement), edit and create forms with the structured fields and the Idea Type's custom fields. Delete for Org Admins with confirmation. Archived board opens read-only with the banner. `NewIdeaForm` modal retired. |
| 103 | QA for phase 1 | QA | 099–102 | Per `SPEC/40-test-strategy.md`: domain limits and backfill, list query semantics, archive enforcement, the kit's keyboard and focus behaviour, and the Playwright suite updated for the drawer and the new header. |

Every slice: its own worktree off `dev`, `pnpm check` green, Code Reviewer approval, merge to
`dev`, tracker updated.
