# Feature: Board References (Idea → Tasks → Results)

> **Status:** written spec **approved by the owner 2026-10-15**. Nothing is built. The superseding entry is written (`SPEC/decisions.md` "2026-10-15 — Board References replace the Delivery phase"); Delivery stays in place until Plan 4.
> **Supersedes (logged in `SPEC/decisions.md`; Delivery stays in place until Plan 4):** the Delivery phase, the promotion gate as a
> separate step, the fixed delivery status set, Sprint-as-org-container, and checklist Tasks in
> `SPEC/20-feature-issues-and-delivery.md` (Slice 1). Outcomes (Slice 2) is kept and extended.
> **Reference rendering:** `SPEC/mockups/comp-s-board-reference.html` (Graphite, three screens).
> **Review comp (2026-10-16, awaiting review):** `SPEC/mockups/comp-t-board-references-decisions.html` draws the metric types, Value section, task drawer, reference-lane lock, lane setting, pull picker and Outcome totals. Not a reference until approved.

## Problem

Collaboration on an improvement and tracking its execution live in different tools, and the value of the
work is never rolled up. Collega's current answer splits an idea into a Discovery phase and a Delivery
phase with a fixed status set, a sprint board and a checklist. That limits execution: tasks cannot have a
status flow of their own, cannot run in parallel or in sequence, and cannot be time-boxed with the team's
other work.

## Goal

One continuous record from "idea raised" to "value proven". An idea moves through its board's statuses. One
of those statuses can hand the idea's work to **another board**, where many tasks run in parallel or in
order, optionally inside sprints, and the idea takes control back when they are done. Effort rolls up to
the idea, and ideas roll up to Outcomes with projected and realized value.

## Decisions (resolved with the owner, 2026-10-15)

| Topic | Decision |
|---|---|
| Lifecycle | One board per idea. E.g. CI board: Pending → Scoping → Approved for Implementation → Implementation → Completed. |
| Delivery machinery | Folded in. No Discovery/Delivery phase, no fixed delivery statuses; sprints become an optional board feature. |
| Mechanism | A **Board Reference status**: a status that references another board. |
| Reference behavior | Entering the status lets the idea **spawn tasks** on the referenced board. Each task walks that board's statuses itself. |
| Build approach | **One item type.** A task is an `ideas` row on the child board with a parent link (no second entity). |
| Lock | **A card in a reference lane cannot leave it while any task is open** (`SPEC/decisions.md` 2026-10-16). An Org Admin may force the move with a reason. |
| Hand-off | A lane may **auto-create one task on entry**; the parent waits on it. Without it, people add tasks by hand. |
| Returning | When every task is in a final status, the parent offers a move to the next status. **A person confirms;** nothing moves automatically. |
| Sequencing | **Blocked-by links.** No links means parallel. A blocked task cannot leave its board's first status until blockers are final. |
| Sprints | Per child board (`boards.sprints_enabled`), **cross-idea**: one sprint holds tasks from many parents. Unfinished tasks return to the backlog on completion. |
| Standalone cards | Allowed. A child-board card with no parent is simply not part of any idea's rollup. |
| Board settings | **No board-admin role.** The new settings (reference and final lanes, key prefix, idea features, auto-create-one-task) are an Org Admin's, like every board setting; any User may still create a board (`SPEC/decisions.md` 2026-10-04, reconfirmed 2026-10-16). |
| Value | **Typed metrics, projected vs realized.** Projected is set while scoping; realized is typically entered after the idea's final status (not enforced; decided 2026-10-16), and may be entered on an archived board. Outcomes sum each metric type. |

## Data model (all columns nullable unless noted)

