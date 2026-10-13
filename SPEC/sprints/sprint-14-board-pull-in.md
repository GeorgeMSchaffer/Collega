# Sprint 14 — Board pull-in and ideas with no board

**Status:** Planned 2026-10-13. Slice 176 (the spec) is written and the user answered Q1–Q6 the same day (`SPEC/20-feature-board-pull-in.md`, "Answered questions"). 177 can start; the UI waits on the comp.

**Goal:** creating or editing a board can pull in existing items (Discovery ideas from other boards, backlog Issues returned to Discovery, and ideas with no board), an idea may belong to no board, and Home shows an Org Admin how many ideas still need one. Authority: `SPEC/20-feature-board-pull-in.md`; `SPEC/decisions.md` 2026-10-13 ("Boards can pull in existing items, and ideas can have no board", which also records the eighth S0.2 schema amendment).

**Order.** 177 first (schema, domain and the pool; everything else needs a nullable board). 178 follows it. 180, the comp, runs in parallel with 177 and 178 because it changes no code. 179 follows 177–178; 181 needs 178 and the approved comp; 182 follows 181. Bug Triage `TODO` was empty when read on 2026-10-12.

**Release.** The migration and the code reach `dev` as each slice merges. Nothing here ships to `main` or production until the cutover (Sprint 13, slice 140) has released: production should not take an eighth schema change mid-cutover.

**Out of this sprint:** a single-idea *Move to another board* action (parked in `SPEC/ideas-inbox.md`); CSV import and the idea assistant creating pool ideas (answered no, Q6); anything in `SPEC/20-feature-board-pull-in.md` "Out of scope".

## Slices

| # | Slice | Role | Depends on | Scope |
|---|---|---|---|---|
| 176 | Board pull-in: spec | Backend (docs) | — | `SPEC/20-feature-board-pull-in.md`, the 2026-10-13 decision, this plan, the tracker row. **Done 2026-10-13**, pending review. |
| 177 | Ideas with no board: schema, domain, contracts | Backend | 176 | Migration: `ideas.board_id` and `notification_events.board_id` drop `NOT NULL`. Domain: `createIdea` and the notification event accept no board. Application: the pool create (`POST /organizations/{orgId}/ideas`), detach (`DELETE /ideas/{ideaId}/board`), the `board=none` list filter, null cases in `ensureIdeaBoardNotArchived`, `changeStatus` and the comment, task and notification inputs; `IdeaBoardChanged` audit. Infrastructure: list `none` filter and null ordering, tag usage `LEFT JOIN`. Contracts written: `boards.md`, `ideas.md`, the new routes. Confirms the golden replay is unchanged. Web only as far as `boardId: string \| null` typing. |
| 178 | Pull onto a board | Backend | 177 | `pullItemIds` on `POST …/boards` **and `PUT …/boards/{boardId}`** (Q3; on an edit, after the lane removal's `ideaMoves`, never the board's own ideas, archived boards `409`): eligibility (rule 10), the role check (rule 11), placement (rule 13), Return to Discovery inside the pull without the archived-board refusal (rule 14), `reassignIdeas` in the same unit of work as the new board, audit (rule 18), the 100-item cap, `pulledItems` in the response. Home's `Needs a board` count needs no new route (the list's `none` filter). The picker's reads: the list filters, or `pull-candidates` if they cannot carry the cases (decided here). |
| 179 | QA for 177 and 178 | QA | 177, 178 | Per `SPEC/40-test-strategy.md`, each rule checked by breaking it: every refusal in rules 5–6 and 10–12, the placement rule both ways, atomicity (a refused or vanished item creates nothing), the User-versus-Org-Admin matrix, the Issue return keeping tasks, effort and the promotion snapshot, no notification, audit shapes, null-board handling in the list, tag counts and the inbox, and a live-Postgres suite for `reassignIdeas`. |
| 180 | Comp: board pull-in, the pool, Home tile | UI/UX (comp) | 176 | `SPEC/mockups/comp-r-board-pull-in.html`: the board form's *Add existing items* step (create and edit) with its three tabs and landing line, the idea form's *No board* choice, the *No board* label, *Remove from board*, and the Org Admin's *Needs a board* tile added to the Home comp. Comp only; the user approves it before 181 starts. |
| 181 | UI: pull-in, the pool and the Home tile | UI/UX | 178, 180 approved | Built to the approved comp in `apps/web` (`settings/board-form.tsx` for create and edit, `idea-form.tsx`, the drawer and list, Home's tile through `lib/data/home.ts`). `string \| null` board through `adapt.ts`, the card actions and the list. |
| 182 | QA for 181 | QA | 181 | The Home tile (Org Admin only, its count and link), the picker's tabs and role-based visibility on create and edit, selection and the 100 cap, the refusal messages rendered beside `pullItemIds`, the form's *No board* default by entry point, and the detach action's visibility. |

## Open before 177

Nothing blocks 177. Two details stay *(proposed)* in the spec and are confirmed in the comp: the status a pool idea is created with, and the in-lane order of pulled items.
