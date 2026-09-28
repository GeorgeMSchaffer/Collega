# Sprint 11 — Comp R, phase 2

**Status:** Not started (planned 2026-09-28). Waiting on the open questions in the tracker's slice
105 row; slices marked *(pending answer)* change shape with them.

**Goal:** the 2026-09-28 iteration of comp R (`SPEC/mockups/comp-r-portico-prototype.html`) in the
product: Graphite as the dark theme, the denser form and control layout in every theme, tags with a
colour and a Settings → Tags screen, the effort bar, and the Sprint board and Roadmap as comp R draws
them. Authority: `SPEC/decisions.md` 2026-09-28 (three entries), `20-feature-client-ui.md` "Forms and
controls", "Tag colours and the effort bar" and "Themes", `20-feature-ideas-and-engagement.md` "Tags"
rules 9–15, `20-feature-issues-and-delivery.md` "Comp R iteration", `30-Contracts.md` (additions
dated 2026-09-28).

**Numbering.** Sprint 10 named "phase 2" as the prompt-eval runner and "phase 3" as idea assistant
v2; neither has started. This sprint takes the next number because it is the next work planned, not
because it replaces them — they keep their order after it.

**Out of this sprint:** issue keys (a separate decision and schema amendment), the Backlog screen
(unchanged), moving the other Settings entities to the pattern, the prompt-eval runner and idea
assistant v2.

**Bug Triage.** Its `TODO` gate applies: five items are open, and the 2026-09-27 exception was for
Sprint 10's work. Clear the queue, or record a new exception in `decisions.md`, before slice 106
starts *(pending answer)*.

## Slices

| # | Slice | Role | Depends on | Scope |
|---|---|---|---|---|
| 106 | Tag colours and tag management (API) | Backend | — | Migration adding `tags.color` with the hash backfill (the fourth S0.2 amendment). Domain: the ten-colour palette, colour validation, a random-colour port injected into the application layer so tests fix it; inline tag creation (idea create/update, CSV import) takes a random colour. Routes: `GET /organizations/{id}/tags/catalog`, `POST /organizations/{id}/tags`, `PUT /tags/{id}`, `DELETE /tags/{id}` with the Org Admin gate and the Site Admin guard; duplicate names a field-keyed `400`, including the concurrent case. Read shapes: `tags` on the idea list item, detail and delivery card; `color` on board `topTags`; `effort` on the idea list item *(pending answer — dropped if idea cards do not show effort)*. Demo seed colours by the same hash. Golden accepted differences recorded. |
| 107 | Outcomes and the roadmap read (API) *(pending answer — only if Sprint 11 builds Slice 2)* | Backend | — | First writes the Outcome and Roadmap contracts into `30-Contracts.md` from `20-feature-issues-and-delivery.md` and the gaps recorded there on 2026-09-28 (colour; one roadmap read with no granularity; setting several Issues' grouping in one save), and extends the fourth amendment's Part B in `decisions.md` once approved. Then the `outcomes` table with `color` and `ideas.outcome_id`; the `Outcome` entity and invariants; the outcome service (list with derived rollups, create, update, reorder, soft-delete that ungroups, grouping); the routes; audit events per the feature spec. Demo seed gains outcomes over the seeded Issues. |
| 108 | Graphite, the denser controls, and the kit pieces (web) | UI/UX | — | Replace the `notte` block in `packages/design-system/src/globals.css` with `graphite` (comp R values, IBM Plex Sans and JetBrains Mono in the fonts stylesheet); a `notte` cookie reads as `graphite`; the picker lists Graphite under Dark. Add `--metric`, `--field` and `--suggest-line` to every theme. Control geometry tokens to comp R's (32/28px buttons, 34px fields, 12px labels) and the form row helpers (three and two to a row, one below 900px); mono metadata style. New primitives: `EffortBar` (with its words), a coloured `TagChip` whose text mix clears 4.5:1 in every theme (a test over all ten colours × five themes), and a swatch radio group. Existing forms re-checked at the new density (the idea drawer form moves Business impact · Idea type · Priority into one row). `/design-system` shows the new pieces. |
| 109 | Settings → Tags, and coloured tags everywhere (web) | UI/UX | 106, 108 | `/settings/tags` on the list and detail pattern per ideas rules 11–15: list, text and Usage filters, sort, client paging, the tag drawer (view with *Used on* from the ideas list's `tag` filter; create and edit with name, swatches and preview), Delete with confirmation; Settings hub card for Org Admins; visibility for other roles per the answer *(pending answer)*. Every tag chip in the app (idea cards, lists, drawer, board list and cards, delivery cards) takes its colour from `tags`/`topTags`. The Ideas Tags filter reads the catalog instead of assembling its options. The effort bar on idea cards and rows *(pending answer)*. |
| 110 | Sprint board on comp R (web) | UI/UX | 106, 108 | `/delivery/sprint` per "Sprint board (comp R)": the header with the sprint name and goal; the sprint strip (state, days past end, window, issues, progress); five lanes; cards with assignees, title and the effort bar (no key); drag between lanes through `PUT /ideas/{id}/delivery-status` with revert and the permission rule; **Complete sprint** wired with its confirmation and toast; **Plan next sprint** *(pending answer)*; selecting a card opens the Issue *(pending answer: drawer or the Issue page)*. The Backlog's cards take the effort bar too. |
| 111 | Roadmap on comp R (web) | UI/UX | 107, 108 | `/delivery/roadmap` per "Roadmap (comp R)": header with *Add New Outcome*; the Weeks / Months / Quarters zoom in the URL, no shortcuts; the timeline with window bars, planned outlines, sprint-span lines and the TODAY rule; outcome cards with Issue rows (status, effort bar, assignee); the outcome drawer (view, create, edit with the Issue checklist and *moves from*, Delete with confirmation). Visible window per the answer *(pending answer)*. If 107 is not in this sprint, this slice is deferred with it rather than built against empty readers *(pending answer)*. |
| 112 | QA for phase 2 | QA | 106–111 | Per `SPEC/40-test-strategy.md`, each rule checked by breaking it: the colour backfill is repeatable and every existing tag gets one; random colour only from the palette and fixed under test; tag create/rename/delete semantics (duplicate and concurrent names, case-only rename, delete across phases and archived boards, Org Admin gate, Site Admin guard, cross-organization `404`); catalog counts with a bounded number of queries; the chip contrast test; theme cookie fallback from `notte`; Sprint board move permissions and revert, Complete sprint carry-over; Outcome invariants, single-parent moves and ungroup-on-delete (if 107 ran); the Playwright suite updated for Settings → Tags, the Sprint board and the Roadmap. |

Every slice: its own worktree off `dev`, `pnpm check` green, Code Reviewer approval, merge to
`dev`, tracker updated.