- `board_swimlanes.auto_create_task boolean default false`: meaningful only with `references_board_id`.
- `board_swimlanes.references_board_id` → `boards`. Statuses are organization-wide and shared by boards; a board's use of a status is its swimlane, so the reference lives there (the same status can be an ordinary lane on one board and a reference on another). A board may not reference itself; reference chains may not form a cycle.
- "Final status" is not in the schema today (`statuses` has no category or final flag). How a board marks its final lane is an open decision (see Open questions, 5).
- `ideas.parent_idea_id` → `ideas` (self). A parent must sit in a status that references the child's board when the child is created.
- `idea_dependencies(blocked_idea_id, blocker_idea_id)`, both `ideas`; unique pair; cycles rejected; both ideas on the same board.
- `sprints.board_id` (required once sprints are per board) and `boards.sprints_enabled boolean default false`.
- Metric types: org-defined, with per-idea `projected` and `realized` numeric values in a new `metric_types` table, not the user-defined fields (decided 2026-10-16; `contracts/metric-types.md`).
- **Removed:** `ideas.phase`, the fixed delivery status enum, `issue_tasks`, the promotion fields. The Effort requirement moves to the entry into a reference lane (decided below).
- **Kept:** `ideas.outcome_id` (single-parent, top-level ideas). Rollups are derived at read time, never stored.
- The schema freeze (S0.2) is amended a ninth time (the eighth was ideas with no board, 2026-10-13); the tenth (2026-10-16) adds the metric-type tables and `board_swimlanes.auto_create_task`. No data migration: the seed rebuilds the database.

## Behavior

1. **Entering a reference status:** a normal move. The idea's drawer shows a Tasks section with "+ Add task". A new task is a card in the referenced board's first status. Entering with zero tasks is allowed.
2. **Task flow:** tasks use the child board's statuses, assignees, comments, tags and sprint. Blocked tasks show a lock.
3. **Completion prompt:** when all tasks are final, the idea shows "All N tasks are complete. Move to <next status>?" with Move and Not yet.
4. **Lock:** while any task is not in a final lane the card cannot leave the lane, nor its board by detach or by being pulled onto another board; it shows "Waiting on N tasks" and a move is refused (`parentHasOpenTasks`). An Org Admin can force the move with a required reason (audited); the tasks remain on the child board. With no tasks there is nothing to wait on. A lane set to auto-create creates one task on every entry, by status move, pull or bulk lane move (parent's title, child board's first lane; decided 2026-10-16).
5. **Late additions:** adding a task to an idea already past the reference status prompts "Move back to <status>?".
6. **Guards:** a reference lane cannot be removed or re-pointed while ideas sit in it; a board cannot be archived while a lane references it.
7. **Rollups:** `N of M tasks` on the idea card and drawer; per-Outcome idea, task and value totals (projected and realized, by metric type).
8. **Visibility:** child cards show a `↳ <parent key>` chip; standalone cards show none.
9. **Tasks:** a task is editable by its author or an Org Admin in its task fields only (title, description, assignees, tags), and is never pulled onto another board (decided 2026-10-16).
10. **Roles:** unchanged. Site Admin mutates only through View As; Org Admins configure reference statuses and metric types.

## UI

Three screens, drawn in `comp-s-board-reference.html`: (1) Statuses page with the board-reference selector and an explanatory panel, (2) the parent drawer with tasks, sprint chips and a blocked lock, (3) the child board with the sprint header and parent chips. The earlier idea-detail and Outcome-rollup comps (`hifi-idea-and-outcome`) remain the reference for the value table and the Outcome page.

## Out of scope

Automatic parent moves, story points or velocity, per-task dates (dates live on sprints), nested references more than two levels deep in the UI (the model allows chaining; the UI does not promise it), reporting beyond Outcome rollups, email delivery.

## Open questions for the owner

1. ~~The 17 Outcomes questions~~ answered 2026-10-15 below; ~~to be copied into `contracts/outcomes.md` once this spec is approved~~ done in `contracts/outcomes.md`, 2026-10-15.
2. ~~Idea-only fields on child cards~~ decided below.
3. ~~Nested references~~ decided below.
4. ~~Entry conditions~~ decided below.
5. ~~Final lane~~ decided below: an explicit `board_swimlanes.is_final` flag.

