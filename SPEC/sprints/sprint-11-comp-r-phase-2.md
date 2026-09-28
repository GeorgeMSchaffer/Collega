# Sprint 11 — Comp R, phase 2

**Status:** Not started (planned 2026-09-28; questions answered 2026-09-28).

**Goal:** the 2026-09-28 iteration of comp R (`SPEC/mockups/comp-r-portico-prototype.html`) in the
product: Graphite as the dark theme, the denser form and control layout in every theme, tags with a
colour and a Settings → Tags screen, the effort bar on Issues and ideas, the Sprint board as comp R
draws it with Issues in the drawer, and the Roadmap screen restructured on the data that exists.
Authority: `SPEC/decisions.md` 2026-09-28 (four entries), `20-feature-client-ui.md` "Forms and
controls", "Tag colours and the effort bar" and "Themes", `20-feature-ideas-and-engagement.md` "Tags"
rules 9–15, `20-feature-issues-and-delivery.md` "Comp R iteration", `30-Contracts.md` (additions
dated 2026-09-28).

**Order.** Sprint 11 runs first; the prompt-eval runner and then idea assistant v2 (the phases
Sprint 10 named 2 and 3) follow it, in that order (answered 2026-09-28).

**Out of this sprint:** the Outcomes backend (Issues-and-Delivery Slice 2 — a later sprint, with its
own schema amendment), issue keys (decided separately), the Backlog screen beyond the effort bar and
the Issue drawer, moving the other Settings entities to the pattern, the prompt-eval runner and idea
assistant v2.

**Bug Triage exception granted** (2026-09-28), on one condition: slice 106 also fixes the `db:seed`
`P2002` on `board_swimlanes` item (upsert swimlanes on `(board_id, status_id)`), since it changes
the seed anyway, and moves it to `SPEC/archive/bug-triage-completed.md`. The other four `TODO` items
stay queued.

## Slices

Numbered 106–111. An Outcomes backend slice was planned and dropped when the answers came back, and
the slices after it were renumbered; nothing had started.

