# Sprint 14 — Board pull-in and ideas with no board

**Status:** Complete 2026-10-16: QA slices 181 and 184 merged into `dev` (reviewer approved). Earlier: Slices 178, 179, 180, 182 and 183 are built and independently reviewed (2026-10-13; each approved, review fixes applied). 181 and 184, the QA slices, remain. Planned 2026-10-13; the user answered Q1–Q6 the same day (`SPEC/20-feature-board-pull-in.md`, "Answered questions") and approved the comp as drawn.

**Goal:** creating or editing a board can pull in existing items (Discovery ideas from other boards, backlog Issues returned to Discovery, and ideas with no board), an idea may belong to no board, and Home shows an Org Admin how many ideas still need one. Authority: `SPEC/20-feature-board-pull-in.md`; `SPEC/decisions.md` 2026-10-13 ("Boards can pull in existing items, and ideas can have no board", which also records the eighth S0.2 schema amendment).

**Order.** 179 first (schema, domain and the pool; everything else needs a nullable board). 180 follows it. 182, the comp, runs in parallel with 179 and 180 because it changes no code. 181 follows 179–180; 183 needs 180 and the approved comp; 184 follows 183. Bug Triage `TODO` was empty when read on 2026-10-12.

**Release.** The migration and the code reach `dev` as each slice merges. Nothing here ships to `main` or production until the cutover (Sprint 13, slice 140) has released: production should not take an eighth schema change mid-cutover.

**Out of this sprint:** a single-idea *Move to another board* action (parked in `SPEC/ideas-inbox.md`); CSV import and the idea assistant creating pool ideas (answered no, Q6); anything in `SPEC/20-feature-board-pull-in.md` "Out of scope".

## Slices

| # | Slice | Role | Depends on | Scope |
|---|---|---|---|---|
| 178 | Board pull-in: spec | Backend (docs) | — | `SPEC/20-feature-board-pull-in.md`, the 2026-10-13 decision, this plan, the tracker row. **Done 2026-10-13**, pending review. |
| 179 | Ideas with no board: schema, domain, contracts | Backend | 178 | Migration: `ideas.board_id` and `notification_events.board_id` drop `NOT NULL`. Domain: `createIdea` and the notification event accept no board. Application: the pool create (`POST /organizations/{orgId}/ideas`), detach (`DELETE /ideas/{ideaId}/board`), the `board=none` list filter, null cases in `ensureIdeaBoardNotArchived`, `changeStatus` and the comment, task and notification inputs; `IdeaBoardChanged` audit. Infrastructure: list `none` filter and null ordering, tag usage `LEFT JOIN`. Contracts written: `ideas.md` (the new routes, the `none` filter, nullable shapes), with one line each in `delivery.md`, `notifications.md` and `tags.md`; `boards.md` is 180's. Confirms the golden replay is unchanged. Web only as far as `boardId: string \| null` typing. |
| 180 | Pull onto a board | Backend | 179 | `pullItemIds` on `POST …/boards` **and `PUT …/boards/{boardId}`** (Q3; on an edit, after the lane removal's `ideaMoves`, never the board's own ideas, archived boards `409`): eligibility (rule 10), the role check (rule 11), placement (rule 13), Return to Discovery inside the pull without the archived-board refusal (rule 14), `reassignIdeas` in the same unit of work as the new board, audit (rule 18), the 100-item cap, `pulledItems` in the response. Home's `Needs a board` count needs no new route (the list's `none` filter). The picker's reads: the list filters, or `pull-candidates` if they cannot carry the cases (decided here). |
| 181 | QA for 179 and 180 | QA | 179, 180 | Per `SPEC/40-test-strategy.md`, each rule checked by breaking it: every refusal in rules 5–6 and 10–12, the placement rule both ways, atomicity (a refused or vanished item creates nothing), the User-versus-Org-Admin matrix, the Issue return keeping tasks, effort and the promotion snapshot, no notification, audit shapes, null-board handling in the list, tag counts and the inbox, and a live-Postgres suite for `reassignIdeas`. |
| 182 | Comp: board pull-in, the pool, Home tile | UI/UX (comp) | 178 | `SPEC/mockups/comp-r-board-pull-in.html`: the board form's *Add existing items* step (create and edit) with its three tabs and landing line, the idea form's *No board* choice, the *No board* label, *Remove from board*, and the Org Admin's *Needs a board* tile added to the Home comp. Comp only. **Approved as drawn by the user 2026-10-13.** |
| 183 | UI: pull-in, the pool and the Home tile | UI/UX | 180, 182 approved | Built to the approved comp in `apps/web` (`settings/board-form.tsx` for create and edit, `idea-form.tsx`, the drawer and list, Home's tile through `lib/data/home.ts`). `string \| null` board through `adapt.ts`, the card actions and the list. |
| 184 | QA for 183 | QA | 183 | The Home tile (Org Admin only, its count and link), the picker's tabs and role-based visibility on create and edit, selection and the 100 cap, the refusal messages rendered beside `pullItemIds`, the form's *No board* default by entry point, and the detach action's visibility. |

## Open

Nothing. The two details that were *(proposed)* are settled by the comp's approval (`SPEC/decisions.md` 2026-10-13).