## Further decisions (2026-10-15, while answering `contracts/outcomes.md` "Not yet specified")

> **Confirmed and amended, 2026-10-15 (later):** the user decided the 17 questions in `contracts/outcomes.md` ("The 17 open Outcome contract questions are decided", `SPEC/decisions.md`). The individually decided lines below stand. The "defaults accepted without individual review" paragraph is confirmed for Q2 (the shape is new: no Issue key, `{ outcomes, ungrouped }`), Q3, Q5, Q14 and Q15, and superseded where the contract differs (Q6, Q7, Q8, Q11, Q13, Q16, and grouping into a bad Outcome is a `400`).

Decided by the owner:
- **Final lane:** `board_swimlanes.is_final`, set per lane on the Statuses page (the comp's "Kind" column). A board may have several final lanes; only those count as done. Statuses stay organization-wide and unchanged.
- **Item keys:** each board gets a short prefix; items get a per-board counter (`CI-19`, `IMPL-204`). Needs `boards.key_prefix` and a per-board counter. The comps already use this form.
- **Outcome grouping (Q12):** any item with no parent, in any status, on any board, including standalone cards on a child board. A card with a parent is refused with `422` and rolls up through its parent. The Outcome is single-parent as before.
- **Grouping is saved per item** with `PUT /ideas/{id}/outcomes` (Q9). The Outcome write carries no item list; it accepts `color`.
- **Rollup (Q1):** `ideaCount`/`doneIdeaCount` (an item in a final lane is done), `taskCount`/`doneTaskCount` over child cards, projected and realized totals per metric type, the sprint span derived from the tasks' sprints, quarter placement. The State (*Planned*, *In its window*, *Past its window*) is computed by the client.
- **Idea-only fields:** a board setting (`boards.idea_features_enabled`) controls upvotes, idea types and type fields, and AI assist. It defaults to on for ordinary boards and off for a board that is the target of a reference; an Org Admin may change it. Tasks then show title, description, assignee, tags, sprint and blockers.
- **Nesting:** one level at launch. A board that is the target of a reference may not contain a reference lane (the guard is on both sides). The model does not forbid chains, so this can open later without a schema change.
- **Entry condition:** Effort is required to enter any reference lane (replaces the old promotion-gate rule). No configurable per-lane rules.
- **Names (Q4):** duplicates allowed; no uniqueness constraint.
- **App Admin (Q10):** reads only through View As, as decided 2026-10-04. No direct read route.
- **Placement (Q17):** a new Outcome takes the end of the order.

Defaults proposed and accepted without individual review (flag as unreviewed in the contract so the backend slice may challenge them): roadmap read as one `GET .../roadmap` beside the list and detail reads (Q2); shared error model with keys named after the rule (Q3); colour upper-cased on store, random palette colour when absent on create, unchanged when absent on update (Q5); unpaged list (Q6); reorder body `{ outcomeIds }` matching the active set exactly, `sortOrder` 0..n-1 (Q7); create 201, update/reorder/grouping 200, delete 204 (Q8); the four named audit events with `IssueOutcomeGroupingChanged` carrying item, from and to, a no-op writing nothing, no notifications (Q11); `ownerDisplayName` included (Q13); dates `YYYY-MM-DD` (Q14); soft-deleted Outcomes excluded from every read (Q15); a repeat delete is `404` (Q16). Grouping into an unknown, deleted or other-organization Outcome is `404`.

## Work this implies (not scheduled)

New spec contracts (`contracts/boards.md`, `statuses.md`, `ideas.md`, `sprints.md`, a dependencies contract), superseding entries in `SPEC/decisions.md`, a schema amendment, backend slices, QA, UI, and an update to `SPEC/50-typescript-migration.md` where it names Delivery slice 1. Sequencing against Sprint 14 and the cutover is the owner's call.
