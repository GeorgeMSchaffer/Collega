# Sprint 14 — Board pull-in and ideas with no board

**Status:** Planned 2026-10-13. Slice 176 (the spec) is written; 177 onward waits on the user's answers to Q1–Q6 in `SPEC/20-feature-board-pull-in.md` and, for the UI, on the comp.

**Goal:** creating a board can pull in existing items (Discovery ideas from other boards, backlog Issues returned to Discovery, and ideas with no board), and an idea may belong to no board. Authority: `SPEC/20-feature-board-pull-in.md`; `SPEC/decisions.md` 2026-10-13 ("Boards can pull in existing items, and ideas can have no board", which also records the eighth S0.2 schema amendment).

**Order.** 177 first (schema, domain and the pool; everything else needs a nullable board). 178 follows it. 180, the comp, runs in parallel with 177 and 178 because it changes no code. 179 follows 177–178; 181 needs 178 and the approved comp; 182 follows 181. Bug Triage `TODO` was empty when read on 2026-10-12.

**Release.** The migration and the code reach `dev` as each slice merges. Nothing here ships to `main` or production until the cutover (Sprint 13, slice 140) has released: production should not take an eighth schema change mid-cutover.

**Out of this sprint:** adding items to an existing board and a single-idea *Move to another board* action (parked in `SPEC/ideas-inbox.md`); CSV import and the idea assistant creating pool ideas (Q6); anything in `SPEC/20-feature-board-pull-in.md` "Out of scope".

## Slices

| # | Slice | Role | Depends on | Scope |
|---|---|---|---|---|
| 176 | Board pull-in: spec | Backend (docs) | — | `SPEC/20-feature-board-pull-in.md`, the 2026-10-13 decision, this plan, the tracker row. **Done 2026-10-13**, pending review. |
| 177 | Ideas with no board: schema, domain, contracts | Backend | 176, Q1–Q3, Q6 answered | Migration: `ideas.board_id` and `notification_events.board_id` drop `NOT NULL`. Domain: `createIdea` and the notification event accept no board. Application: the pool create (`POST /organizations/{orgId}/ideas`), detach (`DELETE /ideas/{ideaId}/board`), the `board=none` list filter, null cases in `ensureIdeaBoardNotArchived`, `changeStatus` and the comment, task and notification inputs; `IdeaBoardChanged` audit. Infrastructure: list `none` filter and null ordering, tag usage `LEFT JOIN`. Contracts written: `boards.md`, `ideas.md`, the new routes. Confirms the golden replay is unchanged. Web only as far as `boardId: string \| null` typing. |
| 178 | Pull onto a new board | Backend | 177 | `pullItemIds` on `POST …/boards`: eligibility (rule 10), the role check (rule 11), placement (rule 13), Return to Discovery inside the pull without the archived-board refusal (rule 14), `reassignIdeas` in the same unit of work as the new board, audit (rule 18), the 100-item cap, `pulledItems` in the response. The picker's reads: the list filters, or `pull-candidates` if they cannot carry the cases (decided here). |
| 179 | QA for 177 and 178 | QA | 177, 178 | Per `SPEC/40-test-strategy.md`, each rule checked by breaking it: every refusal in rules 5–6 and 10–12, the placement rule both ways, atomicity (a refused or vanished item creates nothing), the User-versus-Org-Admin matrix, the Issue return keeping tasks, effort and the promotion snapshot, no notification, audit shapes, null-board handling in the list, tag counts and the inbox, and a live-Postgres suite for `reassignIdeas`. |
| 180 | Comp: create board with pull-in, the pool | UI/UX (comp) | 176 | `SPEC/mockups/comp-r-board-pull-in.html`: the create-board form's *Add existing items* step with its three tabs and landing line, the idea form's *No board* choice, the *No board* label, and *Remove from board*. Comp only; the user approves it before 181 starts. |
| 181 | UI: pull-in and the pool | UI/UX | 178, 180 approved | Built to the approved comp in `apps/web` (`settings/board-form.tsx`, `idea-form.tsx`, the drawer and list). `string \| null` board through `adapt.ts`, the card actions and the list. |
| 182 | QA for 181 | QA | 181 | The picker's tabs and role-based visibility, selection and the 100 cap, the refusal messages rendered beside `pullItemIds`, the form's *No board* default by entry point, and the detach action's visibility. |

## Open before 177

The user answers Q1–Q6 in `SPEC/20-feature-board-pull-in.md`. 177 does not start on a *(proposed)* default the user has not seen.