| # | Slice | Role | Depends on | Scope |
|---|---|---|---|---|
| 106 | Tag colours and tag management (API), and the seed fix | Backend | — | Migration adding `tags.color` with the hash backfill (the fourth S0.2 amendment). Domain: `#RRGGBB` validation (any six-digit colour, stored upper case), the ten-colour palette for random picks, a random-colour port injected into the application layer so tests fix it; inline tag creation (idea create/update, CSV import) takes a random palette colour. Routes: `GET /organizations/{id}/tags/catalog` (every member), `POST /organizations/{id}/tags`, `PUT /tags/{id}`, `DELETE /tags/{id}` (Org Admin, Site Admin guard); duplicate names a field-keyed `400`, including the concurrent case. Read shapes: `tags` on the idea list item, detail and delivery card; `color` on board `topTags`; `effort` on the idea list item. **`GET /ideas/{ideaId}/delivery`**: one delivery card, built by the delivery list's own card composition, member-readable, `404` for another organization, a Discovery idea or a deleted one. Demo seed colours by the same hash. Golden accepted differences recorded. **Bug Triage condition:** the seed upserts swimlanes on `(board_id, status_id)`, so `db:seed` without `--reset` no longer fails with `P2002` after a board's lanes are edited. |
| 107 | Graphite, the denser controls, and the kit pieces (web) | UI/UX | — | Replace the `notte` block in `packages/design-system/src/globals.css` with `graphite` (comp R values, IBM Plex Sans and JetBrains Mono in the fonts stylesheet); a `notte` cookie reads as `graphite`; the picker lists Graphite under Dark. Add `--metric`, `--field` and `--suggest-line` to every theme. Control geometry tokens to comp R's (32/28px buttons, 34px fields, 12px labels) and the form row helpers (three and two to a row, one below 900px); mono metadata style. New primitives: `EffortBar` (with its words); a `TagChip` whose text colour is computed per theme to clear 4.5:1 for any colour, with the test the client UI spec names (palette, RGB corners and greys × five themes); a colour picker of ten swatches plus a Custom `#RRGGBB` input. No keyboard shortcuts or key-hint chips anywhere. Existing forms re-checked at the new density (the idea drawer form moves Business impact · Idea type · Priority into one row). `/design-system` shows the new pieces. |
| 108 | Settings → Tags, and coloured tags everywhere (web) | UI/UX | 106, 107 | `/settings/tags` on the list and detail pattern per ideas rules 11–15: list, text and Usage filters, sort, client paging, the tag drawer (view with *Used on* from the ideas list's `tag` filter; create and edit with name, swatches, Custom colour and preview), Delete with confirmation. Org Admins only: a hub card for them, a read-only view for a Site Admin, the refusal panel for members and Read Only. Every tag chip in the app (idea cards, lists, drawer, board list and cards, delivery cards) takes its colour from `tags`/`topTags`. The Ideas Tags filter reads the catalog instead of assembling its options (closes slice 102's deviation). The effort bar on idea cards and rows whenever an idea has an effort. |
| 109 | Sprint board on comp R, Start sprint, and the Issue drawer (web) | UI/UX | 106, 107 | `/delivery/sprint` per "Sprint board (comp R)": the header with the sprint name and goal; the sprint strip (state, days past end, window, issues, progress); five lanes; cards with assignees, title and the effort bar (no key); drag between lanes through `PUT /ideas/{id}/delivery-status` with revert and the permission rule; **Complete sprint** with its confirmation and toast; **Plan next sprint** opening the Add New Sprint form in the drawer on `POST /sprints`; with no `Active` sprint, the next `Planned` one (earliest start) shown with **Start sprint** behind a confirmation on `POST /sprints/{id}/start`, same roles as Complete sprint. "The Issue in the drawer": selecting a card on the Sprint board or the Backlog opens it with its delivery facts (status select, effort, sprint, outcome as *Not grouped*, provenance, tasks) and the idea's content. The drawer's deep link and `/delivery/issues/{id}` read `GET /ideas/{id}/delivery` instead of fetching every sprint and the backlog. The Backlog's rows take the effort bar. |
| 110 | Roadmap on comp R, without Outcomes (web) | UI/UX | 107 | `/delivery/roadmap` per "Roadmap (comp R)" — "What Sprint 11 shows": the header with *Add New Outcome* disabled for every role with its reason; the Weeks / Months / Quarters zoom in the URL with the fixed windows anchored on today and no panning; the timeline with the TODAY rule and the Sprints rows from `GET /sprints` (Active linked to the Sprint board); the empty state where outcomes will go. The outcome readers stay empty. |
| 111 | QA for phase 2 | QA | 106–110 | Per `SPEC/40-test-strategy.md`, each rule checked by breaking it: the colour backfill is repeatable and every existing tag gets one; `#RRGGBB` validation; random colour only from the palette and fixed under test; tag create/rename/delete semantics (duplicate and concurrent names, case-only rename, delete across phases and archived boards, Org Admin gate, Site Admin guard, cross-organization `404`); catalog counts with a bounded number of queries; the seed re-runs cleanly after lanes are edited; the chip contrast test; the theme cookie fallback from `notte`; Settings → Tags refused to members; `GET /ideas/{id}/delivery` (card equals the list's card, `404` cases, Read Only allowed); Sprint board move permissions and revert, Complete sprint carry-over, Start sprint shown only with no Active sprint and on the earliest Planned one, Add New Sprint validation; the Issue drawer's status select by role; the Roadmap windows at each zoom around month and quarter boundaries; the Playwright suite updated for Settings → Tags, the Sprint board and the Roadmap. |

Every slice: its own worktree off `dev`, `pnpm check` green, Code Reviewer approval, merge to
`dev`, tracker updated.
